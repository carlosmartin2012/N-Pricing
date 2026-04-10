import { createLogger } from './logger';

const log = createLogger('supabase');

/**
 * Safe wrapper for Supabase calls with error handling.
 */
export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  fallback: T,
  context?: string,
): Promise<{ data: T; error: string | null }> {
  try {
    const { data, error } = await operation();
    if (error) {
      const msg = `${context || 'Supabase'}: ${error.message || error.code || 'Unknown error'}`;
      log.error(msg, { context, code: error.code });
      return { data: fallback, error: msg };
    }
    return { data: data ?? fallback, error: null };
  } catch (err: any) {
    const msg = `${context || 'Supabase'}: ${err.message || 'Network error'}`;
    log.error(msg, { context }, err instanceof Error ? err : new Error(String(err)));
    return { data: fallback, error: msg };
  }
}
