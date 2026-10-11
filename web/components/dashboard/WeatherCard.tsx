'use client';

import React from 'react';
import { CloudRain, Sun, AlertCircle, Cloud, MapPin } from 'lucide-react';
import { WeatherData, FarmField } from '@/types';

interface WeatherCardProps {
  weather: WeatherData;
  activeField?: FarmField | null;
  language: 'te' | 'en';
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, activeField, language }) => {
  const isHighRainChance = weather.rain_probability >= 50;

  return (
    <div className="farm-card p-4 sm:p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
                {language === 'te' ? 'వాతావరణ సూచన' : 'Weather Forecast'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                Open-Meteo
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 font-mono">
                {typeof weather.temperature === 'number' ? weather.temperature.toFixed(1) : '--'}°C
              </h3>
              <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                {weather.forecast_summary}
              </span>
            </div>
          </div>

          {/* Rain Probability Badge */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                isHighRainChance
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {isHighRainChance ? (
                <CloudRain className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </div>
            <div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block">
                {language === 'te' ? 'వర్ష సూచన' : 'Rain Chance'}
              </span>
              <span className="text-lg font-bold text-stone-900 dark:text-stone-100 font-mono">
                {weather.rain_probability}%
              </span>
            </div>
          </div>
        </div>

        {/* Hourly Rain Probability Forecast */}
        <div className="mt-4">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            {language === 'te' ? 'రాబోయే గంటల్లో వర్ష సంభావ్యత:' : 'Next 12 Hours Rain Probability:'}
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
            {(weather.hourly_forecast || []).slice(0, 6).map((item, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center"
              >
                <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 block">
                  {item.time}
                </span>
                <div className="my-1 flex justify-center text-sky-600 dark:text-sky-400">
                  {item.rain_prob > 40 ? (
                    <CloudRain className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <span className="text-xs font-bold font-mono text-stone-800 dark:text-stone-200">
                  {item.rain_prob}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Field Coordinate Anchor Note */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>
            {activeField
              ? `${activeField.name} (${activeField.center.lat.toFixed(4)}, ${activeField.center.lng.toFixed(4)})`
              : (language === 'te' ? 'పొలం లొకేషన్ ఆధారంగా' : 'Anchored to field center')}
          </span>
        </div>
        <span>{weather.precipitation_unknown ? 'Precipitation unavailable' : weather.precipitation_mm > 0 ? `${weather.precipitation_mm}mm rain` : 'No precipitation'}</span>
      </div>
    </div>
  );
};
