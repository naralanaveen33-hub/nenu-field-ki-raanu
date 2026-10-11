'use client';

import React, { useState } from 'react';
import { AlertTriangle, CloudRain, CheckCircle2, Eye, Droplets } from 'lucide-react';
import { IrrigationRecommendation } from '@/types';

interface RecommendationBannerProps {
  recommendation: IrrigationRecommendation;
  isPumpRunning: boolean;
  language: 'te' | 'en';
  onConfirmIrrigation: (durationSeconds: number) => Promise<void>;
  onRejectIrrigation: () => void;
  controlsEnabled?: boolean;
}

export const RecommendationBanner: React.FC<RecommendationBannerProps> = ({
  recommendation,
  isPumpRunning,
  language,
  onConfirmIrrigation,
  onRejectIrrigation,
  controlsEnabled = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async (durationSecs: number) => {
    setIsProcessing(true);
    try {
      await onConfirmIrrigation(durationSecs);
    } finally {
      setIsProcessing(false);
    }
  };

  const recType = recommendation.recommendation;
  const isRecommended = recType === 'IRRIGATE_RECOMMENDED';
  const isWaitRain = recType === 'WAIT_RECHECK' && (recommendation.rain_probability >= 40 || recommendation.precipitation_mm > 0);
  const isWaitCooldown = recType === 'WAIT_RECHECK' && !isWaitRain;
  const isNotRequired = recType === 'DO_NOT_IRRIGATE';

  // Determine standard title
  let statusBadgeEn = 'MONITOR SOIL';
  let statusBadgeTe = 'నేలను పరిశీలించండి';
  let bannerBg = 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100';
  let badgeClass = 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200';
  let Icon = Eye;

  if (isRecommended) {
    statusBadgeEn = 'IRRIGATION RECOMMENDED';
    statusBadgeTe = 'నీరు పెట్టడం సిఫార్సు చేయబడింది';
    bannerBg = 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100';
    badgeClass = 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 font-bold';
    Icon = AlertTriangle;
  } else if (isWaitRain) {
    statusBadgeEn = 'WAIT FOR RAIN';
    statusBadgeTe = 'వర్షం కొరకు వేచి ఉండండి';
    bannerBg = 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800/80 text-sky-950 dark:text-sky-100';
    badgeClass = 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200 font-bold';
    Icon = CloudRain;
  } else if (isWaitCooldown) {
    statusBadgeEn = 'MONITOR SOIL';
    statusBadgeTe = 'నేలను పరిశీలించండి (కూల్‌డౌన్)';
    bannerBg = 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800/80 text-yellow-950 dark:text-yellow-100';
    badgeClass = 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200 font-bold';
    Icon = Eye;
  } else if (isNotRequired) {
    statusBadgeEn = 'IRRIGATION NOT REQUIRED';
    statusBadgeTe = 'నీరు పెట్టవలసిన అవసరం లేదు';
    bannerBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100';
    badgeClass = 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 font-bold';
    Icon = CheckCircle2;
  }

  return (
    <section aria-label="Irrigation Recommendation">
      <div className={`p-4 sm:p-5 rounded-xl border shadow-xs transition-all ${bannerBg}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Prominent Status & Recommendation Explanation */}
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black tracking-wider uppercase ${badgeClass}`}>
                <Icon className="h-3.5 w-3.5" />
                {language === 'te' ? statusBadgeTe : statusBadgeEn}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'te' ? 'స్మార్ట్ నిర్ణయ అల్గారిథమ్' : 'Decision Recommendation'}
              </span>
            </div>

            <p className="text-sm font-medium leading-relaxed mt-1">
              {language === 'te' ? recommendation.explanation_te : recommendation.explanation_en}
            </p>
          </div>

          {/* Right: Confirmation Actions if Recommended */}
          {controlsEnabled && isRecommended && !isPumpRunning && (
            <div className="w-full md:w-auto p-3.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs shrink-0">
              <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                {language === 'te' ? 'మోటార్ ఆన్ చేయాలా?' : 'Start Irrigation?'}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirm(120)}
                  className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition-colors disabled:opacity-50"
                >
                  {language === 'te' ? '2 నిమిషాలు (2m)' : 'Water 2m'}
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirm(300)}
                  className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition-colors disabled:opacity-50"
                >
                  {language === 'te' ? '5 నిమిషాలు (5m)' : 'Water 5m'}
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={onRejectIrrigation}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
                >
                  {language === 'te' ? 'వద్దు' : 'Dismiss'}
                </button>
              </div>
            </div>
          )}

          {isPumpRunning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold shrink-0">
              <Droplets className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {language === 'te' ? 'మోటార్ ప్రస్తుతం నడుస్తోంది' : 'Pump currently active'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
