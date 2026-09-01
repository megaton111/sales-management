import crypto from 'crypto';

const BASE_URL = 'https://api-gateway.coupang.com';

export interface CoupangCredentials {
  access_key: string;
  secret_key: string;
  vendor_id: string;
}

function generateHmacSignature(method: string, path: string, query: string, creds: CoupangCredentials) {
  const datetime = new Date().toISOString().slice(2, 19)
    .replace(/:/g, '').replace(/-/g, '') + 'Z';

  const message = datetime + method + path + query;
  const signature = crypto.createHmac('sha256', creds.secret_key)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${creds.access_key}, signed-date=${datetime}, signature=${signature}`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = 2000 * Math.pow(2, attempt);
      console.warn(`429 Rate Limit - ${waitMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
      continue;
    }
    return res;
  }
  throw new Error('최대 재시도 횟수 초과');
}

function toCompactDate(date: string) {
  return date.replace(/-/g, '');
}

// ========== 판매자배송 발주서 API ==========

interface OrderItem {
  vendorItemId: number;
  vendorItemName: string;
  productId: number;
  sellerProductName: string;
  shippingCount: number;
  salesPrice: number;
  orderPrice: number;
  discountPrice: number;
  coupangDiscount: number;
  canceled: boolean;
}

interface OrderSheet {
  orderId: number;
  orderDate: string;
  paidAt: string;
  status: string;
  shippingPrice: number;
  orderItems: OrderItem[];
}

interface OrderSheetResponse {
  code: string;
  message: string;
  data: OrderSheet[];
  nextToken: string;
}

const SALE_STATUSES = ['ACCEPT', 'INSTRUCT', 'DEPARTURE', 'DELIVERING', 'FINAL_DELIVERY', 'NONE_TRACKING'];

