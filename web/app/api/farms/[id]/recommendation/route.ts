import { NextRequest, NextResponse } from 'next/server';
import { fetchFarmWeather } from '@/lib/weather/open_meteo';
import { generateIrrigationRecommendation } from '@/lib/recommendation/engine';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params;
  const url = new URL(request.url);

  let lat = 16.5062;
  let lon = 80.6480;
  let targetMin = 30.0;
  let targetMax = 65.0;
  let liveMoisture = 22.4;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      // 1. Fetch farm metadata
      const { data: farm } = await supabase
        .from('farms')
        .select('latitude, longitude, target_moisture_min, target_moisture_max')
        .eq('id', farmId)
        .single();

      if (farm) {
        lat = farm.latitude ?? lat;
        lon = farm.longitude ?? lon;
        targetMin = farm.target_moisture_min ?? targetMin;
        targetMax = farm.target_moisture_max ?? targetMax;
      }

      // 2. Fetch latest live moisture reading if not provided in query param
      if (!url.searchParams.has('moisture')) {
        const { data: device } = await supabase
          .from('devices')
          .select('id')
          .eq('farm_id', farmId)
          .limit(1)
          .single();

        if (device) {
          const { data: reading } = await supabase
            .from('sensor_readings')
            .select('soil_moisture')
            .eq('device_id', device.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

          if (reading && typeof reading.soil_moisture === 'number') {
            liveMoisture = reading.soil_moisture;
          }
        }
      }
    }
  }

  const moisture = url.searchParams.has('moisture')
    ? parseFloat(url.searchParams.get('moisture')!)
    : liveMoisture;

  const weather = await fetchFarmWeather(farmId, lat, lon);
  const recommendation = generateIrrigationRecommendation({
    farmId,
    soilMoisture: moisture,
    weather,
    targetMoistureMin: targetMin,
    targetMoistureMax: targetMax
  });

  return NextResponse.json(recommendation);
}
