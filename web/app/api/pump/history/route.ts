import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id') || '22222222-2222-2222-2222-222222222222';
  const isDemo = url.searchParams.get('demo') === 'true' || !isSupabaseConfigured();

  if (isDemo) {
    return NextResponse.json({
      history: [
        {
          id: 'p_hist_1',
          action: 'PUMP_OFF',
          source: 'voice_te',
          duration_seconds: 300,
          started_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          stopped_at: new Date(Date.now() - 3600000 * 5 + 300000).toISOString(),
          status: 'completed',
          notes: 'వాయిస్ ఆదేశం: 5 నిమిషాలు నీరు పెట్టారు'
        },
        {
          id: 'p_hist_2',
          action: 'PUMP_OFF',
          source: 'manual_web',
          duration_seconds: 180,
          started_at: new Date(Date.now() - 3600000 * 26).toISOString(),
          stopped_at: new Date(Date.now() - 3600000 * 26 + 180000).toISOString(),
          status: 'completed',
          notes: 'వెబ్ డ్యాష్‌బోర్డ్ ద్వారా'
        }
      ]
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ history: [] });
  }

  try {
    const { data, error } = await supabase
      .from('pump_events')
      .select('*')
      .eq('device_id', deviceId)
      .order('started_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return NextResponse.json({ history: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
