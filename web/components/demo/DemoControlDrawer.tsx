'use client';

import React from 'react';
import { X, Sliders, CloudRain, Wifi, Sparkles, RotateCcw } from 'lucide-react';

interface DemoControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  soilMoisture: number;
  onSoilMoistureChange: (val: number) => void;
  isRainSimulated: boolean;
  onToggleRain: () => void;
  isGatewayOnline: boolean;
  onToggleGatewayOnline: () => void;
  onResetDemo: () => void;
  language: 'te' | 'en';
}

export const DemoControlDrawer: React.FC<DemoControlDrawerProps> = ({
  isOpen,
  onClose,
  soilMoisture,
  onSoilMoistureChange,
  isRainSimulated,
  onToggleRain,
  isGatewayOnline,
  onToggleGatewayOnline,
  onResetDemo,
  language,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {language === 'te' ? 'లైవ్ డెమో నియంత్రణలు' : 'Live Demo Controls'}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {language === 'te' ? 'సిమ్యులేషన్ సెట్టింగ్‌లు' : 'Interactive Simulation Mode'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Controls List */}
          <div className="mt-6 space-y-6">
            {/* 1. Soil Moisture Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'te' ? 'నేల తేమ శాతం (Soil Moisture):' : 'Soil Moisture Level:'}
                </label>
                <span className="text-sm font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
                  {soilMoisture.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="85"
                step="0.5"
                value={soilMoisture}
                onChange={(e) => onSoilMoistureChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>15% ({language === 'te' ? 'ఎండిన నేల' : 'Dry'})</span>
                <span className="text-emerald-500 font-semibold">30-65% ({language === 'te' ? 'సరైనది' : 'Optimal'})</span>
                <span>85% ({language === 'te' ? 'తడి' : 'Wet'})</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                💡 <span className="font-semibold">{language === 'te' ? 'చిట్కా:' : 'Tip:'}</span>{' '}
                {language === 'te'
                  ? 'స్లైడర్‌ను 25% కంటే తక్కువకు జరపండి — సిఫార్సు ఎలా మారుతుందో చూడండి!'
                  : 'Slide below 30% without rain to trigger the Irrigation Recommendation & Confirmation prompt!'}
              </p>
            </div>

            {/* 2. Weather Rain Simulator */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {language === 'te' ? 'వర్ష సూచనను సిమ్యులేట్ చేయండి' : 'Simulate Rain Forecast'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {isRainSimulated ? '🌧️ 85% Rain probability' : '☀️ 12% Low rain'}
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleRain}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  isRainSimulated
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {isRainSimulated ? (language === 'te' ? 'వర్షం ఉంది' : 'Rain Active') : (language === 'te' ? 'ఎండ' : 'Clear')}
              </button>
            </div>

            {/* 3. Gateway Offline Mode Simulator */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {language === 'te' ? 'గేట్‌వే కనెక్టివిటీ' : 'Field Gateway Online'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {isGatewayOnline ? 'Online (Supabase sync)' : 'Offline (Local buffer)'}
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleGatewayOnline}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  isGatewayOnline
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                }`}
              >
                {isGatewayOnline ? (language === 'te' ? 'ఆన్‌లైన్' : 'Online') : (language === 'te' ? 'ఆఫ్‌లైన్' : 'Offline')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={onResetDemo}
            className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{language === 'te' ? 'సిమ్యులేషన్ రీసెట్' : 'Reset Simulation Defaults'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
