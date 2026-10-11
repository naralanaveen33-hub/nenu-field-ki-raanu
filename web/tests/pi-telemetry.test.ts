import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapPiField, mapPiStatus } from '../lib/pi-telemetry';

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
