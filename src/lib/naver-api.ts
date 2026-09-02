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

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getNaverAccessToken(creds: NaverCredentials): Promise<string> {
  const cacheKey = creds.client_id;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 30 * 60 * 1000) {
    return cached.token;
  }

  const token = await fetchToken(creds);
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 2.5 * 60 * 60 * 1000 });
  return token;
}

async function naverFetch(path: string, creds: NaverCredentials, params?: Record<string, string>, retries = 3) {
  const token = await getNaverAccessToken(creds);
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 429) {
      if (attempt < retries) {
        const waitMs = 2000 * (attempt + 1); // 2s, 4s, 6s
        console.log(`[Naver] 429 rate limit, ${waitMs}ms 후 재시도 (${attempt + 1}/${retries})`);
        await sleep(waitMs);
        continue;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`스마트스토어 API 오류 (${res.status}): ${text}`);
    }

    return res.json();
  }

  throw new Error('스마트스토어 API 오류: 재시도 횟수 초과 (429)');
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

// API 최대 조회 범위: 24시간 → YYYY-MM-DDTHH:mm:ss.SSS+09:00 형식
function toNaverDateTime(dateStr: string, endOfDay = false): string {
  return `${dateStr}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`;
}

// dateFrom~dateTo 사이의 날짜 목록 생성
function getDatesInRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// 완료된 주문만 집계 (취소/반품 제외)
const VALID_STATUSES = new Set([
  'PAYED',
  'DELIVERING',
  'DELIVERED',
  'PURCHASE_DECIDED',
]);

export interface NaverDailyData {
  dailyMap: Map<string, {
    totalSaleAmount: number;
    orderCount: number;
    items: Map<string, { productName: string; optionName: string; quantity: number; saleAmount: number }>;
    orders: { productOrderId: string; paymentDate: string; quantity: number; unitPrice: number; saleAmount: number; productName: string; optionName: string }[];
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processProductOrder(item: any, dailyMap: NaverDailyData['dailyMap']) {
  // 응답 구조: { productOrderId, content: { order: {...}, productOrder: {...} } }
  const productOrder = item.content?.productOrder ?? item;
  const order = item.content?.order ?? {};

  const status = productOrder.productOrderStatus;
  if (!VALID_STATUSES.has(status)) return;

  const paymentDate = order.paymentDate ?? productOrder.paymentDate ?? '';
  const payDate = paymentDate?.slice(0, 10);
  if (!payDate) return;

  const key = `${payDate}_smartstore`;
  if (!dailyMap.has(key)) {
    dailyMap.set(key, { totalSaleAmount: 0, orderCount: 0, items: new Map(), orders: [] });
  }
  const daily = dailyMap.get(key)!;

  const amount = Number(productOrder.totalPaymentAmount ?? 0);
  const qty = Number(productOrder.quantity ?? 1);
  const productName = String(productOrder.productName ?? '');
  const optionName = String(productOrder.optionName ?? '');

  daily.totalSaleAmount += amount;
  daily.orderCount += 1;

  const productKey = `${productName}|${optionName}`;
  const existing = daily.items.get(productKey);
  if (existing) {
    existing.quantity += qty;
    existing.saleAmount += amount;
  } else {
    daily.items.set(productKey, { productName, optionName, quantity: qty, saleAmount: amount });
  }

  daily.orders.push({
    productOrderId: String(productOrder.productOrderId ?? ''),
    paymentDate,
    quantity: qty,
    unitPrice: Math.round(amount / qty),
    saleAmount: amount,
    productName,
    optionName,
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchNaverOrders(dateFrom: string, dateTo: string, creds: NaverCredentials): Promise<NaverDailyData> {
  const dailyMap: NaverDailyData['dailyMap'] = new Map();
  const dates = getDatesInRange(dateFrom, dateTo);

  // API 최대 24시간 제한 → 날짜별로 1건씩 호출 (rate limit 방지: 1s 간격)
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    if (i > 0) await sleep(1000);
    let page = 1;
    const PAGE_SIZE = 100;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await naverFetch('/v1/pay-order/seller/product-orders', creds, {
        from: toNaverDateTime(date, false),
        to: toNaverDateTime(date, true),
        rangeType: 'PAYED_DATETIME',
        pageSize: String(PAGE_SIZE),
        page: String(page),
      });

      // 응답 구조: { data: { contents: [...], pagination: { hasNext } } }
      const contents: unknown[] = json?.data?.contents ?? [];
      const hasNext: boolean = json?.data?.pagination?.hasNext === true;

      console.log(`[Naver] ${date} p${page} contents: ${contents.length}, hasNext: ${hasNext}`);

      for (const item of contents) {
        processProductOrder(item, dailyMap);
      }

      if (!hasNext) break;
      page++;
    }
  }

  return { dailyMap };
}

export interface NaverReturnRecord {
  productOrderId: string;
  totalPaymentAmount: number;
  claimDate: string;
}

export async function fetchNaverReturns(dateFrom: string, dateTo: string, creds: NaverCredentials): Promise<NaverReturnRecord[]> {
  const dates = getDatesInRange(dateFrom, dateTo);
  const returns: NaverReturnRecord[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    if (i > 0) await sleep(1000);
    let page = 1;
    const PAGE_SIZE = 100;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await naverFetch('/v1/pay-order/seller/product-orders', creds, {
        from: toNaverDateTime(date, false),
        to: toNaverDateTime(date, true),
        rangeType: 'CLAIM_REQUESTED_DATETIME',
        productOrderStatuses: 'RETURNED',
        pageSize: String(PAGE_SIZE),
        page: String(page),
      });

      const contents: unknown[] = json?.data?.contents ?? [];
      const hasNext: boolean = json?.data?.pagination?.hasNext === true;

      for (const item of contents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const it = item as any;
        const productOrder = it.content?.productOrder ?? it;
        const claimDate = it.content?.currentClaim?.claimRequestDate?.slice(0, 10) ?? date;
        returns.push({
          productOrderId: String(productOrder.productOrderId ?? ''),
          totalPaymentAmount: Number(productOrder.totalPaymentAmount ?? 0),
          claimDate,
        });
      }

      if (!hasNext) break;
      page++;
    }
  }

  return returns;
}

export async function testNaverConnection(creds: NaverCredentials): Promise<boolean> {
  const token = await getNaverAccessToken(creds);
  return !!token;
}

export type { };
export { naverFetch };
