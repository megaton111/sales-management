import { NextResponse } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var _serverStartTime: number | undefined;
  // eslint-disable-next-line no-var
  var _syncDone: boolean | undefined;
}

if (!globalThis._serverStartTime) {
  globalThis._serverStartTime = Date.now();
  globalThis._syncDone = false;
}

export async function GET() {
  return NextResponse.json({ startTime: globalThis._serverStartTime, syncDone: globalThis._syncDone ?? false });
}

export async function POST() {
  globalThis._syncDone = true;
  return NextResponse.json({ ok: true });
}
