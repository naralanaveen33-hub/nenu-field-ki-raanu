'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Plus, Save, RotateCcw, Check, AlertCircle, Layers } from 'lucide-react';
import { FarmField } from '@/types';
import { calculatePolygonCenter, calculatePolygonAreaAcres } from '@/lib/utils';

interface FarmMapLeafletProps {
  initialCenter?: { lat: number; lng: number };
  activeField: FarmField | null;
  savedFields: FarmField[];
  language: 'te' | 'en';
  onSelectField: (field: FarmField) => void;
  onSaveField: (field: FarmField) => void;
}

export default function FarmMapLeaflet({
  initialCenter = { lat: 16.5062, lng: 80.6480 },
  activeField,
  savedFields,
  language,
  onSelectField,
  onSaveField,
}: FarmMapLeafletProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups
  const userMarkerRef = useRef<L.Marker | null>(null);
  const activePolygonRef = useRef<L.Polygon | null>(null);
  const drawnPolygonRef = useRef<L.Polygon | null>(null);
  const drawnPointsGroupRef = useRef<L.LayerGroup | null>(null);
  const savedPolygonsGroupRef = useRef<L.LayerGroup | null>(null);

  // States
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCoords, setDrawCoords] = useState<[number, number][]>([]);

  // Field Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCrop, setFieldCrop] = useState('Paddy');
  const [fieldArea, setFieldArea] = useState('');

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on active field if available, else initialCenter
    const centerLat = activeField?.center?.lat ?? initialCenter.lat;
    const centerLng = activeField?.center?.lng ?? initialCenter.lng;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 16,
      zoomControl: false, // Custom positioned zoom or mobile friendly
    });

    // Add zoom control top-right for mobile ergonomics
    L.control.zoom({ position: 'topright' }).addTo(map);

    // High quality OpenStreetMap standard tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Initialize layer groups
    drawnPointsGroupRef.current = L.layerGroup().addTo(map);
    savedPolygonsGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // 2. Initial map location check via Geolocation API
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setUserLocation({ lat, lng });

          // Show User Location Marker
          showUserLocationMarker(map, lat, lng);

          // If no active field exists, gently center on user
          if (!activeField) {
            map.setView([lat, lng], 16);
          }
        },
        (err) => {
          // Gracefully fallback to saved field or default coordinates without breaking map
          console.log('[Map] Browser geolocation unavailable or denied. Using default/field coords.');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Helper to render User Location Marker
  const showUserLocationMarker = (map: L.Map, lat: number, lng: number) => {
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
    }

    const userIcon = L.divIcon({
      className: 'custom-location-pin',
      html: `
        <div class="custom-pulse-ring">
          <div class="custom-pulse-dot"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([lat, lng], { icon: userIcon })
      .bindPopup(`
        <div style="font-size: 12px; font-weight: 600; padding: 2px;">
          📍 ${language === 'te' ? 'మీ ప్రస్తుత స్థానం' : 'Your current location'}
        </div>
      `)
      .addTo(map);

    userMarkerRef.current = marker;
  };

  // Render Saved Fields Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = savedPolygonsGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    savedFields.forEach((f) => {
      if (!f.coordinates || f.coordinates.length < 3) return;

      const isCurrentActive = activeField?.id === f.id;

      const poly = L.polygon(f.coordinates, {
        color: isCurrentActive ? '#15803d' : '#059669',
        weight: isCurrentActive ? 3 : 2,
        fillColor: isCurrentActive ? '#22c55e' : '#10b981',
        fillOpacity: isCurrentActive ? 0.35 : 0.18,
      });

      poly.bindTooltip(`<strong>${f.name}</strong> • ${f.crop} (${f.area})`, {
        permanent: false,
        direction: 'center',
      });

      poly.on('click', () => {
        onSelectField(f);
      });

      poly.addTo(group);
    });
  }, [savedFields, activeField, onSelectField]);

  // Center on Active Field when it changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeField) return;

    if (activeField.center?.lat && activeField.center?.lng) {
      map.setView([activeField.center.lat, activeField.center.lng], 16, { animate: true });
    }
  }, [activeField]);

  // Map Click Handler for Field Drawing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawing) return;

      const newPoint: [number, number] = [
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6)),
      ];

      setDrawCoords((prev) => [...prev, newPoint]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawing]);

  // Update Drawing Preview on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const pointsGroup = drawnPointsGroupRef.current;
    if (!map || !pointsGroup) return;

    pointsGroup.clearLayers();

    if (drawnPolygonRef.current) {
      map.removeLayer(drawnPolygonRef.current);
      drawnPolygonRef.current = null;
    }

    if (drawCoords.length === 0) return;

    // Add point markers
    drawCoords.forEach((pt, idx) => {
      const marker = L.circleMarker(pt, {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#16a34a',
        fillOpacity: 0.9,
      }).bindTooltip(`Point ${idx + 1}`);

      marker.addTo(pointsGroup);
    });

    // Draw connecting polygon or polyline
    if (drawCoords.length >= 3) {
      const poly = L.polygon(drawCoords, {
        color: '#15803d',
        dashArray: '5, 5',
        weight: 2,
        fillColor: '#86efac',
        fillOpacity: 0.3,
      }).addTo(map);

      drawnPolygonRef.current = poly;
    } else if (drawCoords.length === 2) {
      const line = L.polyline(drawCoords, {
        color: '#15803d',
        dashArray: '5, 5',
        weight: 2,
      }).addTo(pointsGroup);
    }
  }, [drawCoords]);

  // Nearby Location UX: "📍 Use my location"
  const handleUseMyLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus(
        language === 'te'
          ? 'ఈ బ్రౌజర్‌లో లొకేషన్ అందుబాటులో లేదు.'
          : 'Geolocation is not supported by your browser.'
      );
      return;
    }

    setIsLocating(true);
    setLocationStatus(language === 'te' ? 'లొకేషన్ కోసం చూస్తోంది...' : 'Locating your farm position...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setUserLocation({ lat, lng });

        const map = mapInstanceRef.current;
        if (map) {
          map.setView([lat, lng], 17, { animate: true });
          showUserLocationMarker(map, lat, lng);
        }

        setLocationStatus(
          language === 'te'
            ? 'మీ లొకేషన్ గుర్తించబడింది. మీరు ఇప్పుడు పొలం సరిహద్దును గీయవచ్చు.'
            : 'Located! You can now draw or inspect your field boundary.'
        );

        setTimeout(() => setLocationStatus(null), 4000);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        setLocationStatus(
          language === 'te'
            ? 'లొకేషన్ అనుమతి నిరాకరించబడింది. మ్యాప్‌ను జూమ్ చేసి పొలాన్ని ఎంచుకోండి.'
            : 'Location access denied or timed out. You can still zoom and draw manually.'
        );
        setTimeout(() => setLocationStatus(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [language]);

  // Start Add Field / Drawing
  const handleStartAddField = () => {
    setIsDrawing(true);
    setDrawCoords([]);
    setLocationStatus(
      language === 'te'
        ? 'మ్యాప్‌పై క్లిక్ చేసి పొలం సరిహద్దు పాయింట్లను గుర్తించండి (కనీసం 3 పాయింట్లు).'
        : 'Click on the map around your field to add boundary points (at least 3).'
    );
  };

  // Open Save Modal
  const handleTriggerSave = () => {
    if (drawCoords.length < 3) {
      alert(
        language === 'te'
          ? 'దయచేసి పొలం సరిహద్దును గీయడానికి మ్యాప్‌పై కనీసం 3 పాయింట్లను క్లిక్ చేయండి.'
          : 'Please click on the map to place at least 3 points for the field boundary.'
      );
      return;
    }

    // Auto calculate area in acres
    const calculatedAcres = calculatePolygonAreaAcres(drawCoords);
    setFieldArea(`${calculatedAcres} ${language === 'te' ? 'ఎకరాలు (Acres)' : 'Acres'}`);
    setFieldName(
      language === 'te'
        ? `పొలం ${savedFields.length + 1}`
        : `Field ${savedFields.length + 1}`
    );
    setShowSaveModal(true);
  };

  // Confirm Save Field
  const handleConfirmSaveField = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fieldName.trim()) return;

    // Calculate exact polygon center
    const center = calculatePolygonCenter(drawCoords);

    const newField: FarmField = {
      id: `field_${Date.now()}`,
      name: fieldName.trim(),
      crop: fieldCrop,
      area: fieldArea.trim() || '1.0 Acres',
      coordinates: drawCoords,
      center: center,
      created_at: new Date().toISOString(),
    };

    onSaveField(newField);
    onSelectField(newField);

    setIsDrawing(false);
    setDrawCoords([]);
    setShowSaveModal(false);
    setLocationStatus(
      language === 'te' ? 'పొలం విజయవంతంగా భద్రపరచబడింది!' : 'Field boundary saved successfully!'
    );
    setTimeout(() => setLocationStatus(null), 4000);
  };

  // Reset / Cancel Drawing
  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawCoords([]);
    setLocationStatus(null);
  };

  // Current selected or drawn center coordinates for display
  const displayField = activeField;
  const currentCenter = isDrawing && drawCoords.length > 0
    ? calculatePolygonCenter(drawCoords)
    : displayField?.center ?? initialCenter;

  return (
    <div className="space-y-4">
      {/* Map Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 1: [📍 Use my location] */}
          <button
            type="button"
            id="btn-use-my-location"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs disabled:opacity-50 min-h-[40px]"
          >
            <Navigation className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>
              {language === 'te' ? '📍 నా లొకేషన్ ఉపయోగించండి' : '📍 Use my location'}
            </span>
          </button>

          {/* Button 2: [＋ Add field] */}
          {!isDrawing ? (
            <button
              type="button"
              id="btn-add-field"
              onClick={handleStartAddField}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 transition-colors shadow-xs min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{language === 'te' ? '＋ పొలం జోడించండి' : '＋ Add field'}</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-cancel-drawing"
              onClick={handleCancelDrawing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition-colors min-h-[40px]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{language === 'te' ? 'రద్దు చేయి' : 'Cancel'}</span>
            </button>
          )}

          {/* Button 3: [Save field] */}
          {isDrawing && (
            <button
              type="button"
              id="btn-save-field"
              onClick={handleTriggerSave}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs min-h-[40px]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>
                {language === 'te' ? 'పొలం భద్రపరచండి' : 'Save field'} ({drawCoords.length} pts)
              </span>
            </button>
          )}
        </div>

        {/* Mobile-friendly quick locate icon button */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          aria-label="Locate me"
          title={language === 'te' ? 'నన్ను గుర్తించు' : 'Locate me'}
          className="sm:hidden p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Helpful Status / Feedback Message */}
      {locationStatus && (
        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>{locationStatus}</span>
        </div>
      )}

      {/* Interactive Leaflet Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900">
        <div
          ref={mapContainerRef}
          className="w-full h-[320px] sm:h-[380px] lg:h-[420px]"
          style={{ minHeight: '300px' }}
        />

        {/* Floating Drawing Helper Pill */}
        {isDrawing && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] bg-white/95 dark:bg-stone-900/95 p-2.5 rounded-lg border border-stone-300 dark:border-stone-700 shadow-sm text-xs flex items-center justify-between gap-3">
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {language === 'te'
                ? `సరిహద్దు పాయింట్లు: ${drawCoords.length}`
                : `Boundary points: ${drawCoords.length}`}
            </span>
            {drawCoords.length > 0 && (
              <button
                type="button"
                onClick={() => setDrawCoords((prev) => prev.slice(0, -1))}
                className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-[11px] underline"
              >
                {language === 'te' ? 'చివరి పాయింట్ తొలగించు' : 'Undo last'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Field Information Section (Required exact format) */}
      <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 w-full sm:w-auto">
          <div>
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">Field:</span>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {displayField?.name || (language === 'te' ? 'ఎంచుకోబడలేదు' : 'Not selected')}
            </strong>
          </div>

          <div>
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">Crop:</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {displayField?.crop || 'Paddy'}
            </span>
          </div>

          <div>
            <span className="text-stone-500 dark:text-stone-400 block text-[11px]">Center:</span>
            <span className="font-mono text-stone-800 dark:text-stone-200 font-medium">
              {currentCenter.lat.toFixed(4)}, {currentCenter.lng.toFixed(4)}
            </span>
          </div>
        </div>

        {displayField && (
          <div className="text-[11px] text-stone-500 dark:text-stone-400 shrink-0">
            {displayField.coordinates?.length || 0} polygon coordinates • Area: {displayField.area}
          </div>
        )}
      </div>

      {/* Save Field Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-stone-900 p-5 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {language === 'te' ? 'పొలం వివరాలను నమోదు చేయండి' : 'Save Field Boundary'}
            </h4>

            <form onSubmit={handleConfirmSaveField} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  {language === 'te' ? 'పొలం పేరు (Field Name):' : 'Field Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g. North Field"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  {language === 'te' ? 'పంట (Crop):' : 'Crop:'}
                </label>
                <select
                  value={fieldCrop}
                  onChange={(e) => setFieldCrop(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="Paddy">Paddy (వరి)</option>
                  <option value="Cotton">Cotton (ప్రత్తి)</option>
                  <option value="Chilli">Chilli (మిర్చి)</option>
                  <option value="Maize">Maize (మొక్కజొన్న)</option>
                  <option value="Groundnut">Groundnut (వేరుశనగ)</option>
                  <option value="Vegetables">Vegetables (కూరగాయలు)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  {language === 'te' ? 'విస్తీర్ణం (Area):' : 'Area:'}
                </label>
                <input
                  type="text"
                  value={fieldArea}
                  onChange={(e) => setFieldArea(e.target.value)}
                  placeholder="e.g. 3.5 Acres"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                >
                  {language === 'te' ? 'రద్దు' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                >
                  {language === 'te' ? 'భద్రపరచు (Save)' : 'Save Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
