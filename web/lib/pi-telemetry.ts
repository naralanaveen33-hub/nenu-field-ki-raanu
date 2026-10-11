import type { FarmField, TelemetrySummary } from '@/types';

type PiField = {
  id: string;
  name: string;
  crop?: string;
  area_acres?: number;
  coordinates?: [number, number][];
  created_at?: string;
};

export function mapPiField(field: PiField): FarmField {
  if (!field.id || !field.name) throw new Error('Pi returned an invalid farm');
  const coordinates = Array.isArray(field.coordinates) ? field.coordinates : [];
  const count = coordinates.length;
  const center = count ? {
    lat: coordinates.reduce((sum, point) => sum + Number(point[0]), 0) / count,
    lng: coordinates.reduce((sum, point) => sum + Number(point[1]), 0) / count,
  } : { lat: 0, lng: 0 };
  return {
    id: field.id,
    name: field.name,
    crop: field.crop || 'Unknown',
    area: typeof field.area_acres === 'number' ? `${field.area_acres} Acres` : 'Area unavailable',
    coordinates,
    center,
    created_at: field.created_at || '',
  };
}

export function mapPiStatus(data: any, field: FarmField): TelemetrySummary {
  const sensor = data?.sensor || data?.sensors;
  const weather = data?.weather;
  const advice = data?.recommendation;
  const moisture = sensor?.moisture == null ? null : Number(sensor.moisture);
  const soilRaw = sensor?.soil_raw == null ? null : Number(sensor.soil_raw);
  if (data?.farm_selected !== true || data.farm_id !== field.id || sensor?.farm_id !== field.id ||
      !weather || !advice ||
      (moisture !== null && !Number.isFinite(moisture)) ||
      (moisture === null && (soilRaw === null || !Number.isFinite(soilRaw)))) {
    throw new Error(`Pi has no status for ${field.name}`);
  }

  const readingAt = sensor.last_updated || data.timestamp || new Date().toISOString();
  const ageSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(readingAt)) / 1000));
  const code = String(advice.recommendation || '').toUpperCase();
  const recommendation = code.includes('NOT REQUIRED') ? 'DO_NOT_IRRIGATE'
    : code.includes('RECOMMENDED') ? 'IRRIGATE_RECOMMENDED' : 'WAIT_RECHECK';
  const demo = data.demo_mode === true;

  return {
    farm: {
      id: field.id,
      user_id: 'pi-local',
      name: data.farm_name || field.name,
      latitude: field.center.lat,
      longitude: field.center.lng,
      crop_type: field.crop as TelemetrySummary['farm']['crop_type'],
      soil_type: 'Unknown' as TelemetrySummary['farm']['soil_type'],
      target_moisture_min: 30,
      target_moisture_max: 40,
      created_at: field.created_at,
    },
    device: {
      id: data.sensor_id || sensor.sensor_id,
      farm_id: field.id,
      device_name: 'Raspberry Pi Field Gateway',
      device_type: 'gateway',
      // This device represents the Pi API; Arduino connectivity is separate.
      status: 'online',
      is_stale: !demo && ageSeconds > 120,
      last_seen: readingAt,
      created_at: field.created_at,
    },
    latest_sensor: {
      device_id: data.sensor_id || sensor.sensor_id,
      temperature: Number(sensor.temperature),
      humidity: Number(sensor.humidity),
      soil_moisture: moisture,
      ...(soilRaw === null ? {} : { soil_raw: soilRaw }),
      recorded_at: readingAt,
      is_stale: !demo && ageSeconds > 120,
    },
    active_pump: {
      is_running: data.motor?.is_on === true,
      remaining_seconds: 0,
      elapsed_seconds: Number(data.motor?.current_session_seconds || 0),
      duration_seconds: 0,
      cooldown_active: false,
      cooldown_remaining_seconds: 0,
    },
    weather: {
      farm_id: field.id,
      temperature: Number(weather.temperature),
      humidity: Number(weather.humidity),
      rain_probability: Number(weather.rain_probability),
      precipitation_mm: 0,
      precipitation_unknown: true,
      wind_speed: 0,
      forecast_summary: weather.condition || 'Weather unavailable',
      forecast_time: weather.last_updated || data.timestamp,
      hourly_forecast: Array.isArray(weather.forecast) ? weather.forecast.map((slot: any) => ({
        time: String(slot.time), temp: Number(slot.temp), rain_prob: Number(slot.rain_prob), precip_mm: 0,
      })) : [],
    },
    recommendation: {
      id: `pi-${field.id}`,
      farm_id: field.id,
      soil_moisture: moisture,
      rain_probability: Number(weather.rain_probability),
      precipitation_mm: 0,
      recommendation,
      explanation_en: advice.reason || '',
      explanation_te: advice.reason_te || '',
      suggested_duration_seconds: 0,
      requires_confirmation: true,
      is_confirmed: false,
      expires_at: '',
      created_at: advice.timestamp || data.timestamp,
    },
    is_demo_mode: demo,
    source: 'raspberry_pi',
    serial_connected: data.serial_connected === true,
    serial_port_open: data.serial_port_open === true,
  };
}
