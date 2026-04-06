import { log, nowIso, supabase } from './shared';

export async function fetchSystemConfigValue<T>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) return fallback;
    return (data?.value as T) ?? fallback;
  } catch (error) {
    log.warn('fetchSystemConfigValue failed', { key, error: String(error) });
    return fallback;
  }
}

export async function saveSystemConfigValue(
  key: string,
  value: unknown,
  operation: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_config')
      .upsert({ key, value, updated_at: nowIso() });

    if (error) {
      log.error(`${operation} failed`, { key, code: error.code });
    }
  } catch (error) {
    log.warn(`${operation} failed`, { key, error: String(error) });
  }
}