async function fetchOrderSheetsByStatus(date: string, status: string, creds: CoupangCredentials): Promise<OrderSheet[]> {
  const allData: OrderSheet[] = [];
  let nextToken = '';
  let hasMore = true;

  const path = `/v2/providers/openapi/apis/api/v4/vendors/${creds.vendor_id}/ordersheets`;

  while (hasMore) {
    let query = `createdAtFrom=${date}&createdAtTo=${date}&status=${status}`;
    if (nextToken) query += `&nextToken=${nextToken}`;
    query += '&maxPerPage=50';

    const authorization = generateHmacSignature('GET', path, query, creds);

    const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
      method: 'GET',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`쿠팡 판매자배송 API 오류 (${res.status}): ${errorText}`);
    }

    const json: OrderSheetResponse = await res.json();
    allData.push(...(json.data || []));

    if (json.nextToken && json.nextToken !== '') {
      nextToken = json.nextToken;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function fetchOrderSheetsByDate(date: string, creds: CoupangCredentials): Promise<OrderSheet[]> {
  const allOrders: OrderSheet[] = [];
  const seenOrderIds = new Set<number>();

  for (const status of SALE_STATUSES) {
    const orders = await fetchOrderSheetsByStatus(date, status, creds);
    for (const order of orders) {
      if (!seenOrderIds.has(order.orderId)) {
        seenOrderIds.add(order.orderId);
        allOrders.push(order);
      }
    }
    await sleep(250);
  }

  return allOrders;
}

async function fetchAllOrderSheetsByDateRaw(date: string, creds: CoupangCredentials): Promise<OrderSheet[]> {
  const allOrders: OrderSheet[] = [];
  for (const status of SALE_STATUSES) {
    const orders = await fetchOrderSheetsByStatus(date, status, creds);
    allOrders.push(...orders);
    await sleep(250);
  }
  return allOrders;
}

// ========== 로켓그로스 주문 API ==========

interface RgOrderItem {
  vendorItemId: number;
  productName: string;
  salesQuantity: number;
  unitSalesPrice: string | number;
  currency: string;
}

interface RgOrder {
  vendorId: string;
  orderId: number;
  paidAt: string;
  orderItems: RgOrderItem[];
}

interface RgOrderResponse {
  code: number;
  message: string;
  data: RgOrder[];
  nextToken?: string;
}

export async function fetchRgOrders(dateFrom: string, dateTo: string, creds: CoupangCredentials): Promise<RgOrder[]> {
  const allData: RgOrder[] = [];
  let nextToken = '';
  let hasMore = true;

  const toDate = new Date(dateTo);
  toDate.setDate(toDate.getDate() + 1);
  const adjustedTo = toDate.toISOString().split('T')[0];

  const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${creds.vendor_id}/rg/orders`;

  while (hasMore) {
    let query = `paidDateFrom=${toCompactDate(dateFrom)}&paidDateTo=${toCompactDate(adjustedTo)}`;
    if (nextToken) query += `&nextToken=${nextToken}`;

    const authorization = generateHmacSignature('GET', path, query, creds);

    const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
      method: 'GET',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`쿠팡 로켓그로스 API 오류 (${res.status}): ${errorText}`);
    }

    const json: RgOrderResponse = await res.json();
    allData.push(...(json.data || []));

    if (json.nextToken && json.nextToken !== '') {
      nextToken = json.nextToken;
      await sleep(300);
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// ========== 통합 조회: 채널별 일별 매출 집계 ==========

interface ChannelDailySaleData {
  totalSalePrice: number;
  orderCount: number;
  items: Map<string, {
    vendorItemId: number;
    productName: string;
    vendorItemName: string;
    quantity: number;
    salePrice: number;
  }>;
}

export interface OrderDetailRecord {
  saleDate: string;
  channel: 'marketplace' | 'rocket_growth';
  orderId: number;
  vendorItemId: number;
  quantity: number;
  saleAmount: number;
  paidAt: string;
  salesPrice?: number;
  orderPrice?: number;
  discountPrice?: number;
  couponDiscount?: number;
  unitPrice?: number;
  status?: string;
}

export async function fetchAllOrders(dateFrom: string, dateTo: string, creds: CoupangCredentials): Promise<{
  dailyMap: Map<string, ChannelDailySaleData>;
  orderDetails: OrderDetailRecord[];
}> {
  const dailyMap = new Map<string, ChannelDailySaleData>();
  const orderDetails: OrderDetailRecord[] = [];

  function getOrCreate(date: string, channel: string): ChannelDailySaleData {
    const key = `${date}_${channel}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, { totalSalePrice: 0, orderCount: 0, items: new Map() });
    }
    return dailyMap.get(key)!;
  }

  function addItem(data: ChannelDailySaleData, vendorItemId: number, productName: string, vendorItemName: string, quantity: number, salePrice: number) {
    const key = String(vendorItemId);
    const existing = data.items.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.salePrice += salePrice;
    } else {
      data.items.set(key, { vendorItemId, productName, vendorItemName, quantity, salePrice });
    }
  }

  // 1. 판매자배송 발주서 조회
  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const allOrders = await fetchAllOrderSheetsByDateRaw(dateStr, creds);

    const seenOrderIds = new Set<number>();
    const seenItemKeys = new Set<string>();

    for (const order of allOrders) {
      const daily = getOrCreate(dateStr, 'marketplace');

      if (!seenOrderIds.has(order.orderId)) {
        seenOrderIds.add(order.orderId);
        daily.orderCount++;
      }

      for (const item of order.orderItems) {
        if (item.canceled) continue;
        const itemKey = `${order.orderId}_${item.vendorItemId}`;
        if (seenItemKeys.has(itemKey)) continue;
        seenItemKeys.add(itemKey);

        const saleAmount = item.orderPrice - item.discountPrice - item.coupangDiscount;
        daily.totalSalePrice += saleAmount;
        addItem(daily, item.vendorItemId, item.sellerProductName.trim().replace(/\s+/g, ' '), item.vendorItemName, item.shippingCount, saleAmount);

        orderDetails.push({
          saleDate: dateStr,
          channel: 'marketplace',
          orderId: order.orderId,
          vendorItemId: item.vendorItemId,
          quantity: item.shippingCount,
          saleAmount,
          paidAt: order.paidAt,
          salesPrice: item.salesPrice * item.shippingCount,
          orderPrice: item.orderPrice,
          discountPrice: item.discountPrice,
          couponDiscount: item.coupangDiscount,
          status: order.status,
        });
      }
    }
  }

  // 2. 로켓그로스 주문 조회
  const rgOrders: RgOrder[] = [];
  {
    let chunkStart = new Date(dateFrom);
    const finalEnd = new Date(dateTo);
    while (chunkStart <= finalEnd) {
      const chunkEndDate = new Date(chunkStart.getFullYear(), chunkStart.getMonth() + 1, 0);
      const chunkEnd = chunkEndDate < finalEnd ? chunkEndDate : finalEnd;
      const from = chunkStart.toISOString().split('T')[0];
      const to = chunkEnd.toISOString().split('T')[0];
      const chunk = await fetchRgOrders(from, to, creds);
      rgOrders.push(...chunk);
      chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }
  }

  const seenRgKeys = new Set<string>();

  for (const order of rgOrders) {
    const paidMs = Number(order.paidAt);
    const kstDate = new Date(paidMs + 9 * 60 * 60 * 1000);
    const dateStr = kstDate.toISOString().split('T')[0];

    const daily = getOrCreate(dateStr, 'rocket_growth');
    daily.orderCount++;

    for (const item of order.orderItems) {
      const rgKey = `${order.orderId}_${item.vendorItemId}`;
      if (seenRgKeys.has(rgKey)) continue;
      seenRgKeys.add(rgKey);
      const unitPrice = Math.floor(Number(item.unitSalesPrice));
      const totalPrice = unitPrice * item.salesQuantity;
      daily.totalSalePrice += totalPrice;
      const cleanName = item.productName.trim().replace(/\s+/g, ' ');
      addItem(daily, item.vendorItemId, cleanName, cleanName, item.salesQuantity, totalPrice);

      orderDetails.push({
        saleDate: dateStr,
        channel: 'rocket_growth',
        orderId: order.orderId,
        vendorItemId: item.vendorItemId,
        quantity: item.salesQuantity,
        saleAmount: totalPrice,
        paidAt: order.paidAt,
        unitPrice,
      });
    }
  }

  return { dailyMap, orderDetails };
}

