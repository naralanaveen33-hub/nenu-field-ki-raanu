/**
 * Grok (xAI) Conversational AI Client for SmartFarm Voice Chatbot
 * 
 * STRICT ARCHITECTURAL BOUNDARIES:
 * - Grok is ONLY the conversational AI model for understanding farmer messages
 *   and generating natural conversational responses in Telugu and English.
 * - Grok must NEVER:
 *   * send Arduino commands
 *   * turn the motor on or off
 *   * change sensor values
 *   * change irrigation rules
 *   * call hardware functions
 *   * make autonomous farm decisions
 *   * modify system state
 * 
 * Flow:
 * USER MESSAGE -> EXISTING CHATBOT (/api/chat) -> GROK -> CHATBOT RESPONSE -> USER
 */

export interface FarmChatContext {
  soilMoisture?: number | string | null;
  temperature?: number | string;
  humidity?: number | string;
  weather?: string;
  rainProbability?: number | string;
  motorStatus?: 'ON' | 'OFF' | string;
  irrigationRecommendation?: string;
  recommendationExplanationTe?: string;
  recommendationExplanationEn?: string;
  cropType?: string;
  soilType?: string;
  fieldName?: string;
  fields?: Array<{
    id?: string;
    name: string;
    crop?: string;
    area?: string | number;
    area_acres?: number;
    coordinates?: any;
    center?: any;
  }>;
  temp?: number | string;
  rainProb?: number | string;
  pumpState?: boolean;
  recommendationType?: string;
}

export interface GrokChatbotRequest {
  message: string;
  context?: FarmChatContext;
  language?: 'te' | 'en';
}

export interface GrokChatbotResponse {
  success: boolean;
  reply: string;
  language: 'te' | 'en';
  reply_te: string;
  reply_en: string;
  model: string;
  raw?: string;
  error?: string;
  fallback?: boolean;
}

/**
 * Check if Grok is configured without exposing the key to client
 */
export function isGrokConfigured(): boolean {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const isSimulation = process.env.GROK_SIMULATE === 'true';
  return Boolean((apiKey && apiKey.trim().length > 0) || isSimulation);
}

/**
 * Sanitize text to ensure secret API keys are NEVER printed in logs
 */
function sanitizeLog(text: string, secret?: string): string {
  if (!secret || secret.trim().length < 4) return text;
  return text.split(secret).join('[REDACTED_KEY]');
}

/**
 * Detect language of farmer message based on Telugu Unicode range
 */
export function detectLanguage(text: string): 'te' | 'en' {
  const teluguCharRegex = /[\u0C00-\u0C7F]/;
  return teluguCharRegex.test(text) ? 'te' : 'en';
}

/**
 * Format read-only farm context for Grok system prompt
 */
