import { NextResponse } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var _serverStartTime: number | undefined;
}

// globalThis를 사용해 핫 리로드 시에도 값 유지, 실제 서버 재시작 시에만 갱신
if (!globalThis._serverStartTime) {
  globalThis._serverStartTime = Date.now();
}

export async function GET() {
  return NextResponse.json({ startTime: globalThis._serverStartTime });
}
