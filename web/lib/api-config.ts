/**
 * API Configuration for SmartFarm Frontend
 * 
 * Provides centralized backend URL configuration supporting both
 * local development and Vercel cloud deployment.
 * 
 * Architecture:
 * Vercel (Next.js Frontend)
 *   ↓ HTTPS (via NEXT_PUBLIC_API_URL)
 * Raspberry Pi Flask Backend (port 5000 / public tunnel)
 *   ↓ Serial (9600 baud)
 * Arduino Uno
 *   ↓
 * Relay / Soil Moisture / DHT11
 */

export function getBackendApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In local development default to Flask backend
  if (process.env.NODE_ENV === 'development') {
    return 'http://127.0.0.1:5000';
  }

  // In production, fallback placeholder until user sets Vercel environment variable
  return '';
}
