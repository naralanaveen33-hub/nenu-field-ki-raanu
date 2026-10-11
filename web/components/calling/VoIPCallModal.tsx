'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, PhoneCall, Volume2, Mic, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { ActiveCallState } from '@/lib/calling/types';

interface VoIPCallModalProps {
  callState: ActiveCallState | null;
  isOpen: boolean;
  onClose: () => void;
  onAnswer: (callId: string) => Promise<void>;
  onConfirm: (callId: string, durationSeconds: number) => Promise<void>;
  onEnd: (callId: string) => Promise<void>;
  language: 'te' | 'en';
}

export const VoIPCallModal: React.FC<VoIPCallModalProps> = ({
  callState,
  isOpen,
  onClose,
  onAnswer,
  onConfirm,
  onEnd,
  language,
}) => {
  const [callPhase, setCallPhase] = useState<'ringing' | 'connected' | 'completed'>('ringing');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (callState) {
      if (callState.status === 'ringing') setCallPhase('ringing');
      if (callState.status === 'connected') setCallPhase('connected');
      if (callState.status === 'completed') setCallPhase('completed');
    }
  }, [callState]);

  if (!isOpen || !callState) return null;

  const handleAnswerClick = async () => {
    setIsProcessing(true);
    try {
      await onAnswer(callState.callId);
      setCallPhase('connected');

      // Speak dialog via SpeechSynthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(callState.dialogueTe);
        utterance.lang = 'te-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmClick = async (durationSecs: number) => {
    setIsProcessing(true);
    try {
      await onConfirm(callState.callId, durationSecs);
      setCallPhase('completed');

      const confirmMsg = `ధృవీకరించబడింది. నీటి పంపు ${Math.round(durationSecs / 60)} నిమిషాల పాటు ప్రారంభించబడింది.`;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(confirmMsg);
        utterance.lang = 'te-IN';
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclineClick = async () => {
    setIsProcessing(true);
    try {
      await onEnd(callState.callId);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-6 text-white text-center shadow-2xl relative overflow-hidden">
        {/* Close corner button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ambient Ringing Pulse Glow */}
        {callPhase === 'ringing' && (
          <div className="absolute inset-0 bg-radial from-sky-500/10 via-transparent to-transparent pointer-events-none animate-pulse" />
        )}

        {/* Caller Avatar */}
        <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 my-3">
          <PhoneCall className={`h-10 w-10 text-white ${callPhase === 'ringing' ? 'animate-bounce' : ''}`} />
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-black tracking-tight mt-2">
          {language === 'te' ? 'స్మార్ట్‌ఫామ్ వాయిస్ అసిస్టెంట్' : 'SmartFarm Voice Alert'}
        </h3>
        <p className="text-xs text-emerald-400 font-semibold mt-1">
          {callPhase === 'ringing' 
            ? (language === 'te' ? 'ఇన్‌కమింగ్ ఇంటర్నెట్ కాల్ (VoIP)...' : 'Incoming VoIP Call...')
            : callPhase === 'connected'
            ? (language === 'te' ? 'కాల్ కనెక్ట్ అయింది (లైవ్)' : 'Call Connected (Live)')
            : (language === 'te' ? 'కాల్ ముగిసింది' : 'Call Completed')}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {callState.phone} • {callState.farmerName}
        </p>

        {/* Dialogue Box */}
        {callPhase === 'connected' && (
          <div className="my-5 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-left space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Volume2 className="h-3.5 w-3.5" />
              <span>{language === 'te' ? 'అసిస్టెంట్ సందేశం:' : 'Assistant Message:'}</span>
            </div>
            <p className="text-slate-200 leading-relaxed font-medium">
              {callState.dialogueTe}
            </p>
            <p className="text-[10px] text-slate-400">
              {callState.dialogueEn}
            </p>
          </div>
        )}

        {callPhase === 'completed' && (
          <div className="my-5 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-700 text-center space-y-1">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-emerald-200">
              {language === 'te' 
                ? 'ధృవీకరించబడింది. పంప్ ప్రారంభించబడింది!' 
                : 'Confirmed. Irrigation activated!'}
            </p>
          </div>
        )}

        {/* Actions according to Phase */}
        <div className="mt-6 flex items-center justify-center gap-4">
          {callPhase === 'ringing' && (
            <>
              <button
                onClick={handleDeclineClick}
                disabled={isProcessing}
                className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all hover:scale-105"
                title="Decline Call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={handleAnswerClick}
                disabled={isProcessing}
                className="h-16 w-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xl shadow-emerald-600/50 transition-all hover:scale-110"
                title="Answer Call"
              >
                <Phone className="h-7 w-7 animate-pulse" />
              </button>
            </>
          )}

          {callPhase === 'connected' && (
            <div className="w-full space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold mb-2">
                {language === 'te' ? 'మీ స్పందన చెప్పండి లేదా క్లిక్ చేయండి:' : 'Respond to prompt:'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleConfirmClick(120)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold transition-all shadow-md"
                >
                  {language === 'te' ? 'అవును, 2 నిమిషాలు (2m)' : 'Yes, 2 mins'}
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleConfirmClick(300)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold transition-all shadow-md"
                >
                  {language === 'te' ? 'అవును, 5 నిమిషాలు (5m)' : 'Yes, 5 mins'}
                </button>
              </div>
              <button
                onClick={handleDeclineClick}
                disabled={isProcessing}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold transition-all mt-1"
              >
                {language === 'te' ? 'వద్దు, పంప్ ఆపండి (Decline)' : 'No, Keep Off'}
              </button>
            </div>
          )}

          {callPhase === 'completed' && (
            <button
              onClick={onClose}
              className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all"
            >
              {language === 'te' ? 'ముగించు (Close)' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
