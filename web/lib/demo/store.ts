import { 
  Farm, 
  Device, 
  SensorReading, 
  WeatherData, 
  IrrigationRecommendation, 
  PumpEvent, 
  VoiceCommandLog,
  TelemetrySummary
} from '@/types';
import { generateIrrigationRecommendation } from '../recommendation/engine';

export interface DemoState {
  isDemoMode: boolean;
  farm: Farm;
  device: Device;
  soilMoisture: number;
  temperature: number;
  humidity: number;
  isRainSimulated: boolean;
  rainProbability: number;
  precipitationMm: number;
  
  // Pump state
  isPumpRunning: boolean;
  pumpDurationSeconds: number;
  pumpStartedAt: number | null;
  pumpSecondsRemaining: number;
  lastPumpStopAt: number | null;
  totalRuntimeTodaySeconds: number;
  cooldownSeconds: number;

  // Logs
  recentPumpEvents: PumpEvent[];
  recentVoiceLogs: VoiceCommandLog[];
}

export const INITIAL_DEMO_FARM: Farm = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '00000000-0000-0000-0000-000000000001',
  name: 'గోదావరి హరిత క్షేత్రం (Godavari Green Farm)',
  latitude: 16.5062,
  longitude: 80.6480,
  crop_type: 'Chilli',
  soil_type: 'Black Soil',
  target_moisture_min: 30.0,
  target_moisture_max: 65.0,
  created_at: new Date().toISOString()
};

export const INITIAL_DEMO_DEVICE: Device = {
  id: '22222222-2222-2222-2222-222222222222',
  farm_id: '11111111-1111-1111-1111-111111111111',
  device_name: 'Raspberry Pi 5 Gateway #1',
  device_type: 'gateway',
  status: 'online',
  ip_address: '192.168.1.150',
  firmware_version: '2.1.0-pi5',
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString()
};

export function getInitialDemoState(): DemoState {
  return {
    isDemoMode: true,
    farm: INITIAL_DEMO_FARM,
    device: INITIAL_DEMO_DEVICE,
    soilMoisture: 22.4, // Intentionally dry to demonstrate recommendation
    temperature: 28.5,
    humidity: 68.0,
    isRainSimulated: false,
    rainProbability: 12.0,
    precipitationMm: 0.0,

    isPumpRunning: false,
    pumpDurationSeconds: 180,
    pumpStartedAt: null,
    pumpSecondsRemaining: 0,
    lastPumpStopAt: null,
    totalRuntimeTodaySeconds: 480,
    cooldownSeconds: 600,

    recentPumpEvents: [
      {
        id: 'pe_seed_1',
        device_id: INITIAL_DEMO_DEVICE.id,
        action: 'PUMP_OFF',
        source: 'voice_te',
        duration_seconds: 300,
        started_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        stopped_at: new Date(Date.now() - 3600000 * 24 + 300000).toISOString(),
        status: 'completed',
        notes: 'Telugu voice command confirmed (5 mins)'
      },
      {
        id: 'pe_seed_2',
        device_id: INITIAL_DEMO_DEVICE.id,
        action: 'PUMP_OFF',
        source: 'manual_web',
        duration_seconds: 180,
        started_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        stopped_at: new Date(Date.now() - 3600000 * 48 + 180000).toISOString(),
        status: 'completed',
        notes: 'Manual dashboard irrigation'
      }
    ],

    recentVoiceLogs: [
      {
        id: 'vl_seed_1',
        user_id: INITIAL_DEMO_FARM.user_id,
        farm_id: INITIAL_DEMO_FARM.id,
        transcript: 'నేలలో తేమ ఎంత ఉంది?',
        language: 'te',
        interpreted_intent: 'GET_SOIL_MOISTURE',
        parameters: {},
        execution_status: 'completed',
        response_text_te: 'ప్రస్తుతం మీ నేలలో తేమ 22.4 శాతం మాత్రమే ఉంది. మట్టి పొడిగా ఉంది.',
        created_at: new Date(Date.now() - 600000).toISOString()
      }
    ]
  };
}

export function computeDemoTelemetry(state: DemoState): TelemetrySummary {
  const weather: WeatherData = {
    farm_id: state.farm.id,
    temperature: state.temperature,
    humidity: state.humidity,
    rain_probability: state.isRainSimulated ? 85.0 : state.rainProbability,
    precipitation_mm: state.isRainSimulated ? 14.5 : state.precipitationMm,
    wind_speed: 8.5,
    weather_code: state.isRainSimulated ? 63 : 1,
    forecast_summary: state.isRainSimulated 
      ? 'భారీ వర్షం పడే అవకాశం ఉంది (85%). వర్షపాతం: ~14.5mm'
      : 'ఆకాశం నిర్మలంగా ఉంటుంది. వర్ష సూచన తక్కువ (12%).',
    forecast_time: new Date().toISOString(),
    hourly_forecast: [
      { time: '12:00', temp: 30, rain_prob: state.isRainSimulated ? 80 : 10, precip_mm: state.isRainSimulated ? 4 : 0 },
      { time: '15:00', temp: 28, rain_prob: state.isRainSimulated ? 90 : 15, precip_mm: state.isRainSimulated ? 8 : 0 },
      { time: '18:00', temp: 26, rain_prob: state.isRainSimulated ? 65 : 10, precip_mm: state.isRainSimulated ? 2 : 0 },
      { time: '21:00', temp: 25, rain_prob: state.isRainSimulated ? 40 : 5, precip_mm: 0 }
    ]
  };

  const minutesSinceLastStop = state.lastPumpStopAt 
    ? (Date.now() - state.lastPumpStopAt) / 60000 
    : 9999;

  const recommendation = generateIrrigationRecommendation({
    farmId: state.farm.id,
    soilMoisture: state.soilMoisture,
    weather,
    targetMoistureMin: state.farm.target_moisture_min,
    targetMoistureMax: state.farm.target_moisture_max,
    lastPumpRunAgoMinutes: minutesSinceLastStop,
    cooldownMinutes: Math.round(state.cooldownSeconds / 60)
  });

  const now = Date.now();
  let remaining = 0;
  let elapsed = 0;

  if (state.isPumpRunning && state.pumpStartedAt) {
    elapsed = Math.floor((now - state.pumpStartedAt) / 1000);
    remaining = Math.max(0, state.pumpDurationSeconds - elapsed);
  }

  const cooldownRemaining = (!state.isPumpRunning && state.lastPumpStopAt)
    ? Math.max(0, state.cooldownSeconds - Math.floor((now - state.lastPumpStopAt) / 1000))
    : 0;

  const latest_sensor: SensorReading = {
    device_id: state.device.id,
    temperature: state.temperature,
    humidity: state.humidity,
    soil_moisture: state.soilMoisture,
    battery_level: 98,
    recorded_at: new Date().toISOString()
  };

  return {
    farm: state.farm,
    device: state.device,
    latest_sensor,
    active_pump: {
      is_running: state.isPumpRunning,
      remaining_seconds: remaining,
      elapsed_seconds: elapsed,
      duration_seconds: state.pumpDurationSeconds,
      cooldown_active: cooldownRemaining > 0,
      cooldown_remaining_seconds: cooldownRemaining
    },
    weather,
    recommendation,
    is_demo_mode: state.isDemoMode
  };
}