// ========== 로켓그로스 재고 API ==========

interface RgInventoryItem {
  vendorId: string;
  vendorItemId: number;
  externalSkuId: number;
  inventoryDetails: {
    totalOrderableQuantity: number;
  };
  salesCountMap: {
    SALES_COUNT_LAST_THIRTY_DAYS: number;
  };
}

interface RgInventoryResponse {
  code: number;
  message: string;
  data: RgInventoryItem[];
  nextToken?: string;
}

export async function fetchRgInventory(creds: CoupangCredentials): Promise<RgInventoryItem[]> {
  const allData: RgInventoryItem[] = [];
  const seenIds = new Set<number>();
  let nextToken = '';
  let hasMore = true;

  const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${creds.vendor_id}/rg/inventory/summaries`;

  while (hasMore) {
    const query = nextToken ? `nextToken=${nextToken}` : '';
    const authorization = generateHmacSignature('GET', path, query, creds);

    const res = await fetchWithRetry(`${BASE_URL}${path}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`쿠팡 로켓그로스 재고 API 오류 (${res.status}): ${errorText}`);
    }

    const json: RgInventoryResponse = await res.json();
    if (allData.length === 0 && json.data?.length > 0) {
      console.log('[재고 API 원본 첫 항목]', JSON.stringify(json.data[0], null, 2));
    }
    for (const item of json.data || []) {
      if (!seenIds.has(item.vendorItemId)) {
        seenIds.add(item.vendorItemId);
        allData.push(item);
      }
    }

    if (json.nextToken && json.nextToken !== '') {
      nextToken = json.nextToken;
      await sleep(300);
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// ========== 반품요청 API (returnRequests) ==========

interface ReturnRequestItem {
  orderId: number;
  requestAt?: string;
  createdAt?: string;
  returnCreatedAt?: string;
  returnCompletedDate?: string;
  [key: string]: unknown;
}

export interface ReturnRequestRecord {
  orderId: number;
  paymentId?: number;
  receiptId?: number;
  vendorItemId?: number;
  shipmentBoxId?: number;
  date: string;
}

export async function fetchReturnRequests(
  dateFrom: string,
  dateTo: string,
  creds: CoupangCredentials
): Promise<ReturnRequestRecord[]> {
  const seenReceiptIds = new Set<number>();
  const records: ReturnRequestRecord[] = [];
  const path = `/v2/providers/openapi/apis/api/v6/vendors/${creds.vendor_id}/returnRequests`;
  // UC: 반품접수, CC: 반품완료(RG 자동처리), RU: 출고중지요청, PR: 쿠팡확인요청
  const statuses = ['UC', 'CC', 'RU', 'PR'];

  for (const status of statuses) {
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      const query = `createdAtFrom=${dateFrom}&createdAtTo=${dateTo}&status=${status}&cancelType=RETURN&pageSize=50&pageNum=${pageNum}`;
      const authorization = generateHmacSignature('GET', path, query, creds);

      const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
        method: 'GET',
        headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        console.error(`returnRequests[${status}] API 오류 (${res.status}): ${await res.text()}`);
        break;
      }

      const json = await res.json();
      const data: ReturnRequestItem[] = json.data || [];


      for (const item of data) {
        const receiptId = item.receiptId as number | undefined;
        if (receiptId && seenReceiptIds.has(receiptId)) continue;
        if (receiptId) seenReceiptIds.add(receiptId);

        const dateStr = (item.createdAt || item.requestAt || item.returnCreatedAt || dateFrom) as string;
        const date = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
        const paymentId = item.paymentId as number | undefined;
        const firstItem = (item.returnItems as Array<{ vendorItemId?: number; shipmentBoxId?: number }> | undefined)?.[0];
        const vendorItemId = firstItem?.vendorItemId;
        const shipmentBoxId = firstItem?.shipmentBoxId;
        records.push({ orderId: item.orderId, paymentId, receiptId, vendorItemId, shipmentBoxId, date });
      }

      if (data.length < 50) {
        hasMore = false;
      } else {
        pageNum++;
        await sleep(300);
      }
    }

    await sleep(200);
  }

  return records;
}

