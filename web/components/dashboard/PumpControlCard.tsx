'use client';

import React, { useState } from 'react';
import { Power, Timer, AlertOctagon, RotateCcw, Droplets, ShieldAlert } from 'lucide-react';
import { formatSecondsToMinutes } from '@/lib/utils';

interface PumpControlCardProps {
  isRunning: boolean;
  isPending?: boolean;
  commandStatus?: string;
  remainingSeconds: number;
  durationSeconds: number;
  cooldownActive: boolean;
  cooldownRemainingSeconds: number;
  language: 'te' | 'en';
  onStartPump: (durationSeconds: number) => Promise<void>;
  onStopPump: () => Promise<void>;
}

export const PumpControlCard: React.FC<PumpControlCardProps> = ({
  isRunning,
  isPending = false,
  commandStatus = 'idle',
  remainingSeconds,
  durationSeconds,
  cooldownActive,
  cooldownRemainingSeconds,
  language,
  onStartPump,
  onStopPump,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(180); // 3 mins default
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const handleManualStart = async () => {
    setIsBusy(true);
    try {
      await onStartPump(selectedDuration);
      setShowConfirmModal(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleManualStop = async () => {
    setIsBusy(true);
    try {
      await onStopPump();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="farm-card p-4 sm:p-5 relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
        <div>
          <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
            {language === 'te' ? 'మోటార్ నియంత్రణ' : 'Pump Controller'}
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 mt-0.5">
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                {language === 'te' ? 'నీటి పంపు నడుస్తోంది' : 'Pump is RUNNING'}
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                {language === 'te' ? 'కమాండ్ క్యూలో ఉంది' : 'Command QUEUED'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                <span className="h-2.5 w-2.5 rounded-full bg-stone-400 dark:bg-stone-600" />
                {language === 'te' ? 'పంప్ ఆపివేయబడింది' : 'Pump is STOPPED'}
              </span>
            )}
          </h3>
        </div>

        {/* Runtime Countdown badge */}
        {isRunning && (
          <div className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
            <Timer className="h-3.5 w-3.5 text-emerald-600" />
            <div className="text-right">
              <span className="text-[10px] block text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                {language === 'te' ? 'సమయం' : 'Time Left'}
              </span>
              <span className="text-xs font-bold font-mono">
                {formatSecondsToMinutes(remainingSeconds)}
              </span>
            </div>
          </div>
        )}

        {cooldownActive && !isRunning && (
          <div className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            {language === 'te' 
              ? `కూల్‌డౌన్: ${cooldownRemainingSeconds}s` 
              : `Cooldown: ${cooldownRemainingSeconds}s`}
          </div>
        )}
      </div>

      {/* Main Control Panel */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left: Duration Selector */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
            {language === 'te' ? 'సమయాన్ని ఎంచుకోండి:' : 'Select Duration:'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '2 min', labelTe: '2 నిమి.', secs: 120 },
              { label: '5 min', labelTe: '5 నిమి.', secs: 300 },
              { label: '10 min', labelTe: '10 నిమి.', secs: 600 }
            ].map((option) => (
              <button
                key={option.secs}
                type="button"
                disabled={isRunning || cooldownActive}
                onClick={() => setSelectedDuration(option.secs)}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-colors ${
                  selectedDuration === option.secs
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50'
                } disabled:opacity-40`}
              >
                {language === 'te' ? option.labelTe : option.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5">
            {language === 'te' 
              ? 'గరిష్ట సురక్షిత సమయం: 15 నిమిషాలు (ఆటో కట్-ఆఫ్)' 
              : 'Safety watchdog: 15 min max per session'}
          </p>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-col justify-end gap-2">
          {!isRunning ? (
            <button
              disabled={isBusy || cooldownActive}
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-2.5 px-3 rounded-lg font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-[40px]"
            >
              <Power className="h-4 w-4" />
              <span>
                {language === 'te' 
                  ? `పంప్ ఆన్ చేయండి (${Math.round(selectedDuration / 60)} నిమిషాలు)` 
                  : `Start Pump (${Math.round(selectedDuration / 60)} mins)`}
              </span>
            </button>
          ) : (
            <button
              disabled={isBusy}
              onClick={handleManualStop}
              className="w-full py-2.5 px-3 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
            >
              <AlertOctagon className="h-4 w-4" />
              <span>
                {language === 'te' ? 'పంప్ వెంటనే ఆపు (Stop Pump)' : 'Stop Pump Immediately'}
              </span>
            </button>
          )}

          {/* Emergency Stop Cutoff */}
          <button
            onClick={handleManualStop}
            className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold py-1 flex items-center justify-center gap-1"
          >
            <ShieldAlert className="h-3 w-3" />
            <span>{language === 'te' ? 'ఎమర్జెన్సీ కట్-ఆఫ్' : 'Emergency Hardware Cutoff'}</span>
          </button>
        </div>
      </div>


      {/* Manual Activation Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                <Power className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  {language === 'te' ? 'పంప్ ప్రారంభం ధృవీకరణ' : 'Confirm Pump Activation'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'te' ? 'రైతు నిర్ధారణ అవసరం' : 'Manual operator confirmation required'}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {language === 'te'
                ? `మీరు నీటి పంపును ${Math.round(selectedDuration / 60)} నిమిషాల పాటు ఆన్ చేయాలనుకుంటున్నారా? గడువు ముగిసిన తర్వాత ఆటోమేటిక్‌గా ఆగిపోతుంది.`
                : `Are you sure you want to turn on the pump for ${Math.round(selectedDuration / 60)} minutes? The pump will stop automatically when the timer expires.`}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                {language === 'te' ? 'రద్దు చేయండి (Cancel)' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleManualStart}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {language === 'te' ? 'అవును, ఆన్ చేయండి (Confirm)' : 'Yes, Start Pump'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
