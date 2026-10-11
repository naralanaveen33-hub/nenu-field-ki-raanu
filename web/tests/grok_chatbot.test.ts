import test from 'node:test';
import assert from 'node:assert/strict';

import {
  askGrokChatbot,
  buildGrokSystemPrompt,
  detectLanguage,
  formatFarmContext,
  isGrokConfigured,
  FarmChatContext
} from '../lib/ai/grok';

const testContext: FarmChatContext = {
  soilMoisture: 32,
  temperature: 30,
  humidity: 65,
  weather: 'Clear',
  rainProbability: 20,
  motorStatus: 'OFF',
  irrigationRecommendation: 'MONITOR SOIL'
};

test('1. Language Detection - Telugu and English', () => {
  assert.equal(detectLanguage('మట్టి తేమ ఎంత ఉంది?'), 'te');
  assert.equal(detectLanguage('ఇప్పుడు నీరు పెట్టాలా?'), 'te');
  assert.equal(detectLanguage('వర్షం పడుతుందా?'), 'te');
  assert.equal(detectLanguage('Should I irrigate?'), 'en');
  assert.equal(detectLanguage('What is the soil moisture?'), 'en');
  assert.equal(detectLanguage('turn motor on'), 'en');
});

test('2. Read-Only Farm Context Formatting - Verifies all required context fields', () => {
  const formatted = formatFarmContext(testContext);

  assert.match(formatted, /Soil moisture: 32%/);
  assert.match(formatted, /Temperature: 30°C/);
  assert.match(formatted, /Humidity: 65%/);
  assert.match(formatted, /Weather: Clear/);
  assert.match(formatted, /Rain probability: 20%/);
  assert.match(formatted, /Motor status: OFF/);
  assert.match(formatted, /Irrigation recommendation: MONITOR SOIL/);
});

test('3. Grok System Prompt - Strict Safety Boundaries & Hardware Isolation', () => {
  const prompt = buildGrokSystemPrompt(testContext);

  assert.match(prompt, /Your ONLY task is to understand the farmer's question/i);
  assert.match(prompt, /NEVER invent sensor values/i);
  assert.match(prompt, /NO capability to control hardware/i);
  assert.match(prompt, /turn the motor on/i);
});

test('4. Test Phrase 1: "What is the soil moisture?" (EN)', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'What is the soil moisture?',
    context: testContext,
    language: 'en'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'en');
  assert.match(res.reply, /32%/, 'Must answer with 32% soil moisture from live context');
  assert.match(res.reply, /soil moisture/i);
});

test('5. Test Phrase 2: "మట్టి తేమ ఎంత ఉంది?" (TE)', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'మట్టి తేమ ఎంత ఉంది?',
    context: testContext,
    language: 'te'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'te');
  assert.match(res.reply, /[\u0C00-\u0C7F]/, 'Must be in Telugu');
  assert.match(res.reply, /32/, 'Must include 32% soil moisture from context');
});

test('6. Test Phrase 3: "Should I irrigate?" (EN)', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'Should I irrigate?',
    context: testContext,
    language: 'en'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'en');
  assert.match(res.reply, /32%/, 'Must mention 32%');
  assert.match(res.reply, /MONITOR SOIL/i, 'Must reference MONITOR SOIL recommendation');
});

test('7. Test Phrase 4: "ఇప్పుడు నీరు పెట్టాలా?" (TE)', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'ఇప్పుడు నీరు పెట్టాలా?',
    context: testContext,
    language: 'te'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'te');
  assert.match(res.reply, /[\u0C00-\u0C7F]/, 'Must be in Telugu');
  assert.match(res.reply, /32/, 'Must mention 32%');
  assert.match(res.reply, /MONITOR SOIL/, 'Must mention MONITOR SOIL');
});

test('8. Test Phrase 5: "వర్షం పడుతుందా?" (TE)', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'వర్షం పడుతుందా?',
    context: testContext,
    language: 'te'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'te');
  assert.match(res.reply, /[\u0C00-\u0C7F]/, 'Must be in Telugu');
  assert.match(res.reply, /20/, 'Must mention 20% rain probability from context');
});

test('9. Action Execution Prevention: "turn motor on" must explain safety flow without executing actions', async () => {
  process.env.GROK_SIMULATE = 'true';
  const res = await askGrokChatbot({
    message: 'turn motor on',
    context: testContext,
    language: 'en'
  });

  assert.equal(res.success, true);
  assert.equal(res.language, 'en');
  assert.match(res.reply, /safety/i, 'Must explain safety flow');
  assert.match(res.reply, /Pump Controller/i, 'Must point to dashboard pump controller');
});

