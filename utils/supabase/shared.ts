export { supabase } from '../supabaseClient';
import { createLogger } from '../logger';

export const log = createLogger('api');
export const nowIso = () => new Date().toISOString();
export const todayIso = () => nowIso().split('T')[0];
