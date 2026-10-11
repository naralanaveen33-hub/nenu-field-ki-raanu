'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart2, Calendar, TrendingDown, TrendingUp, Droplets, Thermometer, Wind } from 'lucide-react';

interface ReadingPoint {
  timestamp: string;
  timeLabel: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
}

interface HistoricalChartsProps {
  farmId: string;
  language: 'te' | 'en';
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({ farmId, language }) => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [readings, setReadings] = useState<ReadingPoint[]>([]);
  const [activeMetric, setActiveMetric] = useState<'moisture' | 'temperature' | 'humidity'>('moisture');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const res = await fetch(`/api/farms/${farmId}/sensors?period=${period}&demo=true`);
        const json = await res.json();
        setReadings(json.readings || []);
      } catch (e) {
        console.warn('Failed to load history:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [farmId, period]);

  // Compute SVG chart coordinates
  const values = readings.map((r) =>
    activeMetric === 'moisture'
      ? r.soil_moisture
      : activeMetric === 'temperature'
      ? r.temperature
      : r.humidity
  );

  const minVal = values.length ? Math.min(...values) - 2 : 0;
  const maxVal = values.length ? Math.max(...values) + 2 : 100;
  const range = maxVal - minVal || 1;

  const points = readings.map((r, idx) => {
    const x = (idx / Math.max(1, readings.length - 1)) * 500;
    const val =
      activeMetric === 'moisture'
        ? r.soil_moisture
        : activeMetric === 'temperature'
        ? r.temperature
        : r.humidity;
    const y = 180 - ((val - minVal) / range) * 150;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = points
    ? `0,180 ${points} 500,180`
    : '';

  const metricColors = {
    moisture: { stroke: '#06b6d4', fill: 'url(#moistureGradient)', unit: '%' },
    temperature: { stroke: '#f97316', fill: 'url(#tempGradient)', unit: '°C' },
    humidity: { stroke: '#10b981', fill: 'url(#humidityGradient)', unit: '%' }
  };

  return (
    <div className="farm-card p-4 sm:p-5 relative">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
        <div>
          <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
            {language === 'te' ? 'డేటా విశ్లేషణ & గత రికార్డులు' : 'Sensor Trends'}
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
            {language === 'te' ? 'కాలక్రమ చార్ట్' : 'Time-Series History'}
          </h3>
        </div>

        {/* Timeframe Selector Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-stone-800 self-start sm:self-auto">
          {[
            { id: '24h', label: '24 Hours', labelTe: '24 గంటలు' },
            { id: '7d', label: '7 Days', labelTe: '7 రోజులు' },
            { id: '30d', label: '30 Days', labelTe: '30 రోజులు' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as any)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                period === item.id
                  ? 'bg-white dark:bg-stone-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              {language === 'te' ? item.labelTe : item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => setActiveMetric('moisture')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            activeMetric === 'moisture'
              ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Droplets className="h-3.5 w-3.5" />
          <span>{language === 'te' ? 'నేల తేమ (Moisture)' : 'Soil Moisture'}</span>
        </button>

        <button
          onClick={() => setActiveMetric('temperature')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            activeMetric === 'temperature'
              ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Thermometer className="h-3.5 w-3.5" />
          <span>{language === 'te' ? 'ఉష్ణోగ్రత (Temp)' : 'Temperature'}</span>
        </button>

        <button
          onClick={() => setActiveMetric('humidity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
            activeMetric === 'humidity'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          <span>{language === 'te' ? 'గాలిలో తేమ (Humidity)' : 'Air Humidity'}</span>
        </button>
      </div>

      {/* Responsive SVG Chart */}
      <div className="mt-4 relative w-full h-52 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl p-2 border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
        <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="30" x2="500" y2="30" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="4 4" />
          <line x1="0" y1="105" x2="500" y2="105" stroke="#94a3b8" strokeOpacity="0.15" strokeDasharray="4 4" />
          <line x1="0" y1="180" x2="500" y2="180" stroke="#94a3b8" strokeOpacity="0.15" />

          {/* Area fill */}
          {areaPoints && (
            <polygon points={areaPoints} fill={metricColors[activeMetric].fill} />
          )}

          {/* Value line */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={metricColors[activeMetric].stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-2">
          <span>{readings[0]?.timeLabel || 'Past'}</span>
          <span>{readings[Math.floor(readings.length / 2)]?.timeLabel || 'Mid'}</span>
          <span>{readings[readings.length - 1]?.timeLabel || 'Now'}</span>
        </div>
      </div>
    </div>
  );
};
