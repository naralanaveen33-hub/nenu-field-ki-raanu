import { NextRequest, NextResponse } from 'next/server';
import { fetchFarmWeather } from '@/lib/weather/open_meteo';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params;
  let lat = 16.5062;
  let lon = 80.6480;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: farm } = await supabase
        .from('farms')
        .select('latitude, longitude')
        .eq('id', farmId)
        .single();
      if (farm) {
        lat = farm.latitude;
        lon = farm.longitude;
      }
    }
  }

  // Override with field-specific coordinates if passed
  const url = new URL(request.url);
  const qLat = parseFloat(url.searchParams.get('lat') || '');
  const qLon = parseFloat(url.searchParams.get('lon') || '');
  if (!isNaN(qLat) && !isNaN(qLon)) {
    lat = qLat;
    lon = qLon;
  }

  const weather = await fetchFarmWeather(farmId, lat, lon);
  return NextResponse.json(weather);
}
