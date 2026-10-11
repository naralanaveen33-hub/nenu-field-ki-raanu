import { NextRequest, NextResponse } from 'next/server';
import { parseTeluguVoiceTranscript, generateTeluguVoiceResponse } from '@/lib/voice/telugu_parser';
import { executePumpCommand } from '@/lib/commands/executor';
import { askGrokChatbot, detectLanguage, FarmChatContext } from '@/lib/ai/grok';
import { fetchLiveBackendFarmContext } from '@/lib/ai/farm-context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript: string = body.transcript || body.message || '';
    const farmId: string = body.farm_id || '11111111-1111-1111-1111-111111111111';
    const deviceId: string = body.device_id || '22222222-2222-2222-2222-222222222222';
    const context = body.context || {};

    if (!transcript.trim()) {
      return NextResponse.json({ error: 'Empty transcript received' }, { status: 400 });
    }

    // 1. Detect user language: Telugu or English
    const detectedLang = detectLanguage(transcript);

    // 2. Existing intent parsing for existing hardware command safety rules
    // (Grok NEVER executes hardware commands or touches Arduino)
    const parsed = parseTeluguVoiceTranscript(transcript);

    let commandResult = null;
    let executionStatus: 'completed' | 'pending' | 'rejected' = 'completed';
    const durationSeconds = parsed.parameters.duration_seconds || 300;
    const durationMins = Math.round(durationSeconds / 60);

    if (parsed.intent === 'PUMP_ON' || parsed.intent === 'CONFIRM_IRRIGATION') {
      commandResult = await executePumpCommand({
        deviceId,
        action: 'PUMP_ON',
        durationSeconds,
        source: 'voice_te',
        notes: `Farmer Voice/Chat: "${transcript}"`
      });
      executionStatus = commandResult.success ? 'pending' : 'rejected';

    } else if (parsed.intent === 'PUMP_OFF' || parsed.intent === 'CANCEL_IRRIGATION') {
      commandResult = await executePumpCommand({
        deviceId,
        action: 'PUMP_OFF',
        durationSeconds: 0,
        source: 'voice_te',
        notes: `Farmer Voice/Chat Stop: "${transcript}"`
      });
      executionStatus = commandResult.success ? 'pending' : 'rejected';
    }

    // 3. Prepare read-only farm context from live backend telemetry engine (No Supabase)
    const farmContext: FarmChatContext = await fetchLiveBackendFarmContext(farmId, context);

    // 4. Connect Existing Chatbot to Grok API
    // USER MESSAGE -> EXISTING CHATBOT -> GROK -> CHATBOT RESPONSE -> USER
    let responseTextTe = '';
    let responseTextEn = '';
    let primaryResponseText = '';
    let aiModel = 'grok';

    const grokResult = await askGrokChatbot({
      message: transcript,
      context: farmContext,
      language: detectedLang
    });

    if (grokResult.success) {
      primaryResponseText = grokResult.reply;
      responseTextTe = grokResult.reply_te || (grokResult.language === 'te' ? grokResult.reply : '');
      responseTextEn = grokResult.reply_en || (grokResult.language === 'en' ? grokResult.reply : '');
      aiModel = grokResult.model || 'grok';
    } else {
      // 5. Existing Fallback Chatbot if Grok is unavailable (no API key, offline, timeout)
      console.warn(`[Chatbot] Grok unavailable (${grokResult.error}). Using existing fallback chatbot.`);
      const fallback = generateTeluguVoiceResponse(parsed.intent, {
        ...context,
        durationMinutes: durationMins
      });
      responseTextTe = fallback.text_te;
      responseTextEn = fallback.text_en;
      primaryResponseText = detectedLang === 'te' ? fallback.text_te : fallback.text_en;
      aiModel = 'fallback_rule_based';
    }

    // 6. Return response maintaining full frontend compatibility (No Supabase)
    return NextResponse.json({
      transcript,
      intent: parsed.intent,
      parameters: parsed.parameters,
      execution_status: executionStatus,
      command_result: commandResult,
      response_text_te: responseTextTe,
      response_text_en: responseTextEn,
      response_text: primaryResponseText,
      language: detectedLang,
      ai_model: aiModel
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chatbot error' }, { status: 500 });
  }
}
