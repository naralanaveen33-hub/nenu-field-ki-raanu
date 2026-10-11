'use client';

import React from 'react';
import { Sprout, Phone, Settings2, Sparkles, MapPin, ChevronDown } from 'lucide-react';
import { Farm, Device, FarmField } from '@/types';

interface NavbarProps {
  farm: Farm;
  device: Device;
  currentField?: FarmField | null;
  fields?: FarmField[];
  onSelectField?: (field: FarmField) => void;
  isDemoMode: boolean;
  language: 'te' | 'en';
  onToggleLanguage: () => void;
  onOpenVoIPCall: () => void;
  onToggleDemoDrawer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  farm,
  device,
  currentField,
  fields = [],
  onSelectField,
  isDemoMode,
  language,
  onToggleLanguage,
  onOpenVoIPCall,
  onToggleDemoDrawer,
}) => {
  const isOnline = device.status === 'online' && !device.is_stale;

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#13201a] border-b border-stone-200 dark:border-stone-800 px-4 py-3 sm:px-6 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand Identity & Current Field */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                  {language === 'te' ? 'స్మార్ట్ ఫామ్' : 'Smart Farm'}
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  {farm.name}
                </span>
                {isDemoMode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Sparkles className="h-2.5 w-2.5" /> Demo
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {language === 'te' ? 'రైతు సాగు పర్యవేక్షణ & నీటి నిర్వహణ' : 'Precision Irrigation & Field Monitoring'}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Right: Current Field Selector & Connectivity Status */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 sm:gap-3 text-xs">
          {/* Current Field Selector */}
          {currentField && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium">
              <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                <strong className="font-semibold">{currentField.name}</strong> • {currentField.crop} ({currentField.area})
              </span>
              {fields.length > 1 && onSelectField && (
                <div className="relative inline-block ml-1">
                  <select
                    value={currentField.id}
                    onChange={(e) => {
                      const found = fields.find((f) => f.id === e.target.value);
                      if (found) onSelectField(found);
                    }}
                    aria-label="Switch Current Field"
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.crop})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 inline text-emerald-700 dark:text-emerald-400" />
                </div>
              )}
            </div>
          )}

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300">
            <span className="flex h-2 w-2 relative">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-600' : 'bg-rose-500'
              }`} />
            </span>
            <span className="font-medium text-xs">
              {isOnline
                ? (language === 'te' ? 'గేట్‌వే ఆన్‌లైన్' : 'Gateway Online')
                : (language === 'te' ? 'గేట్‌వే ఆఫ్‌లైన్' : 'Gateway Offline')}
            </span>
          </div>

          {/* Actions: VoIP Simulator, Language, Settings */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenVoIPCall}
              aria-label="Phone Call Alert"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {language === 'te' ? 'కాల్ అలర్ట్' : 'Call'}
              </span>
            </button>

            <button
              onClick={onToggleLanguage}
              className="px-2.5 py-1.5 rounded-lg font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-colors"
            >
              {language === 'te' ? 'English' : 'తెలుగు'}
            </button>

            <button
              onClick={onToggleDemoDrawer}
              aria-label="Simulation Settings"
              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
