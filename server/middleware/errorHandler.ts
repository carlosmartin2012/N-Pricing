/**
 * Sanitize error messages for API responses.
 *
 * Behaviour:
 *   - NODE_ENV=development → returns raw error string (so dev sees the cause).
 *   - VERBOSE_ERRORS=true  → same, EXCEPT in production. In prod we ignore
 *     this flag because a misconfigured env var should never leak SQL state,
 *     stack frames, or PG error codes to the client.
 *   - Otherwise            → generic 'Internal server error'.
 *
 * The previous implementation honoured VERBOSE_ERRORS unconditionally, which
 * meant a leaked or accidentally-set env var in production would expose
 * Postgres errors (e.g. `relation "deals" does not exist at character 21`)
 * to any caller hitting a 500.
 */
export function safeError(err: unknown): string {
  const isProd = process.env.NODE_ENV === 'production';
  if (process.env.NODE_ENV === 'development') {
    return String(err);
  }
  if (process.env.VERBOSE_ERRORS === 'true' && !isProd) {
    return String(err);
  }
  return 'Internal server error';
}
