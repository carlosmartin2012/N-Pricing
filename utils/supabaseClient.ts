import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = 'https://offline-mode.supabase.co';
const fallbackSupabaseAnonKey = 'offline-demo-key';

// Supabase disabled — app runs fully on local seed data.
// Re-enable when DB has seeded data and RLS policies allow anonymous read access.
// Original: export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = false;

if (!isSupabaseConfigured) {
    console.warn('Supabase credentials missing. Realtime features will be disabled.');
}

export const supabase = createClient(
    supabaseUrl || fallbackSupabaseUrl,
    supabaseAnonKey || fallbackSupabaseAnonKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
        realtime: {
            params: {
                eventsPerSecond: 2,
            },
        },
        global: {
            headers: {
                'x-client-info': 'n-pricing/1.0',
            },
        },
    }
);
