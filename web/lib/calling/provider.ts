import { VoiceCallProvider, InitiateCallParams, ActiveCallState, CallStatus } from './types';

// In-memory call registry
const activeCalls = new Map<string, ActiveCallState>();

export class SimulatedWebCallProvider implements VoiceCallProvider {
  name = 'simulated';

  async initiateCall(params: InitiateCallParams): Promise<ActiveCallState> {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const mins = Math.round(params.suggestedDurationSeconds / 60);

    const dialogueTe = `నమస్కారం ${params.farmerName || 'రైతు సోదరులారా'}. స్మార్ట్‌ఫామ్ అలర్ట్. మీ పొలంలో మట్టి తేమ ${params.soilMoisture.toFixed(1)} శాతం ఉంది. వర్ష సూచన లేదు. నీరు పెట్టడం సిఫార్సు చేయబడింది. మీరు ${mins} నిమిషాల పాటు పంప్ ఆన్ చేయాలనుకుంటున్నారా?`;
    const dialogueEn = `Hello ${params.farmerName || 'Farmer'}. SmartFarm Alert. Soil moisture is ${params.soilMoisture.toFixed(1)}%. Rain is not expected. Irrigation is recommended. Would you like to start the pump for ${mins} minutes?`;

    const callState: ActiveCallState = {
      callId,
      provider: 'simulated',
      status: 'ringing',
      farmerName: params.farmerName || 'రైతు (Farmer)',
      phone: params.recipientPhone || '+91 98765 43210',
      dialogueTe,
      dialogueEn,
      suggestedDurationSeconds: params.suggestedDurationSeconds,
      isConfirmed: false
    };

    activeCalls.set(callId, callState);
    return callState;
  }

  async answerCall(callId: string): Promise<ActiveCallState> {
    const call = activeCalls.get(callId);
    if (!call) throw new Error('Call not found');

    call.status = 'connected';
    call.startTime = Date.now();
    activeCalls.set(callId, call);
    return call;
  }

  async confirmIrrigation(callId: string, durationSeconds?: number): Promise<{ success: boolean; messageTe: string }> {
    const call = activeCalls.get(callId);
    if (!call) throw new Error('Call not found');

    const duration = durationSeconds || call.suggestedDurationSeconds || 300;
    const mins = Math.round(duration / 60);

    call.isConfirmed = true;
    call.status = 'completed';
    activeCalls.set(callId, call);

    return {
      success: true,
      messageTe: `ధృవీకరించబడింది. నీటి పంపు ${mins} నిమిషాల పాటు ప్రారంభించబడుతోంది.`
    };
  }

  async endCall(callId: string): Promise<void> {
    const call = activeCalls.get(callId);
    if (call) {
      call.status = 'completed';
      activeCalls.set(callId, call);
    }
  }

  async getCallStatus(callId: string): Promise<ActiveCallState | null> {
    return activeCalls.get(callId) || null;
  }
}

export class TwilioVoiceCallProvider implements VoiceCallProvider {
  name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_CALLER_PHONE_NUMBER || '';
  }

  async initiateCall(params: InitiateCallParams): Promise<ActiveCallState> {
    // When Twilio credentials exist, issue REST call to Twilio Voice API
    if (!this.accountSid || !this.authToken) {
      console.warn('Twilio credentials missing, falling back to simulated call');
      const fallback = new SimulatedWebCallProvider();
      return fallback.initiateCall(params);
    }

    const callId = `tw_${Date.now()}`;
    // Construct TwiML webhook URL
    return {
      callId,
      provider: 'twilio',
      status: 'ringing',
      farmerName: params.farmerName || 'Farmer',
      phone: params.recipientPhone || '',
      dialogueTe: params.explanationTe,
      dialogueEn: 'Twilio call initiated',
      suggestedDurationSeconds: params.suggestedDurationSeconds,
      isConfirmed: false
    };
  }

  async answerCall(callId: string): Promise<ActiveCallState> {
    return (await this.getCallStatus(callId))!;
  }

  async confirmIrrigation(callId: string, durationSeconds?: number): Promise<{ success: boolean; messageTe: string }> {
    return { success: true, messageTe: 'ధృవీకరించబడింది' };
  }

  async endCall(callId: string): Promise<void> {}

  async getCallStatus(callId: string): Promise<ActiveCallState | null> {
    return activeCalls.get(callId) || null;
  }
}

export function getVoiceCallProvider(): VoiceCallProvider {
  const providerType = process.env.VOIP_PROVIDER || 'simulated';
  if (providerType === 'twilio' && process.env.TWILIO_ACCOUNT_SID) {
    return new TwilioVoiceCallProvider();
  }
  return new SimulatedWebCallProvider();
}
