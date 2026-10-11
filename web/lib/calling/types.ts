export interface InitiateCallParams {
  farmId: string;
  recipientPhone?: string;
  farmerName?: string;
  soilMoisture: number;
  rainProbability: number;
  suggestedDurationSeconds: number;
  explanationTe: string;
}

export type CallStatus = 'idle' | 'ringing' | 'connected' | 'completed' | 'declined' | 'timeout';

export interface ActiveCallState {
  callId: string;
  provider: 'simulated' | 'twilio';
  status: CallStatus;
  startTime?: number;
  farmerName: string;
  phone: string;
  dialogueTe: string;
  dialogueEn: string;
  suggestedDurationSeconds: number;
  isConfirmed: boolean;
}

export interface VoiceCallProvider {
  name: string;
  initiateCall(params: InitiateCallParams): Promise<ActiveCallState>;
  answerCall(callId: string): Promise<ActiveCallState>;
  confirmIrrigation(callId: string, durationSeconds?: number): Promise<{ success: boolean; messageTe: string }>;
  endCall(callId: string): Promise<void>;
  getCallStatus(callId: string): Promise<ActiveCallState | null>;
}