// ========== 매출내역(정산) API — 반품 데이터 ==========

interface RevenueHistoryResponseItem {
  orderId: number;
  saleType: 'SALE' | 'REFUND';
  saleDate: string;
  recognitionDate: string;
  items: {
    vendorItemId: number;
    productName: string;
    quantity: number;
    saleAmount: number;
  }[];
}

export interface RefundRecord {
  orderId: number;
  date: string;
  amount: number;
}

export async function fetchRevenueRefunds(
  dateFrom: string,
  dateTo: string,
  creds: CoupangCredentials
): Promise<RefundRecord[]> {
  const records: RefundRecord[] = [];
  const path = `/v2/providers/openapi/apis/api/v1/revenue-history`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let chunkStart = new Date(dateFrom);
  const finalEnd = new Date(dateTo);

  while (chunkStart < today && chunkStart <= finalEnd) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + 30);
    if (chunkEnd >= today) chunkEnd.setTime(today.getTime() - 86400000);
    if (chunkEnd > finalEnd) chunkEnd.setTime(finalEnd.getTime());
    if (chunkEnd < chunkStart) break;

    const from = chunkStart.toISOString().split('T')[0];
    const to = chunkEnd.toISOString().split('T')[0];

    let token = '';
    let hasMore = true;

    while (hasMore) {
      let query = `vendorId=${creds.vendor_id}&recognitionDateFrom=${from}&recognitionDateTo=${to}&maxPerPage=50&token=${token}`;

      const authorization = generateHmacSignature('GET', path, query, creds);
      const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
        method: 'GET',
        headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        console.error(`revenue-history API 오류 (${res.status}): ${await res.text()}`);
        break;
      }

      const json = await res.json();
      for (const record of (json.data || []) as RevenueHistoryResponseItem[]) {
        if (record.saleType !== 'REFUND') continue;
        records.push({
          orderId: record.orderId,
          date: record.recognitionDate,
          amount: (record.items || []).reduce((sum, i) => sum + (i.saleAmount || 0), 0),
        });
      }

      if (json.hasNext) {
        token = json.nextToken;
        await sleep(300);
      } else {
        hasMore = false;
      }
    }

    chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  return records;
}

export type { OrderSheet, OrderItem, RgOrder, RgOrderItem, ChannelDailySaleData, RgInventoryItem, ReturnRequestItem };
