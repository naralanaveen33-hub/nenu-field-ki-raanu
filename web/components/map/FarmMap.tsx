'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FarmField } from '@/types';
import { MapPin, Loader2 } from 'lucide-react';

const DynamicMap = dynamic(() => import('./FarmMapLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="farm-card p-6 rounded-xl flex flex-col items-center justify-center min-h-[360px] text-stone-500 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-700 dark:text-emerald-500 mb-2" />
      <span className="text-xs font-medium">Loading Smart Farm Map...</span>
    </div>
  ),
});

interface FarmMapProps {
  initialCenter?: { lat: number; lng: number };
  activeField: FarmField | null;
  savedFields: FarmField[];
  language: 'te' | 'en';
  onSelectField: (field: FarmField) => void;
  onSaveField: (field: FarmField) => void;
  readOnly?: boolean;
}

export const FarmMap: React.FC<FarmMapProps> = (props) => {
  return (
    <div className="farm-card p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {props.language === 'te' ? 'పొలం మ్యాప్ & సరిహద్దులు' : 'Farm Map & Field Boundary'}
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {props.language === 'te'
                ? 'మీ స్థానం ఆధారంగా పొలాన్ని ఎంచుకోండి లేదా కొత్త సరిహద్దును గీయండి'
                : 'Locate nearby fields, draw boundaries, and sync weather coordinates'}
            </p>
          </div>
        </div>
      </div>

      <DynamicMap {...props} />
    </div>
  );
};
