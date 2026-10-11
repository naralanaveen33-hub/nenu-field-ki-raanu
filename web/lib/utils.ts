import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSecondsToMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export type MoistureLevel = 'Dry' | 'Moderate' | 'Good' | 'Wet';

export function getMoistureStatus(value: number, min = 30, max = 65): {
  level: MoistureLevel;
  label_en: string;
  label_te: string;
  color: string;
  badgeBg: string;
} {
  // Moderate range is typically the buffer below optimal threshold (e.g., 25% - 35%)
  const moderateThreshold = Math.max(15, min - 8);

  if (value < moderateThreshold) {
    return {
      level: 'Dry',
      label_en: 'Dry',
      label_te: 'పొడి (డ్రై)',
      color: 'text-amber-700 dark:text-amber-400',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
    };
  } else if (value < min) {
    return {
      level: 'Moderate',
      label_en: 'Moderate',
      label_te: 'మధ్యస్థం',
      color: 'text-yellow-700 dark:text-yellow-400',
      badgeBg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
    };
  } else if (value <= max) {
    return {
      level: 'Good',
      label_en: 'Good',
      label_te: 'మంచిది (ఆరోగ్యకరం)',
      color: 'text-emerald-700 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    };
  } else {
    return {
      level: 'Wet',
      label_en: 'Wet',
      label_te: 'తడి (అధిక తేమ)',
      color: 'text-blue-700 dark:text-blue-400',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-700'
    };
  }
}

/**
 * Calculates geometric centroid center of a polygon coordinates array
 */
export function calculatePolygonCenter(coords: [number, number][]): { lat: number; lng: number } {
  if (!coords || coords.length === 0) {
    return { lat: 16.5062, lng: 80.6480 };
  }
  let sumLat = 0;
  let sumLng = 0;
  coords.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });
  return {
    lat: Number((sumLat / coords.length).toFixed(4)),
    lng: Number((sumLng / coords.length).toFixed(4))
  };
}

/**
 * Calculates approximate field area in acres using spherical excess
 */
export function calculatePolygonAreaAcres(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137; // Earth radius in meters
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const p1 = coords[i];
    const p2 = coords[j];
    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lon1 = (p1[1] * Math.PI) / 180;
    const lon2 = (p2[1] * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2.0);
  const sqMetersToAcres = 0.000247105;
  const acres = Number((area * sqMetersToAcres).toFixed(2));
  return acres > 0 ? acres : 0.5;
}


export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 10) return "ఇప్పుడే (just now)";
  if (diffSecs < 60) return `${diffSecs} క్షణాల క్రితం (${diffSecs}s ago)`;
  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return `${mins} నిమిషాల క్రితం (${mins}m ago)`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} గంటల క్రితం (${hours}h ago)`;
  const days = Math.floor(hours / 24);
  return `${days} రోజుల క్రితం (${days}d ago)`;
}
