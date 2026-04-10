/**
 * Sanitize error messages for API responses.
 * In development or when VERBOSE_ERRORS is set, the raw error string is returned.
 * In production, a generic message is returned to avoid leaking SQL/internal details.
 */
export function safeError(err: unknown): string {
  if (process.env.NODE_ENV === 'development' || process.env.VERBOSE_ERRORS === 'true') {
    return String(err);
  }
  return 'Internal server error';
}
