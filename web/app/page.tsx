'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TelemetryGrid } from '@/components/dashboard/TelemetryGrid';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { RecommendationBanner } from '@/components/dashboard/RecommendationBanner';
import { PumpControlCard } from '@/components/dashboard/PumpControlCard';
import { FarmMap } from '@/components/map/FarmMap';
import { FieldManagement } from '@/components/dashboard/FieldManagement';
import { PushToTalkButton } from '@/components/voice/PushToTalkButton';
import { VoIPCallModal } from '@/components/calling/VoIPCallModal';
import { HistoricalCharts } from '@/components/analytics/HistoricalCharts';
import { DemoControlDrawer } from '@/components/demo/DemoControlDrawer';

import {
  getInitialDemoState,
  computeDemoTelemetry,
  DemoState,
} from '@/lib/demo/store';
import { TelemetrySummary, FarmField } from '@/types';
import { ActiveCallState } from '@/lib/calling/types';
import { getBackendApiUrl } from '@/lib/api-config';
import { mapPiField, mapPiStatus } from '@/lib/pi-telemetry';

const STORAGE_KEY = 'smartfarm_saved_fields';
const ACTIVE_FIELD_KEY = 'smartfarm_active_field_id';

const DEFAULT_FIELDS: FarmField[] = [
  {
    id: 'field_1',
    name: 'North Field',
    crop: 'Paddy',
    area: '3.5 Acres',
    coordinates: [
      [16.5075, 80.6465],
      [16.5078, 80.6495],
      [16.5050, 80.6498],
      [16.5048, 80.6468],
    ],
    center: {
      lat: 16.5062,
      lng: 80.6480,
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'field_2',
    name: 'South Field',
    crop: 'Chilli',
    area: '2.2 Acres',
    coordinates: [
      [16.5035, 80.6450],
      [16.5038, 80.6475],
      [16.5015, 80.6478],
      [16.5012, 80.6452],
    ],
    center: {
      lat: 16.5025,
      lng: 80.6464,
    },
    created_at: new Date().toISOString(),
  },
];

export default function SmartFarmDashboard() {
  const [language, setLanguage] = useState<'te' | 'en'>('te');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoState, setDemoState] = useState<DemoState>(getInitialDemoState());
  const [telemetry, setTelemetry] = useState<TelemetrySummary>(
    computeDemoTelemetry(demoState)
  );

  // Field state
  const [savedFields, setSavedFields] = useState<FarmField[]>([]);
  const [activeField, setActiveField] = useState<FarmField | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Live status states
  const [isCommandPending, setIsCommandPending] = useState<boolean>(false);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [commandStatusMsg, setCommandStatusMsg] = useState<string | null>(null);
  const [isDemoDrawerOpen, setIsDemoDrawerOpen] = useState(false);
  const [activeVoIPCall, setActiveVoIPCall] = useState<ActiveCallState | null>(null);
  const [isVoIPModalOpen, setIsVoIPModalOpen] = useState(false);

  const farmId = activeField?.id || '';
  const deviceId = telemetry.device?.id || '22222222-2222-2222-2222-222222222222';

  // The Pi owns farm IDs. Local browser defaults must not drive live requests.
  useEffect(() => {
    const backendUrl = getBackendApiUrl();
    if (!backendUrl) { setBackendError('Pi API URL is not configured'); return; }
    let cancelled = false;
    fetch(`${backendUrl}/api/fields`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Pi farm list returned HTTP ${res.status}`);
        const fields = await res.json();
        if (!Array.isArray(fields) || fields.length === 0) throw new Error('Pi has no configured farms');
        return fields.map(mapPiField);
      })
      .then((fields: FarmField[]) => {
        if (cancelled) return;
        setSavedFields(fields);
        const savedId = localStorage.getItem(ACTIVE_FIELD_KEY);
        setActiveField(fields.find((field) => field.id === savedId) || fields[0]);
      })
      .catch((error) => { if (!cancelled) setBackendError(error.message); });
    return () => { cancelled = true; };
  }, []);

  // 1. Fetch live telemetry from server API
  const fetchLiveStatus = useCallback(async () => {
    if (isDemoMode || !activeField) return;

    try {
      const backendUrl = getBackendApiUrl();
      if (!backendUrl) throw new Error('Pi API URL is not configured');
      const res = await fetch(`${backendUrl}/api/status?farm_id=${encodeURIComponent(activeField.id)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Pi status returned HTTP ${res.status}`);
      setTelemetry(mapPiStatus(await res.json(), activeField));
      setBackendReady(true);
      setBackendError(null);
    } catch (err) {
      setBackendReady(false);
      setBackendError(err instanceof Error ? err.message : 'Pi status unavailable');
    }
  }, [activeField, isDemoMode]);

  // Initial mount & periodic polling (every 4 seconds)
  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchLiveStatus]);

  // Pi /api/status already supplies the selected farm's weather.

  // Field selection / update handlers
  const handleSelectField = (field: FarmField) => {
    setActiveField(field);
    try {
      localStorage.setItem(ACTIVE_FIELD_KEY, field.id);
    } catch (e) {}
  };

  const handleSaveField = (newField: FarmField) => {
    const updated = [newField, ...savedFields.filter((f) => f.id !== newField.id)];
    setSavedFields(updated);
    setActiveField(newField);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(ACTIVE_FIELD_KEY, newField.id);
    } catch (e) {}
  };

  const handleDeleteField = (fieldId: string) => {
    const updated = savedFields.filter((f) => f.id !== fieldId);
    setSavedFields(updated);
    if (activeField?.id === fieldId && updated.length > 0) {
      setActiveField(updated[0]);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // Poll command status when a command is in PENDING state
  useEffect(() => {
    if (!isCommandPending || !deviceId || isDemoMode) return;

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/devices/${deviceId}/commands`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'active') {
          setIsCommandPending(false);
          setCommandStatusMsg(
            language === 'te'
              ? 'ఆమోదించబడింది! ఆర్డునో నీటి పంపును ఆన్ చేసింది.'
              : 'Confirmed! Arduino energized pump.'
          );
          fetchLiveStatus();
        } else if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'aborted'
        ) {
          setIsCommandPending(false);
          fetchLiveStatus();
        }
      } catch (e) {
        console.warn('Command status poll error:', e);
      }
    }, 1500);

    return () => clearInterval(pollTimer);
  }, [isCommandPending, deviceId, isDemoMode, language, fetchLiveStatus]);

  // Demo simulation ticker
  useEffect(() => {
    if (!isDemoMode) return;

    const timer = setInterval(() => {
      setDemoState((prev) => {
        if (!prev.isPumpRunning || !prev.pumpStartedAt) return prev;

        const elapsed = Math.floor((Date.now() - prev.pumpStartedAt) / 1000);
        const remaining = Math.max(0, prev.pumpDurationSeconds - elapsed);
        const newMoisture = Math.min(85.0, prev.soilMoisture + 0.3);

        if (remaining <= 0) {
          return {
            ...prev,
            isPumpRunning: false,
            pumpStartedAt: null,
            pumpSecondsRemaining: 0,
            lastPumpStopAt: Date.now(),
            totalRuntimeTodaySeconds: prev.totalRuntimeTodaySeconds + prev.pumpDurationSeconds,
            soilMoisture: Number(newMoisture.toFixed(1)),
          };
        }

        return {
          ...prev,
          pumpSecondsRemaining: remaining,
          soilMoisture: Number(newMoisture.toFixed(1)),
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemoMode]);

  // Sync demo telemetry whenever demoState changes
  useEffect(() => {
    if (isDemoMode) {
      setTelemetry(computeDemoTelemetry(demoState));
    }
  }, [demoState, isDemoMode]);

  // Handlers for Pump Commands
  const handleStartPump = async (durationSeconds: number) => {
    if (!isDemoMode) {
      alert('Live motor control is disabled until Arduino confirmation is verified.');
      return;
    }
    setDemoState((prev) => ({
      ...prev,
      isPumpRunning: true,
      pumpDurationSeconds: durationSeconds,
      pumpStartedAt: Date.now(),
      pumpSecondsRemaining: durationSeconds,
    }));
  };

  const handleStopPump = async () => {
    if (!isDemoMode) {
      alert('Live motor control is disabled until Arduino confirmation is verified.');
      return;
    }
    setDemoState((prev) => ({
      ...prev,
      isPumpRunning: false,
      pumpStartedAt: null,
      pumpSecondsRemaining: 0,
      lastPumpStopAt: Date.now(),
    }));
  };

  // Handlers for Farm Assistant Chatbot (using live backend context, strictly via /api/chat)
  const handleProcessVoiceCommand = async (transcript: string) => {
    const backendUrl = getBackendApiUrl();
    if (!backendUrl || !farmId) throw new Error('Pi farm connection is unavailable');
    const res = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: transcript, farm_id: farmId }),
      signal: AbortSignal.timeout(30000),
    });

    const json = await res.json();
    if (!res.ok || json.success === false) throw new Error(json.error || 'Pi chatbot unavailable');

    // Grok is strictly conversational AI and returns command_result: null.
    // Motor actions are only triggered if command_result is returned by an authorized actuator.
    if (json.command_result?.success) {
      if (json.intent === 'PUMP_ON' || json.intent === 'CONFIRM_IRRIGATION') {
        const secs = json.parameters?.duration_seconds || 300;
        if (isDemoMode) {
          setDemoState((prev) => ({
            ...prev,
            isPumpRunning: true,
            pumpDurationSeconds: secs,
            pumpStartedAt: Date.now(),
            pumpSecondsRemaining: secs,
          }));
        } else {
          setIsCommandPending(true);
        }
      } else if (json.intent === 'PUMP_OFF' || json.intent === 'CANCEL_IRRIGATION') {
        if (isDemoMode) {
          setDemoState((prev) => ({
            ...prev,
            isPumpRunning: false,
            pumpStartedAt: null,
            pumpSecondsRemaining: 0,
            lastPumpStopAt: Date.now(),
          }));
        } else {
          fetchLiveStatus();
        }
      }
    }

    return json;
  };

  // VoIP Triggers
  const handleTriggerVoIPCall = async () => {
    const res = await fetch('/api/calls/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farm_id: farmId,
        phone_number: '+91 98765 43210',
        farmer_name: 'రామేశ్ కుమార్ (Ramesh Kumar)',
        soil_moisture: telemetry.latest_sensor.soil_moisture,
        rain_probability: telemetry.weather.rain_probability,
        suggested_duration_seconds: telemetry.recommendation.suggested_duration_seconds || 180,
        explanation_te: telemetry.recommendation.explanation_te,
      }),
    });

    const data = await res.json();
    if (data.call) {
      setActiveVoIPCall(data.call);
      setIsVoIPModalOpen(true);
    }
  };

  const handleAnswerCall = async () => {
    if (activeVoIPCall) {
      setActiveVoIPCall({ ...activeVoIPCall, status: 'connected' });
    }
  };

  const handleConfirmCallIrrigation = async (callId: string, durationSeconds: number) => {
    await handleStartPump(durationSeconds);
    if (activeVoIPCall) {
      setActiveVoIPCall({ ...activeVoIPCall, status: 'completed', isConfirmed: true });
    }
  };

  const handleEndCall = async () => {
    if (activeVoIPCall) {
      setActiveVoIPCall({ ...activeVoIPCall, status: 'completed' });
    }
    setIsVoIPModalOpen(false);
  };

  if (!backendReady && !isDemoMode) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9f6] p-6">
        <div className="max-w-lg rounded-xl border border-stone-200 bg-white p-6 text-stone-800">
          <h1 className="text-xl font-bold">Smart Farm</h1>
          <p className="mt-3">{backendError || 'Connecting to Raspberry Pi backend...'}</p>
          {backendError && <button className="mt-4 rounded bg-emerald-700 px-4 py-2 text-white" onClick={() => window.location.reload()}>Retry connection</button>}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9f6] dark:bg-[#0d1512] text-stone-900 dark:text-stone-100">
      {/* ==================== 1. HEADER ==================== */}
      <Navbar
        farm={telemetry.farm}
        device={telemetry.device}
        currentField={activeField}
        fields={savedFields}
        onSelectField={handleSelectField}
        isDemoMode={isDemoMode}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'te' ? 'en' : 'te'))}
        onOpenVoIPCall={handleTriggerVoIPCall}
        onToggleDemoDrawer={() => {
          setIsDemoMode(true);
          setIsDemoDrawerOpen(true);
        }}
      />

      {/* ==================== MAIN CONTENT CONTAINER ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!isDemoMode && telemetry.source === 'raspberry_pi' && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
            Connected to Raspberry Pi backend{telemetry.is_demo_mode
              ? telemetry.serial_connected
                ? ' • This selected farm has no live Arduino sensor data'
                : telemetry.serial_port_open
                  ? ' • Serial port is open, but no valid Arduino sensor packets have arrived'
                  : ' • Arduino serial port could not be opened'
              : ' • Live Arduino sensor data is active'}.
          </div>
        )}
        {/* Offline notice if gateway is disconnected */}
        {telemetry.device.is_stale && !isDemoMode && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center justify-between">
            <span className="font-semibold">
              ⚠️ {language === 'te'
                ? 'ఫీల్డ్ గేట్‌వే ఆఫ్‌లైన్‌లో ఉంది. చివరి డేటా ప్రదర్శించబడుతోంది.'
                : 'Field Gateway is offline. Displaying last synchronized readings.'}
            </span>
            <span className="font-mono text-[11px]">
              {new Date(telemetry.device.last_seen).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* ==================== 2. TOP METRICS ==================== */}
        {/* Soil Moisture (XX% + Dry/Moderate/Good/Wet status), Temperature, Humidity, Motor Status */}
        <TelemetryGrid
          sensor={telemetry.latest_sensor}
          device={telemetry.device}
          targetMin={telemetry.farm.target_moisture_min}
          targetMax={telemetry.farm.target_moisture_max}
          isMotorRunning={telemetry.active_pump.is_running}
          isMotorPending={isCommandPending || telemetry.active_pump.is_pending}
          remainingSeconds={telemetry.active_pump.remaining_seconds}
          sensorLabel={telemetry.is_demo_mode ? 'No live Arduino data' : 'Arduino sensor'}
          language={language}
          onQuickStartPump={isDemoMode ? handleStartPump : undefined}
          onQuickStopPump={isDemoMode ? handleStopPump : undefined}
        />

        {/* ==================== 3. MAIN CONTENT ==================== */}
        {/* Irrigation Recommendation Banner (Visually Prominent) */}
        <RecommendationBanner
          recommendation={telemetry.recommendation}
          isPumpRunning={telemetry.active_pump.is_running}
          language={language}
          controlsEnabled={isDemoMode}
          onConfirmIrrigation={handleStartPump}
          onRejectIrrigation={() => {
            alert(
              language === 'te'
                ? 'సిఫార్సు రద్దు చేయబడింది. పంప్ ఆఫ్‌లోనే ఉంటుంది.'
                : 'Irrigation recommendation dismissed.'
            );
          }}
        />

        {/* Weather & Farm Map (Side-by-Side or responsive stacked) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Farm Map (Leaves 7 columns on desktop for detailed spatial interaction) */}
          <div className="lg:col-span-7">
            <FarmMap
              initialCenter={activeField?.center || { lat: 16.5062, lng: 80.6480 }}
              activeField={activeField}
              savedFields={savedFields}
              language={language}
              onSelectField={handleSelectField}
              onSaveField={handleSaveField}
              readOnly={!isDemoMode}
            />
          </div>

          {/* Weather Card (Anchored directly to field center coordinates) */}
          <div className="lg:col-span-5 h-full">
            <WeatherCard
              weather={telemetry.weather}
              activeField={activeField}
              language={language}
            />
          </div>
        </div>

        {/* ==================== 4. LOWER CONTENT ==================== */}
        {/* Farm Assistant Chatbot & Field Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Farm Assistant Chatbot */}
          <PushToTalkButton
            onProcessCommand={handleProcessVoiceCommand}
            language={language}
          />

          {/* Field Management Panel */}
          <FieldManagement
            fields={savedFields}
            activeField={activeField}
            language={language}
            onSelectField={handleSelectField}
            onDeleteField={handleDeleteField}
            readOnly={!isDemoMode}
            onAddNewField={() => {
              const el = document.getElementById('btn-add-field');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.click();
              }
            }}
          />
        </div>

        {/* Supplementary Controls: Pump Controller & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {isDemoMode ? <PumpControlCard
            isRunning={telemetry.active_pump.is_running}
            isPending={isCommandPending || telemetry.active_pump.is_pending}
            commandStatus={telemetry.active_pump.command_status}
            remainingSeconds={telemetry.active_pump.remaining_seconds}
            durationSeconds={telemetry.active_pump.duration_seconds}
            cooldownActive={telemetry.active_pump.cooldown_active}
            cooldownRemainingSeconds={telemetry.active_pump.cooldown_remaining_seconds}
            language={language}
            onStartPump={handleStartPump}
            onStopPump={handleStopPump}
          /> : <div className="farm-card p-5 text-sm text-stone-700">
            <h3 className="font-bold">Motor status: {telemetry.active_pump.is_running ? 'ON' : 'OFF'}</h3>
            <p className="mt-2">Live motor controls are disabled until Arduino command acknowledgement is verified.</p>
          </div>}

          {isDemoMode ? <HistoricalCharts farmId={farmId} language={language} /> : (
            <div className="farm-card p-5 text-sm text-stone-600">Historical charts are unavailable until the Pi backend records and exposes history.</div>
          )}
        </div>
      </main>

      {/* VoIP Incoming Call Simulator Modal */}
      <VoIPCallModal
        isOpen={isVoIPModalOpen}
        callState={activeVoIPCall}
        onClose={() => setIsVoIPModalOpen(false)}
        onAnswer={handleAnswerCall}
        onConfirm={handleConfirmCallIrrigation}
        onEnd={handleEndCall}
        language={language}
      />

      {/* Interactive Demo Simulation Drawer */}
      <DemoControlDrawer
        isOpen={isDemoDrawerOpen}
        onClose={() => setIsDemoDrawerOpen(false)}
        soilMoisture={demoState.soilMoisture}
        onSoilMoistureChange={(val) =>
          setDemoState((prev) => ({ ...prev, soilMoisture: val }))
        }
        isRainSimulated={demoState.isRainSimulated}
        onToggleRain={() =>
          setDemoState((prev) => ({ ...prev, isRainSimulated: !prev.isRainSimulated }))
        }
        isGatewayOnline={demoState.device.status === 'online'}
        onToggleGatewayOnline={() =>
          setDemoState((prev) => ({
            ...prev,
            device: {
              ...prev.device,
              status: prev.device.status === 'online' ? 'offline' : 'online',
            },
          }))
        }
        onResetDemo={() => {
          setIsDemoMode(false);
          setIsDemoDrawerOpen(false);
          fetchLiveStatus();
        }}
        language={language}
      />

      {/* Footer */}
      <footer className="w-full border-t border-stone-200 dark:border-stone-800 py-4 px-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <p>
          Smart Farm • {language === 'te' ? 'రైతు సేవలో స్మార్ట్ వ్యవసాయ వేదిక' : 'Precision Agriculture Dashboard'} • Raspberry Pi 5 & Arduino IoT Architecture
        </p>
      </footer>
    </div>
  );
}
