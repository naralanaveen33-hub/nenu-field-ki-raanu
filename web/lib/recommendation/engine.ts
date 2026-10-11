import type { IrrigationRecommendation, RecommendationType, WeatherData } from '@/types';

export interface RecommendationParams {
  farmId: string;
  soilMoisture: number;
  weather: WeatherData;
  targetMoistureMin?: number;
  targetMoistureMax?: number;
  lastPumpRunAgoMinutes?: number;
  cooldownMinutes?: number;
}

export function generateIrrigationRecommendation({
  farmId,
  soilMoisture,
  weather,
  targetMoistureMin = 30.0,
  targetMoistureMax = 65.0,
  lastPumpRunAgoMinutes = 9999,
  cooldownMinutes = 15
}: RecommendationParams): IrrigationRecommendation {
  const rainProb = weather.rain_probability;
  const precipMm = weather.precipitation_mm;
  const isRainLikely = rainProb >= 50 || precipMm >= 3.0;
  const isRecentIrrigation = lastPumpRunAgoMinutes < cooldownMinutes;

  let recommendation: RecommendationType = 'DO_NOT_IRRIGATE';
  let explanation_en = '';
  let explanation_te = '';
  let suggestedDurationSeconds = 300; // 5 mins default

  // Weather Data Guard: If weather service failed or coordinates were invalid,
  // DO NOT fabricate recommendations. Delay recommendation and instruct farmer to check soil physically.
  if (weather.is_error || weather.rain_probability < 0) {
    const now = new Date();
    return {
      id: `rec_${Date.now()}`,
      farm_id: farmId,
      soil_moisture: soilMoisture,
      rain_probability: 0,
      precipitation_mm: 0,
      recommendation: 'WAIT_RECHECK',
      explanation_en: 'Weather data is currently unavailable. Automated irrigation recommendation is paused to prevent over-watering if rain occurs. Please inspect soil physically before manual irrigation.',
      explanation_te: 'వాతావరణ వివరాలు అందుబాటులో లేవు. వర్ష సూచన తెలియకుండా నీరు పెట్టడం సరికాదు. దయచేసి పొలంలో నేల తేమను పరిశీలించి నిర్ణయం తీసుకోండి.',
      suggested_duration_seconds: 0,
      requires_confirmation: true, // STRICT SAFETY: Always requires confirmation
      is_confirmed: false,
      expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      created_at: now.toISOString()
    };
  }

  // CASE A: Soil Moisture is Sufficient / High
  if (soilMoisture >= targetMoistureMax) {
    recommendation = 'DO_NOT_IRRIGATE';
    explanation_en = `Soil moisture is high (${soilMoisture.toFixed(1)}%). Moisture is already sufficient for your crop.`;
    explanation_te = `నేలలో తేమ సమృద్ధిగా ఉంది (${soilMoisture.toFixed(1)}%). ప్రస్తుతానికి పంటకు నీరు అవసరం లేదు.`;
    suggestedDurationSeconds = 0;
  }
  // Moderate / Safe Zone
  else if (soilMoisture >= targetMoistureMin && soilMoisture < targetMoistureMax) {
    if (isRainLikely) {
      recommendation = 'DO_NOT_IRRIGATE';
      explanation_en = `Soil moisture is optimal (${soilMoisture.toFixed(1)}%) and rain is expected (${rainProb}% chance). No irrigation needed.`;
      explanation_te = `నేలలో తేమ సాధారణంగా ఉంది (${soilMoisture.toFixed(1)}%), అలాగే వర్షం పడే అవకాశం (${rainProb}%) ఉంది. నీరు పెట్టవద్దు.`;
      suggestedDurationSeconds = 0;
    } else {
      recommendation = 'DO_NOT_IRRIGATE';
      explanation_en = `Soil moisture is healthy (${soilMoisture.toFixed(1)}%). Irrigation is not required at this time.`;
      explanation_te = `నేలలో తగినంత తేమ ఉంది (${soilMoisture.toFixed(1)}%). ఇప్పుడు నీరు పెట్టాల్సిన అవసరం లేదు.`;
      suggestedDurationSeconds = 0;
    }
  }
  // Low Soil Moisture
  else {
    // Check if pump ran very recently
    if (isRecentIrrigation) {
      recommendation = 'WAIT_RECHECK';
      explanation_en = `Soil moisture is low (${soilMoisture.toFixed(1)}%), but irrigation was completed recently. Waiting for soil percolation.`;
      explanation_te = `నేలలో తేమ తక్కువగా ఉంది, కానీ కొద్దిసేపటి క్రితమే నీరు పెట్టారు. మట్టి తేమ పీల్చుకునే వరకు వేచి ఉండండి.`;
      suggestedDurationSeconds = 0;
    }
    // CASE B: Low moisture, but significant rain forecast
    else if (isRainLikely) {
      recommendation = 'WAIT_RECHECK';
      explanation_en = `Soil moisture is low (${soilMoisture.toFixed(1)}%), but rain is forecast (${rainProb}% chance, ~${precipMm.toFixed(1)}mm). Irrigation can be delayed to save electricity and water.`;
      explanation_te = `మట్టిలో తేమ తక్కువగా ఉంది (${soilMoisture.toFixed(1)}%), అయితే వర్షం పడే అవకాశం (${rainProb}%) ఉంది. వర్షం తర్వాత మళ్లీ పరిశీలించండి.`;
      suggestedDurationSeconds = 0;
    }
    // CASE C: Low moisture and NO rain expected -> Irrigation Recommended
    else {
      recommendation = 'IRRIGATE_RECOMMENDED';
      explanation_en = `Soil moisture is low (${soilMoisture.toFixed(1)}%) and no significant rain is expected (${rainProb}% chance). Timed irrigation is recommended.`;
      explanation_te = `మట్టిలో తేమ తక్కువగా ఉంది (${soilMoisture.toFixed(1)}%) మరియు వర్ష సూచన లేదు (${rainProb}%). పంట ఎండిపోకుండా నీరు పెట్టడం సిఫార్సు చేయబడింది.`;
      
      // Calculate suggested run duration based on dryness
      if (soilMoisture < 20) {
        suggestedDurationSeconds = 300; // 5 mins if very dry
      } else {
        suggestedDurationSeconds = 180; // 3 mins if moderately dry
      }
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hour validity

  return {
    id: `rec_${Date.now()}`,
    farm_id: farmId,
    soil_moisture: soilMoisture,
    rain_probability: rainProb,
    precipitation_mm: precipMm,
    recommendation,
    explanation_en,
    explanation_te,
    suggested_duration_seconds: suggestedDurationSeconds,
    requires_confirmation: true, // STRICT SAFETY: Always requires confirmation
    is_confirmed: false,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString()
  };
}
