import { NextRequest, NextResponse } from 'next/server';
import { getInitialDemoState, computeDemoTelemetry } from '@/lib/demo/store';
import { getBackendApiUrl } from '@/lib/api-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params;
  const url = new URL(request.url);
  const forceDemo = url.searchParams.get('demo') === 'true';

  // 1. Try querying the live Raspberry Pi Flask backend if configured
  const backendUrl = getBackendApiUrl();
  if (!forceDemo && backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/status?farm_id=${encodeURIComponent(farmId)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.farm_selected !== false) {
          const demoFallback = computeDemoTelemetry(getInitialDemoState());
          return NextResponse.json({
            farm: {
              id: farmId,
              user_id: demoFallback.farm.user_id,
              name: data.farm_name || demoFallback.farm.name,
              crop_type: (data.crop as any) || demoFallback.farm.crop_type,
              soil_type: demoFallback.farm.soil_type,
              target_moisture_min: 30,
              target_moisture_max: 65,
              latitude: demoFallback.farm.latitude,
              longitude: demoFallback.farm.longitude,
              created_at: demoFallback.farm.created_at,
            },
            device: {
              id: data.sensor_id || 'gateway_pi',
              farm_id: farmId,
              device_name: 'Raspberry Pi Field Gateway',
              status: data.serial_connected ? 'online' : 'offline',
              is_stale: false,
              last_seen: data.timestamp || new Date().toISOString(),
            },
            latest_sensor: {
              temperature: Number(data.sensor?.temperature ?? data.sensors?.temperature ?? 28),
              humidity: Number(data.sensor?.humidity ?? data.sensors?.humidity ?? 65),
              soil_moisture: Number(data.sensor?.moisture ?? data.sensors?.moisture ?? 35),
              battery_level: 100,
              recorded_at: data.timestamp || new Date().toISOString(),
              is_stale: false,
              age_seconds: 0,
            },
            active_pump: {
              is_running: Boolean(data.motor?.is_on),
              is_pending: false,
              command_status: data.motor?.is_on ? 'active' : 'idle',
              remaining_seconds: data.motor?.is_on ? 180 : 0,
              elapsed_seconds: 0,
              total_runtime_today_seconds: 0,
              cooldown_remaining_seconds: 0,
            },
            weather: data.weather || demoFallback.weather,
            recommendation: {
              recommendation: data.recommendation?.recommendation || 'MONITOR SOIL',
              explanation_te: data.recommendation?.reason_te || data.recommendation?.reason || '',
              explanation_en: data.recommendation?.reason || '',
              urgency: 'medium',
            },
            is_demo_mode: Boolean(data.demo_mode),
          });
        }
      }
    } catch {
      // Backend unreachable or timed out, seamlessly continue to fallback
    }
  }

  // 2. Demo simulation fallback if backend unconfigured or unreachable
  const demoState = getInitialDemoState();
  const telemetry = computeDemoTelemetry(demoState);
  return NextResponse.json(telemetry);
}
