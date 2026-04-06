import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = 'https://offline-mode.supabase.co';
const fallbackSupabaseAnonKey = 'offline-demo-key';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
    }
);
