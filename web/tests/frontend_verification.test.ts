import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getMoistureStatus, calculatePolygonCenter, calculatePolygonAreaAcres } from '../lib/utils';

describe('Frontend & Map Logic Verification', () => {
  test('Moisture status returns 4 tiers (Dry, Moderate, Good, Wet) with Telugu labels', () => {
    // 1. Dry
    const dry = getMoistureStatus(18, 30, 65);
    assert.strictEqual(dry.level, 'Dry');
    assert.strictEqual(dry.label_en, 'Dry');
    assert.ok(dry.label_te.includes('పొడి'));

    // 2. Moderate
    const mod = getMoistureStatus(26, 30, 65);
    assert.strictEqual(mod.level, 'Moderate');
    assert.strictEqual(mod.label_en, 'Moderate');
    assert.ok(mod.label_te.includes('మధ్యస్థం'));

    // 3. Good
    const good = getMoistureStatus(45, 30, 65);
    assert.strictEqual(good.level, 'Good');
    assert.strictEqual(good.label_en, 'Good');
    assert.ok(good.label_te.includes('మంచిది'));

    // 4. Wet
    const wet = getMoistureStatus(75, 30, 65);
    assert.strictEqual(wet.level, 'Wet');
    assert.strictEqual(wet.label_en, 'Wet');
    assert.ok(wet.label_te.includes('తడి'));
  });

  test('Polygon center calculation computes accurate centroid', () => {
    const coords: [number, number][] = [
      [17.6860, 83.2180],
      [17.6876, 83.2180],
      [17.6876, 83.2190],
      [17.6860, 83.2190]
    ];
    const center = calculatePolygonCenter(coords);
    assert.strictEqual(center.lat, 17.6868);
    assert.strictEqual(center.lng, 83.2185);
  });

  test('Polygon area calculation returns positive area in acres', () => {
    const coords: [number, number][] = [
      [17.6860, 83.2180],
      [17.6876, 83.2180],
      [17.6876, 83.2190],
      [17.6860, 83.2190]
    ];
    const acres = calculatePolygonAreaAcres(coords);
    assert.ok(acres > 0, `Expected area > 0, got ${acres}`);
  });
});
