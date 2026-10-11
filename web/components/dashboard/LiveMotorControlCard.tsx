'use client';

import React, { useState } from 'react';
import { Power } from 'lucide-react';

type MotorTarget = 'on' | 'off';

interface LiveMotorControlCardProps {
  isRunning: boolean;
  isConnected: boolean;
  language: 'te' | 'en';
  onSetMotor: (target: MotorTarget) => Promise<string>;
}

export const LiveMotorControlCard: React.FC<LiveMotorControlCardProps> = ({
  isRunning,
  isConnected,
  language,
  onSetMotor,
}) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isTelugu = language === 'te';

  const requestMotorState = async (target: MotorTarget) => {
    const prompt = target === 'on'
      ? isTelugu
        ? 'మోటార్‌ను ఆన్ చేయాలా? పొలానికి నీరు ప్రవహిస్తుంది. ఆన్ చేయడానికి సరే నొక్కండి.'
        : 'Turn the motor ON? Water will flow to the field. Confirm to continue.'
      : isTelugu
        ? 'మోటార్‌ను ఆఫ్ చేయాలా? ఆఫ్ చేయడానికి సరే నొక్కండి.'
        : 'Turn the motor OFF? Confirm to continue.';

    if (!window.confirm(prompt)) return;

    setBusy(true);
    setMessage(isTelugu ? 'ఆర్డునో నిర్ధారణ కోసం వేచి ఉంది…' : 'Waiting for Arduino confirmation…');
    try {
      setMessage(await onSetMotor(target));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isTelugu ? 'మోటార్ ఆదేశం విఫలమైంది.' : 'Motor command failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="farm-card p-5" aria-label={isTelugu ? 'మోటార్ నియంత్రణ' : 'Motor controls'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
            {isTelugu ? 'మోటార్ నియంత్రణ' : 'Motor control'}
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-stone-100">
            <Power className={`h-5 w-5 ${isRunning ? 'text-emerald-600' : 'text-stone-400'}`} />
            {isTelugu ? (isRunning ? 'మోటార్ ఆన్‌లో ఉంది' : 'మోటార్ ఆఫ్‌లో ఉంది') : (isRunning ? 'Motor is ON' : 'Motor is OFF')}
          </h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isConnected
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
          {isConnected ? (isTelugu ? 'ఆర్డునో కనెక్ట్ అయింది' : 'Arduino connected') : (isTelugu ? 'ఆర్డునో ఆఫ్‌లైన్' : 'Arduino offline')}
        </span>
      </div>

      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {isTelugu
          ? 'ఇవి చేతితో పనిచేసే నియంత్రణలు. తేమ పెరిగినప్పుడు మోటార్ ఆటోమేటిక్‌గా ఆగదు.'
          : 'Manual controls only. The motor will not stop automatically when soil moisture rises.'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!isConnected || busy || isRunning}
          onClick={() => requestMotorState('on')}
          className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy && !isRunning ? (isTelugu ? 'వేచి ఉండండి…' : 'Please wait…') : (isTelugu ? 'మోటార్ ఆన్' : 'Motor ON')}
        </button>
        <button
          type="button"
          disabled={!isConnected || busy || !isRunning}
          onClick={() => requestMotorState('off')}
          className="rounded-lg bg-rose-700 px-4 py-3 font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isTelugu ? 'మోటార్ ఆఫ్' : 'Motor OFF'}
        </button>
      </div>

      {!isConnected && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
          {isTelugu
            ? 'తాజా ఆర్డునో డేటా వచ్చిన తర్వాతే నియంత్రణలు పనిచేస్తాయి.'
            : 'Controls unlock after the Pi receives fresh, valid Arduino data.'}
        </p>
      )}
      {message && <p role="status" aria-live="polite" className="mt-3 text-sm text-stone-700 dark:text-stone-300">{message}</p>}
    </section>
  );
};
