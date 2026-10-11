import { WeatherData } from '@/types';

// In-memory server cache to avoid rate limits
interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}

const weatherCache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 5000; // 5 second timeout

export async function fetchFarmWeather(
  farmId: string,
  latitude: number = 16.5062,
  longitude: number = 80.6480
): Promise<WeatherData> {
  // Validate coordinates
  const isCoordsValid = 
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    !(latitude === 0 && longitude === 0);

  if (!isCoordsValid) {
    return {
      farm_id: farmId,
      temperature: 0,
      humidity: 0,
      rain_probability: -1,
      precipitation_mm: 0,
      wind_speed: 0,
      forecast_summary: 'చెల్లని స్థాన వివరాలు (Invalid farm coordinates)',
      forecast_time: new Date().toISOString(),
      is_error: true,
      error_message: `Invalid latitude (${latitude}) or longitude (${longitude})`
    };
  }

  const cacheKey = `${farmId}_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.data;
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m');
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '2');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 1800 } // Next.js cache 30 mins
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo responded with HTTP ${res.status}`);
    }

    const json = await res.json();
    const current = json.current;
    const hourly = json.hourly;

    if (!current || !hourly) {
      throw new Error('Incomplete forecast data received from weather provider');
    }

    // Calculate maximum rain probability in next 24 hours
    const next24HoursProb = (hourly?.precipitation_probability || []).slice(0, 24);
    const maxRainProb = next24HoursProb.length > 0 
      ? Math.max(...next24HoursProb) 
      : (current?.rain > 0 ? 80 : 10);

    // Sum precipitation expected in next 24 hours
    const next24HoursPrecip = (hourly?.precipitation || []).slice(0, 24);
    const sumPrecipMm = next24HoursPrecip.length > 0
      ? next24HoursPrecip.reduce((acc: number, val: number) => acc + val, 0)
      : 0.0;

    const hourlyList = (hourly?.time || []).slice(0, 12).map((timeStr: string, idx: number) => ({
      time: timeStr.slice(11, 16),
      temp: hourly.temperature_2m?.[idx] ?? current.temperature_2m ?? 28,
      rain_prob: hourly.precipitation_probability?.[idx] ?? 0,
      precip_mm: hourly.precipitation?.[idx] ?? 0
    }));

    const weatherData: WeatherData = {
      farm_id: farmId,
      temperature: current?.temperature_2m ?? 28.5,
      humidity: current?.relative_humidity_2m ?? 65.0,
      rain_probability: maxRainProb,
      precipitation_mm: Number(sumPrecipMm.toFixed(1)),
      wind_speed: current?.wind_speed_10m ?? 8.0,
      weather_code: current?.weather_code ?? 0,
      forecast_summary: maxRainProb > 50
        ? `వర్షం పడే అవకాశం ఉంది (${maxRainProb}%). వర్షపాతం: ${sumPrecipMm.toFixed(1)}mm`
        : `ఆకాశం నిర్మలంగా ఉంటుంది. తక్కువ వర్ష సూచన (${maxRainProb}%).`,
      forecast_time: new Date().toISOString(),
      hourly_forecast: hourlyList,
      is_error: false
    };

    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    return weatherData;

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Weather fetch failed';
    console.warn(`[Weather] API error for farm ${farmId}: ${errorMsg}`);

    // If we have stale cache, serve it marked as stale
    if (cached) {
      return {
        ...cached.data,
        is_stale: true,
        error_message: `Using cached forecast from ${new Date(cached.timestamp).toLocaleTimeString()}: ${errorMsg}`
      };
    }

    // Fail safe: return explicit error state so recommendation engine DOES NOT hallucinate weather
    return {
      farm_id: farmId,
      temperature: 0,
      humidity: 0,
      rain_probability: -1,
      precipitation_mm: 0,
      wind_speed: 0,
      forecast_summary: 'వాతావరణ వివరాలు అందుబాటులో లేవు (Weather data unavailable)',
      forecast_time: new Date().toISOString(),
      is_error: true,
      error_message: errorMsg
    };
  }
}