export function formatFarmContext(ctx?: FarmChatContext): string {
  if (!ctx) return 'No live telemetry available.';

  const lines: string[] = [];

  if (ctx.fieldName) {
    lines.push(`Selected field: ${ctx.fieldName}`);
  }
  if (ctx.cropType) {
    lines.push(`Crop: ${ctx.cropType}`);
  }
  if (ctx.soilType) {
    lines.push(`Soil type: ${ctx.soilType}`);
  }
  if (ctx.fields && ctx.fields.length > 0) {
    lines.push('Saved farms/fields:');
    ctx.fields.forEach((f, i) => {
      lines.push(`  ${i + 1}. ${f.name} — Crop: ${f.crop || 'Crop'} — Area: ${f.area_acres || f.area || '1'} acre(s)`);
    });
  }

  const moisture = ctx.soilMoisture;
  if (moisture !== undefined && moisture !== null) {
    const val = typeof moisture === 'number' ? `${moisture}%` : `${moisture}`.includes('%') ? moisture : `${moisture}%`;
    lines.push(`Soil moisture: ${val}`);
  }

  const temp = ctx.temperature ?? ctx.temp;
  if (temp !== undefined) {
    const val = typeof temp === 'number' ? `${temp}°C` : `${temp}`.includes('°') ? temp : `${temp}°C`;
    lines.push(`Temperature: ${val}`);
  }

  const humidity = ctx.humidity;
  if (humidity !== undefined) {
    const val = typeof humidity === 'number' ? `${humidity}%` : `${humidity}`.includes('%') ? humidity : `${humidity}%`;
    lines.push(`Humidity: ${val}`);
  }

  if (ctx.weather) {
    lines.push(`Weather: ${ctx.weather}`);
  }

  const rainProb = ctx.rainProbability ?? ctx.rainProb;
  if (rainProb !== undefined) {
    const val = typeof rainProb === 'number' ? `${rainProb}%` : `${rainProb}`.includes('%') ? rainProb : `${rainProb}%`;
    lines.push(`Rain probability: ${val}`);
  }

  const motor = ctx.motorStatus ?? (ctx.pumpState !== undefined ? (ctx.pumpState ? 'ON' : 'OFF') : undefined);
  if (motor) {
    lines.push(`Motor status: ${motor}`);
  }

  const rec = ctx.irrigationRecommendation ?? ctx.recommendationType;
  if (rec) {
    lines.push(`Irrigation recommendation: ${rec}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No live telemetry available.';
}

/**
 * Build system prompt with strict boundary enforcement
 */
export function buildGrokSystemPrompt(ctx?: FarmChatContext): string {
  const formattedContext = formatFarmContext(ctx);

  return `You are Grok, the conversational AI for SmartFarm Voice (స్మార్ట్‌ఫామ్ వాయిస్).
Your ONLY task is to understand the farmer's question and generate a natural, respectful, and helpful conversational response.

READ-ONLY REAL-TIME FARM CONTEXT:
The system provides you with this live information. You MUST answer using ONLY these supplied values. NEVER invent sensor values, temperatures, or rain percentages:
${formattedContext}

STRICT SAFETY AND ARCHITECTURAL BOUNDARIES:
- You are SOLELY a conversational AI model.
- You have NO capability to control hardware, switch pumps, or send Arduino commands.
- Under NO circumstances can you execute actions or turn equipment on or off.
- If the farmer asks to turn the motor on (e.g. "turn motor on", "పంప్ ఆన్ చేయి", "మోటార్ వేయి"), DO NOT claim that you started it. Explain politely that pump activation requires their explicit confirmation on the dashboard Pump Controller card, and remind them of the current soil moisture.
- Arduino, motor control, sensor processing, irrigation decisions, weather, phone gateway, and automation are already handled by the existing Smart Farm system.

LANGUAGE RULES:
- If the farmer speaks or types in Telugu (e.g., "మట్టి తేమ ఎంత ఉంది?", "ఇప్పుడు నీరు పెట్టాలా?", "వర్షం పడుతుందా?"), you MUST respond in natural Telugu (తెలుగు).
- If the farmer speaks or types in English (e.g., "What is the soil moisture?", "Should I irrigate?"), you MUST respond in natural English.

INSTRUCTIONS FOR COMMON QUESTIONS:
- Soil moisture: Report the current soil moisture percentage from context.
- Weather or rain: Report the current temperature, weather conditions, and rain probability from context.
- "Should I irrigate?" / "ఇప్పుడు నీరు పెట్టాలా?": Answer based strictly on the Irrigation Recommendation and soil moisture provided above (e.g. if recommendation is "MONITOR SOIL", tell the farmer that moisture is being monitored and irrigation is not currently needed; if "IRRIGATE RECOMMENDED", explain that soil is dry and irrigation is recommended, but remind them to confirm via the dashboard pump button). Do NOT invent conflicting irrigation decisions.
- Motor status: Report whether the motor is ON or OFF based on context.

RESPONSE FORMAT:
Respond with a clean JSON object in this exact schema:
{
  "reply": "<Conversational response in the farmer's language (Telugu if input was Telugu, English if input was English)>",
  "language": "te" or "en",
  "reply_te": "<Natural Telugu version of the response>",
  "reply_en": "<Natural English version of the response>"
}`;
}

/**
 * Call Grok API via official xAI API endpoint
 */
export async function askGrokChatbot(req: GrokChatbotRequest): Promise<GrokChatbotResponse> {
  const userLang = req.language || detectLanguage(req.message);
  
  // Environment variables: prioritize XAI_API_KEY and XAI_MODEL
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const modelName = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-latest';
  const baseUrl = process.env.XAI_BASE_URL || process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1';

  // Check if simulated Grok mode is enabled for offline/test environments
  const isSimulation = process.env.GROK_SIMULATE === 'true' || apiKey === 'mock' || apiKey === 'test';

  if (isSimulation) {
    return generateSimulatedGrokResponse(req.message, req.context, userLang, modelName);
  }

  // If no API key is configured, signal fallback to existing local chatbot
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      reply: '',
      language: userLang,
      reply_te: '',
      reply_en: '',
      model: modelName,
      error: 'XAI_API_KEY not configured',
      fallback: true
    };
  }

  try {
    const systemPrompt = buildGrokSystemPrompt(req.context);

    // Call official xAI API endpoint
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.message }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      // 10 second timeout safety
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errText = await response.text();
      // Useful error logging without printing secret key
      const safeError = sanitizeLog(errText, apiKey);
      console.error(`[Grok Chatbot] xAI API error HTTP ${response.status}: ${safeError}`);
      return {
        success: false,
        reply: '',
        language: userLang,
        reply_te: '',
        reply_en: '',
        model: modelName,
        error: `xAI API returned status ${response.status}`,
        fallback: true
      };
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content || '';

    if (!content.trim()) {
      return {
        success: false,
        reply: '',
        language: userLang,
        reply_te: '',
        reply_en: '',
        model: modelName,
        error: 'Empty response content from xAI Grok',
        fallback: true
      };
    }

    return parseGrokContent(content, userLang, modelName);

  } catch (err: any) {
    // Log error safely without exposing key
    const safeError = sanitizeLog(err.message || 'Network exception', apiKey);
    console.error(`[Grok Chatbot] Connection failed: ${safeError}. Falling back to local assistant.`);
    return {
      success: false,
      reply: '',
      language: userLang,
      reply_te: '',
      reply_en: '',
      model: modelName,
      error: safeError,
      fallback: true
    };
  }
}

/**
 * Parse Grok's output content, handling JSON, code blocks, or raw text
 */
function parseGrokContent(rawContent: string, fallbackLang: 'te' | 'en', modelName: string): GrokChatbotResponse {
  // Try direct JSON
  try {
    const json = JSON.parse(rawContent.trim());
    if (json.reply) {
      const lang = json.language === 'te' || json.language === 'en' ? json.language : fallbackLang;
      return {
        success: true,
        reply: json.reply,
        language: lang,
        reply_te: json.reply_te || (lang === 'te' ? json.reply : ''),
        reply_en: json.reply_en || (lang === 'en' ? json.reply : ''),
        model: modelName,
        raw: rawContent
      };
    }
  } catch {
    // Attempt markdown regex extraction
    const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        const json = JSON.parse(match[1].trim());
        if (json.reply) {
          const lang = json.language === 'te' || json.language === 'en' ? json.language : fallbackLang;
          return {
            success: true,
            reply: json.reply,
            language: lang,
            reply_te: json.reply_te || (lang === 'te' ? json.reply : ''),
            reply_en: json.reply_en || (lang === 'en' ? json.reply : ''),
            model: modelName,
            raw: rawContent
          };
        }
      } catch {
        // Fall through to plain text
      }
    }
  }

  // Raw plain text response
  const cleaned = rawContent.replace(/```[a-z]*|```/gi, '').trim();
  const detected = detectLanguage(cleaned);

  return {
    success: true,
    reply: cleaned,
    language: detected,
    reply_te: detected === 'te' ? cleaned : '',
    reply_en: detected === 'en' ? cleaned : '',
    model: modelName,
    raw: rawContent
  };
}

/**
 * High-fidelity simulated Grok conversational generator for tests & offline sandbox
 * strictly adhering to prompt rules and read-only farm context
 */
function generateSimulatedGrokResponse(
  message: string,
  context: FarmChatContext = {},
  language: 'te' | 'en',
  modelName: string
): GrokChatbotResponse {
  const lower = message.toLowerCase();
  const moisture = context.soilMoisture !== undefined ? context.soilMoisture : 32;
  const temp = context.temperature ?? context.temp ?? 30;
  const humidity = context.humidity !== undefined ? context.humidity : 65;
  const weather = context.weather || 'Clear';
  const rainProb = context.rainProbability ?? context.rainProb ?? 20;
  const motor = context.motorStatus || (context.pumpState ? 'ON' : 'OFF');
  const rec = context.irrigationRecommendation ?? context.recommendationType ?? 'MONITOR SOIL';

  let replyTe = '';
  let replyEn = '';

  // 1. Motor activation requests (Grok must NOT execute action, must explain safety flow)
  if (lower.includes('turn motor on') || lower.includes('start pump') || lower.includes('పంప్ ఆన్') || lower.includes('మోటార్ వేయి') || lower.includes('మోటార్ ఆన్')) {
    replyTe = `భద్రతా నిబంధనల ప్రకారం, మోటార్ ప్రారంభించడానికి డ్యాష్‌బోర్డ్‌లోని "పంప్ కంట్రోల్" బటన్‌ను క్లిక్ చేసి నిర్ధారించండి. నేను సమాచారం అందించే అసిస్టెంట్‌ని మాత్రమే, నేరుగా మోటార్‌ను నియంత్రించలేను. ప్రస్తుతం మట్టి తేమ ${moisture}% ఉంది.`;
    replyEn = `For safety, please activate the pump directly using the Pump Controller on your dashboard. As an informational assistant, I cannot directly switch machinery. Current soil moisture is ${moisture}%.`;
  }
  // 2. Soil moisture questions ("What is the soil moisture?", "మట్టి తేమ ఎంత ఉంది?")
  else if (lower.includes('తేమ') || lower.includes('మట్టి') || lower.includes('moisture') || lower.includes('soil')) {
    replyTe = `ప్రస్తుతం మీ పొలంలో మట్టి తేమ ${moisture}% ఉంది.`;
    replyEn = `Current soil moisture in your field is ${moisture}%.`;
  }
  // 3. Irrigation decision questions ("Should I irrigate?", "ఇప్పుడు నీరు పెట్టాలా?", "నీరు పెట్టాలా?")
  else if (lower.includes('నీరు పెట్టాలా') || lower.includes('నీళ్లు పెట్టాలా') || lower.includes('irrigate') || lower.includes('water the')) {
    if (rec.includes('IRRIGATE_RECOMMENDED') || rec.includes('IRRIGATE')) {
      replyTe = `ప్రస్తుతం మట్టి తేమ ${moisture}% ఉంది. సిఫార్సు: IRRIGATE RECOMMENDED. పంటకు నీరు పెట్టడం మంచిది, దయచేసి డ్యాష్‌బోర్డ్‌లో పంప్ ప్రారంభించండి.`;
      replyEn = `Current soil moisture is low at ${moisture}%. System recommendation is IRRIGATE RECOMMENDED. You should irrigate your field.`;
    } else if (rec.includes('WAIT')) {
      replyTe = `వర్ష సూచన (${rainProb}%) ఉన్నందున ఇప్పుడే నీరు పెట్టవద్దు. సిఫార్సు ప్రకారం వేచి చూడండి.`;
      replyEn = `With a ${rainProb}% rain probability, system recommendation is WAIT/RECHECK. Irrigation should be delayed.`;
    } else {
      replyTe = `ప్రస్తుతం నీరు పెట్టాల్సిన అవసరం లేదు. మట్టి తేమ ${moisture}% ఉంది మరియు ప్రస్తుత సిఫార్సు: MONITOR SOIL.`;
      replyEn = `You do not need to irrigate right now. Soil moisture is at ${moisture}% and the current recommendation is MONITOR SOIL.`;
    }
  }
  // 4. Weather / Rain questions ("వర్షం పడుతుందా?", "వాతావరణం ఎలా ఉంది?")
  else if (lower.includes('వర్షం') || lower.includes('వాతావరణం') || lower.includes('weather') || lower.includes('rain') || lower.includes('temperature') || lower.includes('ఉష్ణోగ్రత')) {
    replyTe = `ఈరోజు వాతావరణం ${weather}గా ఉంది. ఉష్ణోగ్రత ${temp}°C, తేమ ${humidity}%, మరియు వర్షం పడే అవకాశం ${rainProb}% ఉంది.`;
    replyEn = `Today's weather is ${weather} with temperature at ${temp}°C, humidity at ${humidity}%, and a ${rainProb}% chance of rain.`;
  }
  // 5. Motor status questions
  else if (lower.includes('మోటార్') || lower.includes('పంప్') || lower.includes('motor') || lower.includes('pump')) {
    const motorTe = motor === 'ON' ? 'ఆన్ లో' : 'ఆఫ్ లో';
    replyTe = `ప్రస్తుతం నీటి మోటార్ ${motorTe} ఉంది.`;
    replyEn = `The water motor status is currently ${motor}.`;
  }
  // 6. Farm / Fields inquiries ("na farms ekkada unai", "నా ఫార్మ్స్ ఎక్కడ ఉన్నాయి?", "Where are my farms?")
  else if (
    lower.includes('farms ekkada') ||
    lower.includes('farm ekkada') ||
    lower.includes('polalu ekkada') ||
    lower.includes('పొలాలు ఎక్కడ') ||
    lower.includes('ఫార్మ్స్ ఎక్కడ') ||
    lower.includes('where are my farms') ||
    lower.includes('where is my farm') ||
    lower.includes('my farms') ||
    lower.includes('my fields')
  ) {
    const fieldsList = context.fields || [];
    if (fieldsList.length > 0) {
      const itemsTe = fieldsList.map((f, i) => `${i + 1}. ${f.name} — ${f.crop || 'పంట'} — ${f.area_acres || f.area || '1'} ఎకరం.`).join('\n');
      const itemsEn = fieldsList.map((f, i) => `${i + 1}. ${f.name} — ${f.crop || 'Crop'} — ${f.area_acres || f.area || '1'} acre(s).`).join('\n');
      replyTe = `మీరు సేవ్ చేసిన ఫార్మ్స్:\n\n${itemsTe}`;
      replyEn = `Your saved farms:\n\n${itemsEn}`;
    } else if (context.fieldName) {
      replyTe = `మీరు సేవ్ చేసిన ఫార్మ్: ${context.fieldName} (${context.cropType || 'పంట'}).`;
      replyEn = `Your saved farm is: ${context.fieldName} (${context.cropType || 'Crop'}).`;
    } else {
      replyTe = `మీరు ఇంకా ఏ ఫార్మ్ను సేవ్ చేయలేదు. ముందుగా మ్యాప్లో మీ ఫార్మ్ను గుర్తించి Save Field చేయండి.`;
      replyEn = `You have not saved any farms yet. Please locate your farm on the map and click Save Field.`;
    }
  }
  // General query
  else {
    replyTe = `నమస్కారం! మీ పొలంలో మట్టి తేమ ${moisture}%, ఉష్ణోగ్రత ${temp}°C, మరియు మోటార్ స్థితి ${motor} గా ఉంది. మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.`;
    replyEn = `Hello! In your field, soil moisture is ${moisture}%, temperature is ${temp}°C, and motor status is ${motor}. How can I help you today?`;
  }

  const primaryReply = language === 'te' ? replyTe : replyEn;

  return {
    success: true,
    reply: primaryReply,
    language,
    reply_te: replyTe,
    reply_en: replyEn,
    model: `${modelName} (simulated)`
  };
}
