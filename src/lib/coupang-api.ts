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

    const res = await fetch(`${BASE_URL}${path}?${query}`, {
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

async function fetchOrderSheetsByDate(date: string): Promise<OrderSheet[]> {
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

async function fetchRgOrders(dateFrom: string, dateTo: string): Promise<RgOrder[]> {
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

    const res = await fetch(`${BASE_URL}${path}?${query}`, {
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
    const orders = await fetchOrderSheetsByDate(dateStr);

    for (const order of orders) {
      const daily = getOrCreate(dateStr, 'marketplace');
      daily.orderCount++;

      for (const item of order.orderItems) {
        if (item.canceled) continue;
        daily.totalSalePrice += item.orderPrice;
        addItem(daily, item.vendorItemId, item.sellerProductName, item.vendorItemName, item.shippingCount, item.orderPrice);
      }
    }
  }

  // 2. 로켓그로스 주문 조회 (한번에 최대 30일)
  const rgOrders = await fetchRgOrders(dateFrom, dateTo);

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
      addItem(daily, item.vendorItemId, item.productName, item.productName, item.salesQuantity, totalPrice);
    }
  }

  return dailyMap;
}

export type { OrderSheet, OrderItem, RgOrder, RgOrderItem, ChannelDailySaleData };
