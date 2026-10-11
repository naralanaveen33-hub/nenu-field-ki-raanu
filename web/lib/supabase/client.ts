import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Server-only key: NEVER prefix with NEXT_PUBLIC_ so it is never bundled to client browser
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let browserClient: SupabaseClient | null = null;
let serverServiceClient: SupabaseClient | null = null;

/**
 * Returns public Supabase client using Anon Key.
 * Safe for both browser and server read queries respecting RLS.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient && supabaseUrl && supabaseAnonKey) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

/**
 * Returns trusted server-side Supabase client using Service Role Key.
 * STRICT SECURITY: ONLY callable inside Node.js / Server Routes.
 * Never callable from browser.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL SECURITY VIOLATION: getSupabaseServerClient cannot be called in browser code.');
  }

  const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
  if (!supabaseUrl || !keyToUse) return null;

  if (!serverServiceClient) {
    serverServiceClient = createClient(supabaseUrl, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return serverServiceClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceRoleKey) && !supabaseUrl.includes('your-project'));
}
