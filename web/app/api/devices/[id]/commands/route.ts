import { NextRequest, NextResponse } from 'next/server';
import { executePumpCommand } from '@/lib/commands/executor';
import { getBackendApiUrl } from '@/lib/api-config';
import { PumpAction, PumpSource } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;

  try {
    const body = await request.json();
    const action: PumpAction = body.action;
    const durationSeconds: number = Number(body.duration_seconds || 180);
    const source: PumpSource = body.source || 'manual_web';
    const notes: string = body.notes || '';

    // Extract authorization token if present
    const authHeader = request.headers.get('authorization');

    const result = await executePumpCommand({
      deviceId,
      action,
      durationSeconds,
      source,
      notes,
      authToken: authHeader,
    });

    if (!result.success) {
      const statusCode = result.status === 'REJECTED' ? (result.error?.includes('Rate limit') ? 429 : 400) : 500;
      return NextResponse.json(
        {
          error: result.error,
          error_te: result.error_te,
          status: result.status,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * GET: Retrieve status of latest pump command or active running state
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;

  const backendUrl = getBackendApiUrl();
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/status?farm_id=${encodeURIComponent(deviceId)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const isRunning = Boolean(data.motor?.is_on);
        return NextResponse.json({
          status: isRunning ? 'active' : 'completed',
          is_running: isRunning,
          demo: false,
        });
      }
    } catch {
      // Fall through to demo response
    }
  }

  return NextResponse.json({
    status: 'completed',
    is_running: false,
    demo: true,
  });
}
