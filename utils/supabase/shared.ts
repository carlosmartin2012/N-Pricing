import { supabase } from '../supabaseClient';
import { createLogger } from '../logger';

export { supabase };

export const log = createLogger('supabase');

export const nowIso = () => new Date().toISOString();
export const todayIso = () => nowIso().split('T')[0];
