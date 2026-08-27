import bcrypt from 'bcryptjs';

const BASE_URL = 'https://api.commerce.naver.com/external';

export interface NaverCredentials {
  client_id: string;
  client_secret: string;
}

function generateSign(clientId: string, clientSecret: string, timestamp: number): string {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed, 'utf-8').toString('base64');
}

async function fetchToken(creds: NaverCredentials): Promise<string> {
  const timestamp = Date.now();
  const clientSecretSign = generateSign(creds.client_id, creds.client_secret, timestamp);

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.client_id,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    type: 'SELF',
  });

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`스마트스토어 토큰 발급 실패 (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

// 인증 토큰 캐시 (서버 메모리, 요청별 재사용)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getNaverAccessToken(creds: NaverCredentials): Promise<string> {
  const cacheKey = creds.client_id;
  const cached = tokenCache.get(cacheKey);
  // 만료 30분 전까지 기존 토큰 재사용
  if (cached && cached.expiresAt - Date.now() > 30 * 60 * 1000) {
    return cached.token;
  }

  const token = await fetchToken(creds);
  // 유효시간 3시간, 캐시는 2.5시간 보관
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 2.5 * 60 * 60 * 1000 });
  return token;
}

async function naverFetch(path: string, creds: NaverCredentials, params?: Record<string, string>) {
  const token = await getNaverAccessToken(creds);
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`스마트스토어 API 오류 (${res.status}): ${text}`);
  }

  return res.json();
}

export interface NaverProductOrder {
  productOrderId: string;
  productName: string;
  optionName?: string;
  quantity: number;
  unitPrice: number;
  totalPaymentAmount: number;
  paymentDate: string;
  productOrderStatus: string;
}

interface NaverOrderItem {
  orderId: string;
  productOrders: NaverProductOrder[];
}

interface NaverOrderListResponse {
  data: {
    lastChangedOrders: NaverOrderItem[];
    more: boolean;
    count: number;
  };
}

// 날짜를 ISO 형식으로 변환 (예: 2025-01-01 → 2025-01-01T00:00:00.0Z)
function toNaverDate(dateStr: string, endOfDay = false): string {
  return `${dateStr}T${endOfDay ? '23:59:59.9' : '00:00:00.0'}Z`;
}

// 완료된 주문만 집계 (취소/반품 제외)
const VALID_STATUSES = new Set([
  'PAYED',
  'DELIVERING',
  'DELIVERED',
  'PURCHASE_DECIDED',
]);

export interface NaverDailyData {
  // date_channel → { totalSaleAmount, orderCount, items }
  dailyMap: Map<string, {
    totalSaleAmount: number;
    orderCount: number;
    items: Map<string, { productName: string; optionName: string; quantity: number; saleAmount: number }>;
  }>;
}

export async function fetchNaverOrders(dateFrom: string, dateTo: string, creds: NaverCredentials): Promise<NaverDailyData> {
  const dailyMap = new Map<string, {
    totalSaleAmount: number;
    orderCount: number;
    items: Map<string, { productName: string; optionName: string; quantity: number; saleAmount: number }>;
  }>();

  let page = 1;
  const PAGE_SIZE = 300;

  while (true) {
    const json: NaverOrderListResponse = await naverFetch('/v1/pay-order/seller/orders', creds, {
      lastChangedFrom: toNaverDate(dateFrom),
      lastChangedTo: toNaverDate(dateTo, true),
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    const orders = json.data?.lastChangedOrders ?? [];

    for (const order of orders) {
      for (const po of order.productOrders ?? []) {
        if (!VALID_STATUSES.has(po.productOrderStatus)) continue;

        const payDate = po.paymentDate?.slice(0, 10) ?? dateFrom;
        const key = `${payDate}_smartstore`;

        if (!dailyMap.has(key)) {
          dailyMap.set(key, { totalSaleAmount: 0, orderCount: 0, items: new Map() });
        }
        const daily = dailyMap.get(key)!;
        daily.totalSaleAmount += po.totalPaymentAmount;
        daily.orderCount += 1;

        const productKey = `${po.productName}|${po.optionName ?? ''}`;
        const existing = daily.items.get(productKey);
        if (existing) {
          existing.quantity += po.quantity;
          existing.saleAmount += po.totalPaymentAmount;
        } else {
          daily.items.set(productKey, {
            productName: po.productName,
            optionName: po.optionName ?? '',
            quantity: po.quantity,
            saleAmount: po.totalPaymentAmount,
          });
        }
      }
    }

    if (!json.data?.more) break;
    page++;
  }

  return { dailyMap };
}

export async function testNaverConnection(creds: NaverCredentials): Promise<boolean> {
  const token = await getNaverAccessToken(creds);
  return !!token;
}

export type { };
export { naverFetch };
