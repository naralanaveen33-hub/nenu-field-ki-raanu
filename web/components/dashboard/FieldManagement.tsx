'use client';

import React from 'react';
import { Layers, MapPin, Check, Plus, Trash2 } from 'lucide-react';
import { FarmField } from '@/types';

interface FieldManagementProps {
  fields: FarmField[];
  activeField: FarmField | null;
  language: 'te' | 'en';
  onSelectField: (field: FarmField) => void;
  onDeleteField: (fieldId: string) => void;
  onAddNewField: () => void;
}

export const FieldManagement: React.FC<FieldManagementProps> = ({
  fields,
  activeField,
  language,
  onSelectField,
  onDeleteField,
  onAddNewField,
}) => {
  return (
    <div className="farm-card p-4 sm:p-5 flex flex-col justify-between" id="field-management-card">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {language === 'te' ? 'పొలాల నిర్వహణ' : 'Field Management'}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {language === 'te'
                  ? 'మీ అన్ని పొలాలు & వాతావరణ సమన్వయ స్థానాలు'
                  : 'Manage active cultivation parcels and coordinate anchors'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddNewField}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>{language === 'te' ? 'కొత్తది' : 'Add'}</span>
          </button>
        </div>

        {/* Fields List */}
        <div className="space-y-2 mt-3">
          {fields.map((field) => {
            const isSelected = activeField?.id === field.id;
            return (
              <div
                key={field.id}
                onClick={() => onSelectField(field)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 font-medium'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`h-6 w-6 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-emerald-700 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                    }`}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 dark:text-stone-100 truncate">
                        {field.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        {field.crop}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-2 mt-0.5">
                      <span>{field.area}</span>
                      <span>•</span>
                      <span className="font-mono">
                        {field.center.lat.toFixed(4)}, {field.center.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button (if more than 1 field) */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(language === 'te' ? 'ఈ పొలాన్ని తొలగించాలా?' : 'Delete this field?')) {
                        onDeleteField(field.id);
                      }
                    }}
                    className="p-1 rounded text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400">
        <span>
          {language === 'te'
            ? 'వాతావరణ సూచన స్వయంచాలకంగా ఎంచుకున్న పొలం కేంద్ర స్థానాన్ని ఉపయోగిస్తుంది.'
            : 'Weather forecast coordinates automatically track the active selected field.'}
        </span>
      </div>
    </div>
  );
};
