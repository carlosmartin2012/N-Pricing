import { createLogger } from './logger';

const log = createLogger('supabase');

interface SupabaseLikeError {
  message?: string;
  code?: string;
}

/**
 * Safe wrapper for Supabase calls with error handling.
 */
export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: SupabaseLikeError | null }>,
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Network error';
    const msg = `${context || 'Supabase'}: ${errorMessage}`;
    log.error(msg, { context }, err instanceof Error ? err : new Error(String(err)));
    return { data: fallback, error: msg };
  }
}
