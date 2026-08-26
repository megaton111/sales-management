import crypto from 'crypto';

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY!;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY!;
const VENDOR_ID = process.env.COUPANG_VENDOR_ID!;
const BASE_URL = 'https://api-gateway.coupang.com';

function generateHmacSignature(method: string, path: string, query: string) {
  const datetime = new Date().toISOString().slice(2, 19)
    .replace(/:/g, '').replace(/-/g, '') + 'Z';

  const message = datetime + method + path + query;
  const signature = crypto.createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
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

async function fetchOrderSheetsByStatus(date: string, status: string): Promise<OrderSheet[]> {
  const allData: OrderSheet[] = [];
  let nextToken = '';
  let hasMore = true;

  const path = `/v2/providers/openapi/apis/api/v4/vendors/${VENDOR_ID}/ordersheets`;

  while (hasMore) {
    let query = `createdAtFrom=${date}&createdAtTo=${date}&status=${status}`;
    if (nextToken) {
      query += `&nextToken=${nextToken}`;
    }
    query += '&maxPerPage=50';

    const authorization = generateHmacSignature('GET', path, query);

    const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
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

export async function fetchOrderSheetsByDate(date: string): Promise<OrderSheet[]> {
  const allOrders: OrderSheet[] = [];
  const seenOrderIds = new Set<number>();

  for (const status of SALE_STATUSES) {
    const orders = await fetchOrderSheetsByStatus(date, status);
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

async function fetchAllOrderSheetsByDateRaw(date: string): Promise<OrderSheet[]> {
  const allOrders: OrderSheet[] = [];
  for (const status of SALE_STATUSES) {
    const orders = await fetchOrderSheetsByStatus(date, status);
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


export async function fetchRgOrders(dateFrom: string, dateTo: string): Promise<RgOrder[]> {
  const allData: RgOrder[] = [];
  let nextToken = '';
  let hasMore = true;

  // paidDateTo는 exclusive이므로 +1일
  const toDate = new Date(dateTo);
  toDate.setDate(toDate.getDate() + 1);
  const adjustedTo = toDate.toISOString().split('T')[0];

  const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/orders`;

  while (hasMore) {
    let query = `paidDateFrom=${toCompactDate(dateFrom)}&paidDateTo=${toCompactDate(adjustedTo)}`;
    if (nextToken) {
      query += `&nextToken=${nextToken}`;
    }

    const authorization = generateHmacSignature('GET', path, query);

    const res = await fetchWithRetry(`${BASE_URL}${path}?${query}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
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

// key: "날짜_채널" (예: "2026-05-13_marketplace")
export async function fetchAllOrders(dateFrom: string, dateTo: string): Promise<Map<string, ChannelDailySaleData>> {
  const dailyMap = new Map<string, ChannelDailySaleData>();

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

  // 1. 판매자배송 발주서 조회 (하루씩 반복)
  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const allOrders = await fetchAllOrderSheetsByDateRaw(dateStr);

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

        const saleAmount = item.orderPrice - item.coupangDiscount;
        daily.totalSalePrice += saleAmount;
        addItem(daily, item.vendorItemId, item.sellerProductName.trim().replace(/\s+/g, ' '), item.vendorItemName, item.shippingCount, saleAmount);
      }
    }
  }

  // 2. 로켓그로스 주문 조회 (최대 1개월 제한이므로 월 단위로 분할)
  const rgOrders: RgOrder[] = [];
  {
    let chunkStart = new Date(dateFrom);
    const finalEnd = new Date(dateTo);
    while (chunkStart <= finalEnd) {
      const chunkEndDate = new Date(chunkStart.getFullYear(), chunkStart.getMonth() + 1, 0);
      const chunkEnd = chunkEndDate < finalEnd ? chunkEndDate : finalEnd;
      const from = chunkStart.toISOString().split('T')[0];
      const to = chunkEnd.toISOString().split('T')[0];
      const chunk = await fetchRgOrders(from, to);
      rgOrders.push(...chunk);
      chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }
  }

  for (const order of rgOrders) {
    const paidMs = Number(order.paidAt);
    const kstDate = new Date(paidMs + 9 * 60 * 60 * 1000);
    const dateStr = kstDate.toISOString().split('T')[0];

    const daily = getOrCreate(dateStr, 'rocket_growth');
    daily.orderCount++;

    for (const item of order.orderItems) {
      const unitPrice = Math.floor(Number(item.unitSalesPrice));
      const totalPrice = unitPrice * item.salesQuantity;
      daily.totalSalePrice += totalPrice;
      const cleanName = item.productName.trim().replace(/\s+/g, ' ');
      addItem(daily, item.vendorItemId, cleanName, cleanName, item.salesQuantity, totalPrice);
    }
  }

  return dailyMap;
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

export async function fetchRgInventory(): Promise<RgInventoryItem[]> {
  const allData: RgInventoryItem[] = [];
  const seenIds = new Set<number>();
  let nextToken = '';
  let hasMore = true;

  const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/inventory/summaries`;

  while (hasMore) {
    const query = nextToken ? `nextToken=${nextToken}` : '';
    const authorization = generateHmacSignature('GET', path, query);

    const res = await fetchWithRetry(`${BASE_URL}${path}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`쿠팡 로켓그로스 재고 API 오류 (${res.status}): ${errorText}`);
    }

    const json: RgInventoryResponse = await res.json();
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

export type { OrderSheet, OrderItem, RgOrder, RgOrderItem, ChannelDailySaleData, RgInventoryItem };