test('10. Fallback Chatbot Behavior - When API key is missing and simulation disabled', async () => {
  delete process.env.GROK_SIMULATE;
  const savedKey = process.env.XAI_API_KEY;
  const savedGrokKey = process.env.GROK_API_KEY;
  delete process.env.XAI_API_KEY;
  delete process.env.GROK_API_KEY;

  assert.equal(isGrokConfigured(), false);

  const res = await askGrokChatbot({
    message: 'మట్టి తేమ ఎంత ఉంది?',
    context: testContext
  });

  assert.equal(res.success, false);
  assert.equal(res.fallback, true);
  assert.match(res.error || '', /XAI_API_KEY not configured/);

  // Restore env
  if (savedKey) process.env.XAI_API_KEY = savedKey;
  if (savedGrokKey) process.env.GROK_API_KEY = savedGrokKey;
  process.env.GROK_SIMULATE = 'true';
});

import { fetchLiveBackendFarmContext } from '../lib/ai/farm-context';

test('11. Live Backend Farm Context Engine - Resolves farm data without Supabase', async () => {
  const liveContext = await fetchLiveBackendFarmContext('test-farm-id');

  assert.ok(liveContext.soilMoisture !== undefined, 'Soil moisture must be present');
  assert.ok(liveContext.temperature !== undefined, 'Temperature must be present');
  assert.ok(liveContext.humidity !== undefined, 'Humidity must be present');
  assert.ok(liveContext.weather, 'Weather must be present');
  assert.ok(liveContext.rainProbability !== undefined, 'Rain probability must be present');
  assert.ok(liveContext.motorStatus, 'Motor status must be present');
  assert.ok(liveContext.irrigationRecommendation, 'Irrigation recommendation must be present');
  assert.ok(liveContext.fieldName, 'Field name must be present');
  assert.ok(liveContext.cropType, 'Crop type must be present');
  assert.ok(liveContext.soilType, 'Soil type must be present');
});

test('12. Verification of all 6 Required Phrases against Live Backend Context', async () => {
  process.env.GROK_SIMULATE = 'true';

  // Live telemetry state from backend telemetry engine
  const liveContext = await fetchLiveBackendFarmContext('test-farm-id');

  // 1. "What is the soil moisture?"
  const q1 = await askGrokChatbot({
    message: 'What is the soil moisture?',
    context: liveContext,
    language: 'en'
  });
  assert.equal(q1.success, true);
  assert.match(q1.reply, new RegExp(`${liveContext.soilMoisture}%`), 'Must reflect live soil moisture');

  // 2. "మట్టి తేమ ఎంత ఉంది?"
  const q2 = await askGrokChatbot({
    message: 'మట్టి తేమ ఎంత ఉంది?',
    context: liveContext,
    language: 'te'
  });
  assert.equal(q2.success, true);
  assert.match(q2.reply, new RegExp(`${liveContext.soilMoisture}`), 'Must reflect live soil moisture in Telugu');

  // 3. "Should I irrigate?"
  const q3 = await askGrokChatbot({
    message: 'Should I irrigate?',
    context: liveContext,
    language: 'en'
  });
  assert.equal(q3.success, true);
  assert.match(q3.reply, /IRRIGATE RECOMMENDED|MONITOR SOIL|WAIT/i, 'Must use live recommendation');

  // 4. "ఇప్పుడు నీరు పెట్టాలా?"
  const q4 = await askGrokChatbot({
    message: 'ఇప్పుడు నీరు పెట్టాలా?',
    context: liveContext,
    language: 'te'
  });
  assert.equal(q4.success, true);
  assert.match(q4.reply, /[\u0C00-\u0C7F]/, 'Must be in Telugu');
  assert.match(q4.reply, /IRRIGATE RECOMMENDED|MONITOR SOIL|వేచి/i, 'Must use live recommendation');

  // 5. "వర్షం పడుతుందా?"
  const q5 = await askGrokChatbot({
    message: 'వర్షం పడుతుందా?',
    context: liveContext,
    language: 'te'
  });
  assert.equal(q5.success, true);
  assert.match(q5.reply, /[\u0C00-\u0C7F]/, 'Must be in Telugu');
  assert.match(q5.reply, new RegExp(`${liveContext.rainProbability}`), 'Must reflect live rain probability');

  // 6. "turn motor on" - Grok remains ONLY chatbot AI, no hardware control
  const q6 = await askGrokChatbot({
    message: 'turn motor on',
    context: liveContext,
    language: 'en'
  });
  assert.equal(q6.success, true);
  assert.match(q6.reply, /safety/i, 'Must explain safety confirmation flow');
  assert.match(q6.reply, /Pump Controller/i, 'Must direct farmer to dashboard Pump Controller');
  assert.match(q6.reply, new RegExp(`${liveContext.soilMoisture}%`), 'Must report live soil moisture');
});

