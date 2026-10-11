import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/api-config';

async function forwardToPi(method: 'GET' | 'POST', body?: object) {
  const backendUrl = getBackendApiUrl();
  if (!backendUrl) {
    return NextResponse.json({ error: 'Pi API URL is not configured' }, { status: 503 });
  }
  try {
    const response = await fetch(`${backendUrl}/api/chat`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { 'Cache-Control': 'no-store', 'X-SmartFarm-Source': 'raspberry_pi' },
    });
  } catch {
    return NextResponse.json({ error: 'Pi chatbot is unavailable' }, { status: 502 });
  }
}

export async function GET() {
  return forwardToPi('GET');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = body?.message || body?.transcript || body?.text;
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
  }
  const farmId = typeof body?.farm_id === 'string' ? body.farm_id : '';
  return forwardToPi('POST', { message, farm_id: farmId });
}
