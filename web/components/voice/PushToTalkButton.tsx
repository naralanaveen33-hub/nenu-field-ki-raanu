'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Loader2, Send, Bot } from 'lucide-react';

interface PushToTalkButtonProps {
  onProcessCommand: (transcript: string) => Promise<{
    intent: string;
    response_text_te: string;
    response_text_en?: string;
    response_text?: string;
    language?: 'te' | 'en';
    ai_model?: string;
    provider?: 'grok' | 'local_fallback';
    status_label?: string;
  }>;
  language: 'te' | 'en';
}

export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  onProcessCommand,
  language,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [lastResponse, setLastResponse] = useState<{ te: string; en: string; primary: string; model?: string; provider?: string } | null>(null);
  const [lastIntent, setLastIntent] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status confirmed dynamically by backend /api/chat without exposing API key to frontend
  const [isGrokAvailable, setIsGrokAvailable] = useState<boolean>(false);
  const [statusLabel, setStatusLabel] = useState<string>('Checking AI status...');
  const recognitionRef = useRef<any>(null);

  // 1. Check backend Grok availability truthfully on mount
  useEffect(() => {
    fetch('/api/chat')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'available') {
          setIsGrokAvailable(true);
          setStatusLabel('Grok AI • Farm Assistant');
        } else {
          setIsGrokAvailable(false);
          setStatusLabel('Local Assistant • Fallback');
        }
      })
      .catch(() => {
        setIsGrokAvailable(false);
        setStatusLabel('Local Assistant • Fallback');
      });
  }, []);

  // 2. Initialize SpeechRecognition if available in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';

        recognition.onstart = () => {
          setIsListening(true);
          setErrorMessage(null);
        };

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          handleExecuteChat(text);
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setErrorMessage(language === 'te' 
              ? 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది.' 
              : 'Microphone permission denied.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = language === 'te' ? 'te-IN' : 'en-IN';
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Recognition start error:', e);
        }
      } else {
        // Fallback for browsers without Web Speech API
        const manual = prompt(
          language === 'te' 
            ? 'మీ ప్రశ్న లేదా కమాండ్ తెలుగు లేదా ఇంగ్లీషులో టైప్ చేయండి (ఉదా: మట్టి తేమ ఎంత ఉంది? / Should I irrigate?):' 
            : 'Enter question in English or Telugu (e.g. Should I irrigate? / మట్టి తేమ ఎంత ఉంది?):'
        );
        if (manual) {
          setTranscript(manual);
          handleExecuteChat(manual);
        }
      }
    }
  };

  const handleExecuteChat = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setTranscript(text);

    try {
      const result = await onProcessCommand(text);
      setLastIntent(result.intent);

      const primary = result.response_text || (language === 'te' ? result.response_text_te : (result.response_text_en || result.response_text_te));

      const isGrokResponse = result.provider === 'grok' || (result.ai_model && result.ai_model.toLowerCase().includes('grok'));
      if (isGrokResponse) {
        setIsGrokAvailable(true);
        setStatusLabel('Grok AI • Farm Assistant');
      } else if (result.provider === 'local_fallback') {
        setIsGrokAvailable(false);
        setStatusLabel('Local Assistant • Fallback');
      }

      setLastResponse({
        te: result.response_text_te,
        en: result.response_text_en || '',
        primary: primary || result.response_text_te,
        model: result.ai_model || (isGrokResponse ? 'Grok AI' : 'Local Assistant'),
        provider: result.provider || (isGrokResponse ? 'grok' : 'local_fallback')
      });

      // Play audio response using SpeechSynthesis with matching language
      const isTelugu = /[\u0C00-\u0C7F]/.test(primary);
      speakResponse(primary, isTelugu ? 'te-IN' : 'en-IN');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing chatbot message');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    const query = inputText.trim();
    setInputText('');
    handleExecuteChat(query);
  };

  // Text-To-Speech (TTS)
  const speakResponse = (text: string, lang = 'te-IN') => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="farm-card rounded-2xl p-5 relative overflow-hidden border border-emerald-200 dark:border-emerald-800/80 shadow-sm" id="smartfarm-chatbot-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Info & Chips */}
        <div className="flex-1 text-left w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
              {language === 'te' ? 'స్మార్ట్‌ఫామ్ చాట్‌బాట్' : 'SmartFarm Chatbot'}
            </span>

            {/* Truthful status badge confirmed by backend */}
            <span
              id="chatbot-status-badge"
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-all ${
                isGrokAvailable
                  ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {isGrokAvailable ? <Sparkles className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" /> : <Bot className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />}
              <span>{statusLabel}</span>
            </span>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {language === 'te' ? 'పుష్-టు-టాక్ & టెక్స్ట్' : 'Voice & Text'}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            {language === 'te' ? 'రైతు సలహాదారు (Farm AI Assistant)' : 'Farmer AI Assistant'}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'te'
              ? 'తెలుగు లేదా ఇంగ్లీషులో ప్రశ్నలు అడగండి. సహజ సమాధానం పొందండి.'
              : 'Ask questions in Telugu or English. Get natural farm-aware answers.'}
          </p>

          {/* Quick Bilingual Suggestion Chips (Includes required test phrases) */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[
              { label: 'What is the soil moisture?', langTag: 'EN' },
              { label: 'మట్టి తేమ ఎంత ఉంది?', langTag: 'TE' },
              { label: 'Should I irrigate?', langTag: 'EN' },
              { label: 'ఇప్పుడు నీరు పెట్టాలా?', langTag: 'TE' },
              { label: 'వర్షం పడుతుందా?', langTag: 'TE' }
            ].map((chip) => (
              <button
                key={chip.label}
                disabled={isProcessing}
                onClick={() => {
                  setTranscript(chip.label);
                  handleExecuteChat(chip.label);
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800 transition-colors font-medium shadow-xs flex items-center gap-1.5"
              >
                <span>{chip.label}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 bg-emerald-200/60 dark:bg-emerald-800/60 rounded text-emerald-800 dark:text-emerald-300">{chip.langTag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Push-To-Talk Mic Button */}
        <div className="flex flex-col items-center self-center sm:self-auto shrink-0">
          <button
            type="button"
            id="chatbot-mic-button"
            onClick={toggleListening}
            disabled={isProcessing}
            aria-label="Push to Talk"
            className={`h-20 w-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl ${
              isListening
                ? 'bg-rose-600 text-white mic-recording shadow-rose-600/40'
                : isProcessing
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-emerald-600/30 hover:scale-105'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isListening ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
            <span className="text-[10px] font-extrabold tracking-wide mt-1 uppercase">
              {isListening ? 'వింటున్నా...' : isProcessing ? 'పరిశీలిస్తోంది' : 'టాక్ (TALK)'}
            </span>
          </button>
        </div>
      </div>

      {/* Interactive Text Input for Direct Typing in Telugu/English */}
      <form onSubmit={handleInputSubmit} className="mt-4 flex items-center gap-2" id="chatbot-form">
        <div className="relative flex-1">
          <input
            id="chatbot-text-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
            placeholder={
              language === 'te'
                ? 'తెలుగు లేదా English లో టైప్ చేయండి (ఉదా: మట్టి తేమ ఎంత ఉంది? / Should I irrigate?)...'
                : 'Type question in English or Telugu (e.g. Should I irrigate? / మట్టి తేమ ఎంత ఉంది?)...'
            }
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-10"
          />
        </div>
        <button
          id="chatbot-send-button"
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>{language === 'te' ? 'పంపు' : 'Send'}</span>
            </>
          )}
        </button>
      </form>

      {/* Response Display Box */}
      {(transcript || lastResponse) && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5" id="chatbot-response-container">
          {transcript && (
            <div className="flex items-start gap-2 text-xs flex-wrap" id="chatbot-user-message">
              <span className="font-bold text-slate-500">{language === 'te' ? 'రైతు సందేశం:' : 'Farmer:'}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                "{transcript}"
              </span>
              {lastIntent && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {lastIntent}
                </span>
              )}
            </div>
          )}

          {lastResponse && (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3" id="chatbot-ai-response">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  {lastResponse.provider === 'grok' ? (
                    <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded ${
                    lastResponse.provider === 'grok'
                      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {lastResponse.model || 'Grok AI'}
                  </span>
                </div>
                
                {/* Primary Response */}
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100 leading-relaxed" id="chatbot-primary-reply">
                  {lastResponse.primary}
                </p>

                {/* Sub-bilingual translation if available and different */}
                {lastResponse.en && lastResponse.te && lastResponse.primary !== lastResponse.en && (
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 italic">
                    {lastResponse.en}
                  </p>
                )}
                {lastResponse.te && lastResponse.primary !== lastResponse.te && (
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 italic">
                    {lastResponse.te}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  const isTe = /[\u0C00-\u0C7F]/.test(lastResponse.primary);
                  speakResponse(lastResponse.primary, isTe ? 'te-IN' : 'en-IN');
                }}
                title="Play audio again"
                className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 transition-colors shrink-0"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
