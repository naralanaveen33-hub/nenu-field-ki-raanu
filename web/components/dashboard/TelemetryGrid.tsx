'use client';

import React from 'react';
import { Droplets, Thermometer, Wind, Power, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { SensorReading, Device } from '@/types';
import { getMoistureStatus, formatSecondsToMinutes } from '@/lib/utils';

interface TelemetryGridProps {
  sensor: SensorReading;
  device: Device;
  targetMin?: number;
  targetMax?: number;
  isMotorRunning: boolean;
  isMotorPending?: boolean;
  remainingSeconds?: number;
  language: 'te' | 'en';
  onQuickStartPump?: (durationSeconds: number) => Promise<void>;
  onQuickStopPump?: () => Promise<void>;
  sensorLabel?: string;
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({
  sensor,
  device,
  targetMin = 30,
  targetMax = 65,
  isMotorRunning,
  isMotorPending = false,
  remainingSeconds = 0,
  language,
  onQuickStartPump,
  onQuickStopPump,
  sensorLabel = 'DHT22',
}) => {
  // Use calibrated percentage from backend
  const moistureValue = typeof sensor.soil_moisture === 'number' ? sensor.soil_moisture : null;
  const moistureStatus = moistureValue === null ? null : getMoistureStatus(moistureValue, targetMin, targetMax);

  return (
    <section aria-label="Top Agricultural Metrics">
      {device.is_stale && (
        <p className="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
          {language === 'te' ? 'చివరి ఆర్డునో రీడింగ్' : 'Last Arduino reading'}: {new Date(sensor.recorded_at).toLocaleTimeString()}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. SOIL MOISTURE */}
        <div className="farm-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">
              <span>{language === 'te' ? 'మట్టి తేమ' : 'Soil Moisture'}</span>
              <Droplets className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 font-mono">
                {moistureValue === null ? '--' : moistureValue.toFixed(1)}
              </span>
              {moistureValue !== null && <span className="text-lg font-semibold text-stone-500">%</span>}
            </div>

            {/* If backend provides raw sensor values, display alongside calibrated percentage */}
            {sensor.soil_raw !== undefined && (
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 font-mono">
                {language === 'te' ? 'ముడి విలువ:' : 'Raw:'} {sensor.soil_raw} ADC
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400">
              {language === 'te' ? 'స్థితి:' : 'Status:'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${moistureStatus?.badgeBg || 'bg-amber-100 text-amber-800 border-amber-300'}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {moistureStatus
                ? language === 'te' ? moistureStatus.label_te : moistureStatus.label_en
                : language === 'te' ? 'కాలిబ్రేషన్ అవసరం' : 'Calibration required'}
            </span>
          </div>
        </div>

        {/* 2. TEMPERATURE */}
        <div className="farm-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">
              <span>{language === 'te' ? 'పొలం ఉష్ణోగ్రత' : 'Temperature'}</span>
              <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 font-mono">
                {typeof sensor.temperature === 'number' ? sensor.temperature.toFixed(1) : '--'}
              </span>
              <span className="text-lg font-semibold text-stone-500">°C</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>{language === 'te' ? 'సెన్సార్ రీడింగ్' : 'Field Sensor'}</span>
            <span className="font-medium text-stone-600 dark:text-stone-300">{sensorLabel}</span>
          </div>
        </div>

        {/* 3. HUMIDITY */}
        <div className="farm-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">
              <span>{language === 'te' ? 'గాలిలో తేమ (హ్యుమిడిటీ)' : 'Humidity'}</span>
              <Wind className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 font-mono">
                {typeof sensor.humidity === 'number' ? sensor.humidity.toFixed(1) : '--'}
              </span>
              <span className="text-lg font-semibold text-stone-500">%</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>{language === 'te' ? 'సాపేక్ష తేమ' : 'Relative Humidity'}</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {sensor.humidity > 40 && sensor.humidity < 80
                ? (language === 'te' ? 'సాధారణం' : 'Normal')
                : (language === 'te' ? 'సమీక్షించండి' : 'Review')}
            </span>
          </div>
        </div>

        {/* 4. MOTOR STATUS */}
        <div className="farm-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">
              <span>{language === 'te' ? 'మోటార్ స్థితి' : 'Motor Status'}</span>
              <Power className={`h-4 w-4 ${!device.is_stale && isMotorRunning ? 'text-emerald-600' : 'text-stone-400'}`} />
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${
                  device.is_stale
                    ? 'text-amber-700 dark:text-amber-400'
                    : isMotorRunning
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : isMotorPending
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {device.is_stale ? 'UNKNOWN' : isMotorRunning ? 'ON' : isMotorPending ? 'PENDING' : 'OFF'}
              </span>

              {!device.is_stale && isMotorRunning && remainingSeconds > 0 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {formatSecondsToMinutes(remainingSeconds)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400">
              {device.is_stale
                ? (language === 'te' ? 'ఆర్డునో స్థితి అందుబాటులో లేదు' : 'Arduino status unavailable')
                : isMotorRunning
                ? (language === 'te' ? 'నీటి పారుదల నడుస్తోంది' : 'Irrigating')
                : isMotorPending
                ? (language === 'te' ? 'గేట్‌వే నిర్ధారణ కొరకు వేచి ఉంది' : 'Awaiting Gateway ACK')
                : (language === 'te' ? 'ఆపివేయబడింది' : 'Pump Stopped')}
            </span>

            {/* Quick Toggle Button keeping existing API behavior */}
            {onQuickStartPump && onQuickStopPump && (
              <div>
                {isMotorRunning ? (
                  <button
                    onClick={() => onQuickStopPump()}
                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                  >
                    {language === 'te' ? 'ఆపు' : 'Stop'}
                  </button>
                ) : (
                  <button
                    onClick={() => onQuickStartPump(300)}
                    disabled={isMotorPending}
                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors disabled:opacity-50"
                  >
                    {language === 'te' ? 'ఆన్ చేయి (5m)' : 'Start 5m'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
