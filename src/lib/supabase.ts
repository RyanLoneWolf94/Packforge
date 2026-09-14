import { createClient } from '@supabase/supabase-js';

/**
 * The single Supabase client for the app. The URL and publishable key are
 * public by design (the key ships in the browser bundle); all real protection
 * comes from row-level security in the database, not from hiding this key.
 *
 * Values come from Vite env vars so the same build can point at a different
 * project without code changes. See `.env.example`.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when the app has been configured with Supabase credentials. */
export const isSupabaseConfigured = Boolean(url && key);

if (!isSupabaseConfigured) {
  // Loud in dev, harmless in prod: the app renders a config notice instead of
  // silently failing every request.
  console.error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
