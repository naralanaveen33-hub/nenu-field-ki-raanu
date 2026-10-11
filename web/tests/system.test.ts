import test from 'node:test';
import assert from 'node:assert/strict';

import { generateIrrigationRecommendation } from '../lib/recommendation/engine.ts';
import { parseTeluguVoiceTranscript } from '../lib/voice/telugu_parser.ts';
import { executePumpCommand } from '../lib/commands/executor.ts';
import type { WeatherData } from '../types/index.ts';

test('1. Irrigation Recommendation - High Soil Moisture (>65%)', () => {
  const weather: WeatherData = {
    farm_id: 'farm-1',
    temperature: 30.0,
    humidity: 60.0,
    rain_probability: 10,
    precipitation_mm: 0,
    wind_speed: 5.0,
    forecast_time: new Date().toISOString()
  };

  const rec = generateIrrigationRecommendation({
    farmId: 'farm-1',
    soilMoisture: 72.0,
    weather,
    targetMoistureMin: 30.0,
    targetMoistureMax: 65.0
  });

  assert.equal(rec.recommendation, 'DO_NOT_IRRIGATE');
  assert.equal(rec.suggested_duration_seconds, 0);
  assert.equal(rec.requires_confirmation, true);
  assert.equal(rec.is_confirmed, false);
});

test('2. Irrigation Recommendation - Low Moisture with Rain Forecast (Delay/Wait)', () => {
  const weather: WeatherData = {
    farm_id: 'farm-1',
    temperature: 28.0,
    humidity: 85.0,
    rain_probability: 75,
    precipitation_mm: 12.0,
    wind_speed: 15.0,
    forecast_time: new Date().toISOString()
  };

  const rec = generateIrrigationRecommendation({
    farmId: 'farm-1',
    soilMoisture: 22.0,
    weather,
    targetMoistureMin: 30.0,
    targetMoistureMax: 65.0
  });

  assert.equal(rec.recommendation, 'WAIT_RECHECK');
  assert.equal(rec.suggested_duration_seconds, 0);
  assert.equal(rec.requires_confirmation, true);
});

test('3. Irrigation Recommendation - Low Moisture without Rain (Irrigate Recommended)', () => {
  const weather: WeatherData = {
    farm_id: 'farm-1',
    temperature: 34.0,
    humidity: 40.0,
    rain_probability: 10,
    precipitation_mm: 0,
    wind_speed: 6.0,
    forecast_time: new Date().toISOString()
  };

  const rec = generateIrrigationRecommendation({
    farmId: 'farm-1',
    soilMoisture: 18.5,
    weather,
    targetMoistureMin: 30.0,
    targetMoistureMax: 65.0
  });

  assert.equal(rec.recommendation, 'IRRIGATE_RECOMMENDED');
  assert.equal(rec.suggested_duration_seconds, 300);
  // STRICT SAFETY: Must ALWAYS require explicit farmer confirmation
  assert.equal(rec.requires_confirmation, true);
  assert.equal(rec.is_confirmed, false);
});

test('4. Irrigation Recommendation - Weather Failure Guard (No Fabricated Actions)', () => {
  const failedWeather: WeatherData = {
    farm_id: 'farm-1',
    temperature: 0,
    humidity: 0,
    rain_probability: -1,
    precipitation_mm: 0,
    wind_speed: 0,
    forecast_time: new Date().toISOString(),
    is_error: true,
    error_message: 'Open-Meteo timeout'
  };

  const rec = generateIrrigationRecommendation({
    farmId: 'farm-1',
    soilMoisture: 15.0, // dry soil, but weather is unknown!
    weather: failedWeather
  });

  // Must NOT recommend irrigation when weather is unknown
  assert.equal(rec.recommendation, 'WAIT_RECHECK');
  assert.equal(rec.suggested_duration_seconds, 0);
  assert.match(rec.explanation_en, /Weather data is currently unavailable/);
});

test('5. Telugu Voice Command Parsing - PUMP_ON Intent', () => {
  const parsed1 = parseTeluguVoiceTranscript('మోటార్ ఆన్ చేయి');
  assert.equal(parsed1.intent, 'PUMP_ON');
  assert.ok(parsed1.confidence >= 0.9);

  const parsed2 = parseTeluguVoiceTranscript('నీరు పెట్టు 10 నిమిషాలు');
  assert.equal(parsed2.intent, 'PUMP_ON');
  assert.equal(parsed2.parameters.duration_seconds, 600);
});

test('6. Telugu Voice Command Parsing - PUMP_OFF Intent', () => {
  const parsed = parseTeluguVoiceTranscript('మోటార్ బంద్ చేయి');
  assert.equal(parsed.intent, 'PUMP_OFF');
  assert.ok(parsed.confidence >= 0.9);
});

test('7. Telugu Voice Command Parsing - GET_SOIL_MOISTURE / Status Intent', () => {
  const parsed = parseTeluguVoiceTranscript('పొలం పరిస్థితి ఎలా ఉంది?');
  assert.equal(parsed.intent, 'GET_SOIL_MOISTURE');
});

test('8. Telugu Voice Command Parsing - GET_RECOMMENDATION Intent', () => {
  const parsed = parseTeluguVoiceTranscript('నీరు పెట్టాలా?');
  assert.equal(parsed.intent, 'GET_RECOMMENDATION');
});

test('9. Command Executor - Duration Bounds Validation', async () => {
  // Duration <= 0 must be rejected
  const resNegative = await executePumpCommand({
    deviceId: 'test-device-uuid-1',
    action: 'PUMP_ON',
    durationSeconds: 0,
    source: 'manual_web',
    bypassRateLimit: true
  });
  assert.equal(resNegative.success, false);
  assert.equal(resNegative.status, 'REJECTED');
  assert.match(resNegative.error || '', /between 1 and 900 seconds/);

  // Duration > 900 must be rejected
  const resExcess = await executePumpCommand({
    deviceId: 'test-device-uuid-1',
    action: 'PUMP_ON',
    durationSeconds: 1200,
    source: 'manual_web',
    bypassRateLimit: true
  });
  assert.equal(resExcess.success, false);
  assert.equal(resExcess.status, 'REJECTED');
});

test('10. Command Executor - Invalid Action Rejection', async () => {
  const resInvalid = await executePumpCommand({
    deviceId: 'test-device-uuid-2',
    action: 'UNKNOWN_ACTION' as any,
    source: 'manual_web',
    bypassRateLimit: true
  });
  assert.equal(resInvalid.success, false);
  assert.equal(resInvalid.status, 'REJECTED');
  assert.match(resInvalid.error || '', /Invalid pump action/);
});

test('11. Command Executor - Rate Limiting Debounce', async () => {
  const devId = 'rate-limit-test-dev';

  // First command
  const res1 = await executePumpCommand({
    deviceId: devId,
    action: 'PUMP_OFF',
    source: 'manual_web'
  });
  assert.equal(res1.status === 'REJECTED' && res1.error?.includes('Rate limit'), false);

  // Immediate second command within 3000ms must be rate-limited
  const res2 = await executePumpCommand({
    deviceId: devId,
    action: 'PUMP_OFF',
    source: 'manual_web'
  });
  assert.equal(res2.success, false);
  assert.equal(res2.status, 'REJECTED');
  assert.match(res2.error || '', /Rate limit/);
});
