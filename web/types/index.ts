export type CropType = 'Paddy' | 'Cotton' | 'Chilli' | 'Maize' | 'Groundnut' | 'Vegetables' | 'Other';
export type SoilType = 'Black Soil' | 'Red Soil' | 'Alluvial Soil' | 'Sandy Loam' | 'Clay';
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'maintenance';
export type PumpAction = 'PUMP_ON' | 'PUMP_OFF' | 'EMERGENCY_STOP';
export type PumpSource = 'manual_web' | 'voice_te' | 'recommendation_confirmed' | 'safety_timeout' | 'pi_failsafe';
export type PumpStatus = 'pending' | 'active' | 'completed' | 'failed' | 'aborted';
export type RecommendationType = 'DO_NOT_IRRIGATE' | 'WAIT_RECHECK' | 'IRRIGATE_RECOMMENDED';
export type Language = 'te' | 'en';

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  preferred_language: Language;
  created_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  crop_type: CropType;
  soil_type: SoilType;
  target_moisture_min: number;
  target_moisture_max: number;
  created_at: string;
}

export interface FarmField {
  id: string;
  farm_id?: string;
  name: string;
  crop: string;
  area: string;
  coordinates: [number, number][]; // [lat, lng]
  center: {
    lat: number;
    lng: number;
  };
  created_at: string;
}

export interface Device {
  id: string;
  farm_id: string;
  device_name: string;
  device_type: 'gateway' | 'sensor_node' | 'valve_controller';
  status: DeviceStatus;
  ip_address?: string;
  firmware_version?: string;
  last_seen: string;
  created_at: string;
  is_stale?: boolean;
}

export interface SensorReading {
  id?: number | string;
  device_id: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  battery_level?: number;
  soil_raw?: number;
  recorded_at: string;
  is_stale?: boolean;
}

export interface PumpEvent {
  id: string;
  device_id: string;
  action: 'PUMP_ON' | 'PUMP_OFF';
  source: PumpSource;
  duration_seconds: number;
  started_at: string;
  stopped_at?: string;
  status: PumpStatus;
  notes?: string;
}

export interface WeatherData {
  id?: string;
  farm_id: string;
  temperature: number;
  humidity: number;
  rain_probability: number;
  precipitation_mm: number;
  precipitation_unknown?: boolean;
  wind_speed: number;
  weather_code?: number;
  forecast_summary?: string;
  forecast_time: string;
  hourly_forecast?: Array<{
    time: string;
    temp: number;
    rain_prob: number;
    precip_mm: number;
  }>;
  is_error?: boolean;
  is_stale?: boolean;
  error_message?: string;
}

export interface IrrigationRecommendation {
  id: string;
  farm_id: string;
  soil_moisture: number;
  rain_probability: number;
  precipitation_mm: number;
  recommendation: RecommendationType;
  explanation_en: string;
  explanation_te: string;
  suggested_duration_seconds: number;
  requires_confirmation: boolean;
  is_confirmed: boolean;
  expires_at: string;
  created_at: string;
}

export interface VoiceCommandLog {
  id: string;
  user_id: string;
  farm_id?: string;
  transcript: string;
  language: Language;
  interpreted_intent: string;
  parameters: Record<string, any>;
  execution_status: 'pending' | 'completed' | 'rejected' | 'failed';
  response_text_te: string;
  response_text_en?: string;
  created_at: string;
}

export interface TelemetrySummary {
  farm: Farm;
  device: Device;
  latest_sensor: SensorReading;
  active_pump: {
    is_running: boolean;
    remaining_seconds: number;
    elapsed_seconds: number;
    duration_seconds: number;
    cooldown_active: boolean;
    cooldown_remaining_seconds: number;
    total_runtime_today_seconds?: number;
    is_pending?: boolean;
    command_status?: string;
  };
  weather: WeatherData;
  recommendation: IrrigationRecommendation;
  is_demo_mode: boolean;
  source?: 'raspberry_pi' | 'local_demo';
  serial_connected?: boolean;
  serial_port_open?: boolean;
}

