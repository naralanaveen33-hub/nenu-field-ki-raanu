import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params;
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h'; // 24h, 7d, 30d
  const isDemo = url.searchParams.get('demo') === 'true' || !isSupabaseConfigured();

  if (isDemo) {
    // Generate realistic historical points for demo analytics
    const pointsCount = period === '24h' ? 24 : period === '7d' ? 14 : 30;
    const now = Date.now();
    const stepMs = period === '24h' ? 3600 * 1000 : period === '7d' ? 12 * 3600 * 1000 : 24 * 3600 * 1000;

    const data = [];
    let baseMoisture = 22.0;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const timePoint = new Date(now - i * stepMs);
      const hour = timePoint.getHours();
      
      // Diurnal temp swing (cooler at night, hotter mid-day)
      const temp = 24 + Math.sin((hour - 8) * (Math.PI / 12)) * 8 + (Math.random() * 1.5);
      const humidity = 85 - Math.sin((hour - 8) * (Math.PI / 12)) * 25 + (Math.random() * 2);
      
      // Simulate periodic irrigation bump
      if (i === 18 || i === 6) {
        baseMoisture = 62.0;
      } else {
        baseMoisture = Math.max(18.0, baseMoisture - 1.2);
      }

      data.push({
        timestamp: timePoint.toISOString(),
        timeLabel: period === '24h' ? `${hour}:00` : timePoint.toLocaleDateString('te-IN', { month: 'short', day: 'numeric' }),
        temperature: Number(temp.toFixed(1)),
        humidity: Number(humidity.toFixed(1)),
        soil_moisture: Number(baseMoisture.toFixed(1)),
        battery_level: 97
      });
    }

    return NextResponse.json({ period, readings: data });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase unavailable' }, { status: 500 });
  }

  try {
    // Find device ID
    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('farm_id', farmId)
      .limit(1)
      .single();

    if (!device) {
      return NextResponse.json({ period, readings: [] });
    }

    let intervalStr = '24 hours';
    if (period === '7d') intervalStr = '7 days';
    if (period === '30d') intervalStr = '30 days';

    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('device_id', device.id)
      .order('recorded_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ period, readings: readings || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
