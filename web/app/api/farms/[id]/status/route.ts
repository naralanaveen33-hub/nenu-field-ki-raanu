import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/api-config';
import { mapPiField, mapPiStatus } from '@/lib/pi-telemetry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params;
  const backendUrl = getBackendApiUrl();
  if (!backendUrl) {
    return NextResponse.json({ error: 'Pi API URL is not configured' }, { status: 503 });
  }

  try {
    const [fieldsResponse, statusResponse] = await Promise.all([
      fetch(`${backendUrl}/api/fields`, { cache: 'no-store', signal: AbortSignal.timeout(8000) }),
      fetch(`${backendUrl}/api/status?farm_id=${encodeURIComponent(farmId)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!fieldsResponse.ok || !statusResponse.ok) {
      return NextResponse.json({ error: 'Pi backend did not return farm status' }, { status: 502 });
    }
    const fields = await fieldsResponse.json();
    const field = Array.isArray(fields) ? fields.find((item) => item.id === farmId) : null;
    if (!field) return NextResponse.json({ error: 'Farm not found on Pi' }, { status: 404 });
    const telemetry = mapPiStatus(await statusResponse.json(), mapPiField(field));
    return NextResponse.json(telemetry, {
      headers: { 'Cache-Control': 'no-store', 'X-SmartFarm-Source': 'raspberry_pi' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pi backend unavailable' }, { status: 502 });
  }
}
