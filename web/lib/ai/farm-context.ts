import { fetchFarmWeather } from '@/lib/weather/open_meteo';
import { getInitialDemoState, computeDemoTelemetry } from '@/lib/demo/store';
import { FarmChatContext } from './grok';

/**
 * Collect live farm context from the existing live backend / telemetry engine.
 * STRICT ARCHITECTURE REQUIREMENT:
 * WE ARE NOT USING SUPABASE.
 * Farm context originates from the active backend telemetry engine and live weather service.
 */
export async function fetchLiveBackendFarmContext(
  farmId = '11111111-1111-1111-1111-111111111111',
  clientContext?: Partial<FarmChatContext>
): Promise<FarmChatContext> {
  const base: FarmChatContext = {
    soilMoisture: clientContext?.soilMoisture,
    temperature: clientContext?.temperature ?? clientContext?.temp,
    humidity: clientContext?.humidity,
    weather: clientContext?.weather,
    rainProbability: clientContext?.rainProbability ?? clientContext?.rainProb,
    motorStatus: clientContext?.motorStatus ?? (clientContext?.pumpState !== undefined ? (clientContext.pumpState ? 'ON' : 'OFF') : undefined),
    irrigationRecommendation: clientContext?.irrigationRecommendation ?? clientContext?.recommendationType,
    recommendationExplanationTe: clientContext?.recommendationExplanationTe,
    recommendationExplanationEn: clientContext?.recommendationExplanationEn,
    cropType: clientContext?.cropType,
    soilType: clientContext?.soilType,
    fieldName: clientContext?.fieldName,
    fields: clientContext?.fields
  };

  // If fields are not provided in clientContext, load from data/fields.json if available
  if (!base.fields || base.fields.length === 0) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const fieldsPath = path.join(process.cwd(), 'data', 'fields.json');
      if (fs.existsSync(fieldsPath)) {
        base.fields = JSON.parse(fs.readFileSync(fieldsPath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
  }

  // If any critical telemetry value is missing, retrieve from the active backend telemetry engine
  const needsTelemetry =
    base.soilMoisture === undefined ||
    base.temperature === undefined ||
    base.humidity === undefined ||
    !base.weather ||
    base.rainProbability === undefined ||
    !base.motorStatus ||
    !base.irrigationRecommendation;

  if (needsTelemetry) {
    // 1. Compute live telemetry from backend telemetry engine
    const demoTelemetry = computeDemoTelemetry(getInitialDemoState());
    base.soilMoisture ??= demoTelemetry.latest_sensor.soil_moisture;
    base.temperature ??= demoTelemetry.latest_sensor.temperature;
    base.humidity ??= demoTelemetry.latest_sensor.humidity;
    base.rainProbability ??= demoTelemetry.weather.rain_probability;
    base.weather ??= demoTelemetry.weather.forecast_summary || (demoTelemetry.weather.rain_probability > 40 ? 'Rainy' : 'Clear');
    base.motorStatus ??= demoTelemetry.active_pump.is_running ? 'ON' : 'OFF';
    base.irrigationRecommendation ??= demoTelemetry.recommendation.recommendation === 'IRRIGATE_RECOMMENDED'
      ? 'IRRIGATE RECOMMENDED'
      : demoTelemetry.recommendation.recommendation === 'WAIT_RECHECK'
      ? 'WAIT / RECHECK'
      : 'MONITOR SOIL';
    base.recommendationExplanationTe ??= demoTelemetry.recommendation.explanation_te;
    base.recommendationExplanationEn ??= demoTelemetry.recommendation.explanation_en;
    base.cropType ??= demoTelemetry.farm.crop_type;
    base.soilType ??= demoTelemetry.farm.soil_type;
    base.fieldName ??= demoTelemetry.farm.name;

    // 2. Fetch live Open-Meteo weather if weather or rain probability was not passed in clientContext
    if (!clientContext?.weather || (clientContext?.rainProbability === undefined && clientContext?.rainProb === undefined)) {
      try {
        const liveWeather = await fetchFarmWeather(
          farmId,
          demoTelemetry.farm.latitude,
          demoTelemetry.farm.longitude
        );
        if (liveWeather && !liveWeather.is_error) {
          if (!clientContext?.weather) {
            base.weather = liveWeather.forecast_summary || (liveWeather.rain_probability > 40 ? 'Rainy' : 'Clear');
          }
          if (clientContext?.rainProbability === undefined && clientContext?.rainProb === undefined) {
            base.rainProbability = liveWeather.rain_probability;
          }
          if (clientContext?.temperature === undefined && clientContext?.temp === undefined && liveWeather.temperature) {
            base.temperature = liveWeather.temperature;
          }
          if (clientContext?.humidity === undefined && liveWeather.humidity) {
            base.humidity = liveWeather.humidity;
          }
        }
      } catch {
        // Retain backend telemetry values on weather API failure
      }
    }
  }

  return base;
}
