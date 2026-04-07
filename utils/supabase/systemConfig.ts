import { apiGet, apiPost } from '../apiFetch';
import { log } from './shared';

export async function fetchSystemConfigValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const result = await apiGet<{ value: T }>(`/config/system-config/${key}`);
    if (result.value === null || result.value === undefined) return fallback;
    return result.value;
  } catch (err) {
    log.warn('fetchSystemConfigValue failed', { key, error: String(err) });
    return fallback;
  }
}

export async function saveSystemConfigValue(key: string, value: unknown, operation: string): Promise<void> {
  try {
    await apiPost(`/config/system-config/${key}`, { value });
  } catch (err) {
    log.warn(`${operation} failed`, { key, error: String(err) });
  }
}
