import { NextRequest, NextResponse } from 'next/server';
import { askGrokChatbot, detectLanguage, isGrokConfigured, FarmChatContext } from '@/lib/ai/grok';
import { fetchLiveBackendFarmContext } from '@/lib/ai/farm-context';
import { parseTeluguVoiceTranscript, generateTeluguVoiceResponse } from '@/lib/voice/telugu_parser';

/**
 * GET /api/chat
 * Provides truthful chatbot status to frontend without exposing secret API keys
 */
export async function GET() {
  const isAvailable = isGrokConfigured();
  const model = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-latest';

  return NextResponse.json({
    configured: isAvailable,
    provider: isAvailable ? 'grok' : 'local_fallback',
    status: isAvailable ? 'available' : 'fallback',
    label: isAvailable ? 'Grok AI • Farm Assistant' : 'Local Assistant • Fallback',
    model
  });
}

/**
 * POST /api/chat
 * Primary SmartFarm Conversational AI Chatbot endpoint
 * Flow: USER MESSAGE -> EXISTING CHATBOT (/api/chat) -> GROK -> CHATBOT RESPONSE -> USER
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawMessage: string = body.message || body.transcript || body.text || '';
    const farmId: string = body.farm_id || '11111111-1111-1111-1111-111111111111';
    const deviceId: string = body.device_id || '22222222-2222-2222-2222-222222222222';

    if (!rawMessage.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // 1. Detect language (Telugu or English)
    const detectedLang = detectLanguage(rawMessage);

    // 2. Collect current live farm context from existing backend
    const farmContext: FarmChatContext = await fetchLiveBackendFarmContext(farmId, body.context);

    // 3. Parse intent for local safety awareness (Grok NEVER executes motor functions)
    const parsed = parseTeluguVoiceTranscript(rawMessage);

    // 4. Send message + farm context to Grok AI
    let primaryResponseText = '';
    let responseTextTe = '';
    let responseTextEn = '';
    let provider: 'grok' | 'local_fallback' = 'grok';
    let aiModel = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-latest';
    let statusLabel = 'Grok AI • Farm Assistant';

    const grokResult = await askGrokChatbot({
      message: rawMessage,
      context: farmContext,
      language: detectedLang
    });

    if (grokResult.success) {
      primaryResponseText = grokResult.reply;
      responseTextTe = grokResult.reply_te || (grokResult.language === 'te' ? grokResult.reply : '');
      responseTextEn = grokResult.reply_en || (grokResult.language === 'en' ? grokResult.reply : '');
      provider = 'grok';
      aiModel = grokResult.model;
      statusLabel = 'Grok AI • Farm Assistant';
    } else {
      // 5. Fallback to existing local chatbot if XAI_API_KEY is missing or Grok call fails
      provider = 'local_fallback';
      aiModel = 'local_rule_engine';
      statusLabel = 'Local Assistant • Fallback';

      const durationSeconds = parsed.parameters.duration_seconds || 300;
      const durationMins = Math.round(durationSeconds / 60);

      const fallback = generateTeluguVoiceResponse(parsed.intent, {
        soilMoisture: typeof farmContext.soilMoisture === 'number' ? farmContext.soilMoisture : Number(farmContext.soilMoisture) || 32,
        temp: typeof farmContext.temperature === 'number' ? farmContext.temperature : Number(farmContext.temperature) || 30,
        rainProb: typeof farmContext.rainProbability === 'number' ? farmContext.rainProbability : Number(farmContext.rainProbability) || 20,
        pumpState: farmContext.motorStatus === 'ON',
        recommendationType: farmContext.irrigationRecommendation,
        durationMinutes: durationMins
      });

      responseTextTe = fallback.text_te;
      responseTextEn = fallback.text_en;
      primaryResponseText = detectedLang === 'te' ? fallback.text_te : fallback.text_en;
    }

    // 6. Return compatible response object without Supabase dependency
    return NextResponse.json({
      message: rawMessage,
      transcript: rawMessage,
      response: primaryResponseText,
      response_text: primaryResponseText,
      response_text_te: responseTextTe,
      response_text_en: responseTextEn,
      language: detectedLang,
      provider,
      ai_model: aiModel,
      status_label: statusLabel,
      intent: parsed.intent,
      parameters: parsed.parameters,
      execution_status: 'completed',
      command_result: null
    });

  } catch (err: any) {
    console.error('[Chatbot Error]:', err.message || err);
    return NextResponse.json({ error: err.message || 'Chatbot processing error' }, { status: 500 });
  }
}
