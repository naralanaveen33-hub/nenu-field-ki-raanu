import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedLiveArduinoStatus, mapPiField, mapPiStatus } from '../lib/pi-telemetry';

const field = mapPiField({
  id: 'field-101', name: 'North Paddy Field', crop: 'Paddy', area_acres: 1,
  coordinates: [[17.386, 78.4855], [17.387, 78.487]],
});

const piStatus = {
  farm_selected: true, farm_id: 'field-101', farm_name: 'North Paddy Field',
  sensor_id: 'sensor_1', demo_mode: true, serial_connected: false,
  sensor: {
    farm_id: 'field-101', sensor_id: 'sensor_1', moisture: 24,
    temperature: 29, humidity: 68, last_updated: new Date().toISOString(),
  },
  motor: { is_on: false },
  weather: { condition: 'Clear Sky', temperature: 31, humidity: 40, rain_probability: 10, forecast: [] },
  recommendation: { recommendation: 'IRRIGATION RECOMMENDED', reason: 'Dry soil', reason_te: 'పొడి నేల' },
};

test('Pi status uses the selected farm and its sensor reading', () => {
  const telemetry = mapPiStatus(piStatus, field);
  assert.equal(telemetry.farm.id, 'field-101');
  assert.equal(telemetry.latest_sensor.soil_moisture, 24);
  assert.equal(telemetry.recommendation.recommendation, 'IRRIGATE_RECOMMENDED');
  assert.equal(telemetry.source, 'raspberry_pi');
  assert.equal(telemetry.serial_connected, false);
  assert.equal(telemetry.is_demo_mode, true);
});

test('Pi status rejects a response from another farm', () => {
  assert.throws(() => mapPiStatus({ ...piStatus, farm_id: 'field-102' }, field));
});

test('Pi JSON Arduino data preserves raw ADC without inventing a moisture percent', () => {
  const telemetry = mapPiStatus({
    ...piStatus,
    demo_mode: false,
    serial_connected: true,
    serial_port_open: true,
    sensor: {
      farm_id: 'field-101', sensor_id: 'sensor_1', moisture: null, soil_raw: 1008,
      temperature: 0, humidity: 0, motor: 0, source: 'arduino_json', is_demo: false,
      last_updated: new Date().toISOString(),
    },
    recommendation: {
      recommendation: 'SENSOR CALIBRATION REQUIRED',
      reason: 'Raw ADC has no percent calibration.', reason_te: '',
    },
  }, field);
  assert.equal(telemetry.latest_sensor.soil_moisture, null);
  assert.equal(telemetry.latest_sensor.soil_raw, 1008);
  assert.equal(telemetry.latest_sensor.temperature, 0);
  assert.equal(telemetry.latest_sensor.humidity, 0);
  assert.equal(telemetry.serial_connected, true);
  assert.equal(telemetry.is_demo_mode, false);
});

test('Pi calibrated Arduino percentage is passed through with the raw ADC', () => {
  const telemetry = mapPiStatus({
    ...piStatus,
    demo_mode: false,
    serial_connected: true,
    sensor: {
      farm_id: 'field-101', sensor_id: 'sensor_1', moisture: 0, soil_raw: 1003,
      temperature: 33.5, humidity: 66.9, motor: 0, source: 'arduino_json', is_demo: false,
      last_updated: new Date().toISOString(),
    },
  }, field);
  assert.equal(telemetry.latest_sensor.soil_moisture, 0);
  assert.equal(telemetry.latest_sensor.soil_raw, 1003);
});

test('farm-list fallback requires a live Arduino packet for the hardware field', () => {
  const liveStatus = {
    farm_selected: true, farm_id: 'field-101', demo_mode: false,
    serial_connected: true, serial_port_open: true, arduino_data_received: true,
    arduino_packet_sequence: 12,
    sensor: {
      farm_id: 'field-101', is_hardware: true, is_demo: false,
      source: 'arduino_json', soil_raw: 1001,
    },
  };
  assert.equal(hasVerifiedLiveArduinoStatus(liveStatus, 'field-101'), true);
  assert.equal(hasVerifiedLiveArduinoStatus({ ...liveStatus, demo_mode: true }, 'field-101'), false);
  assert.equal(hasVerifiedLiveArduinoStatus({ ...liveStatus, farm_id: 'field-102' }, 'field-101'), false);
  assert.equal(hasVerifiedLiveArduinoStatus({ ...liveStatus, serial_connected: false }, 'field-101'), false);
});
