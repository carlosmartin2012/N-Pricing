/**
 * Server-side structured logger.
 *
 * Mirrors the API of `utils/logger.ts` (browser) but runs in Node and
 * reads config from `process.env`. Zero new dependencies — uses only
 * `console.*` + `JSON.stringify` so the dependency surface stays minimal
 * (important for a regulatory-grade backend; every new dep is supply-chain).
 *
 * Output modes:
 *   - `LOG_FORMAT=json` (default in prod) — one JSON object per line; ready
 *     to ingest into Datadog / Logflare / OpenTelemetry collectors / etc.
 *   - `LOG_FORMAT=pretty` (default in dev) — `[module] message {data}` for
 *     humans tailing logs locally / on Replit.
 *
 * Level filtering via `LOG_LEVEL` (debug|info|warn|error). Default is `info`
 * in prod, `debug` in dev. Test mode (`NODE_ENV=test`) silences everything
 * to keep the vitest output clean — flip explicitly with `LOG_LEVEL=debug`
 * when chasing a flaky test.
 *
 * Future hooks:
 *   - To pipe to an external sink, replace the body of `emit()` with a
 *     transport (TCP socket, HTTP shipper, OTLP client). The structured
 *     entry shape is already sink-friendly.
 *   - To redact PII, wrap `data` in a sanitiser before `JSON.stringify`.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  module: string;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: { message: string; stack?: string; name?: string };
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const explicit = process.env.LOG_LEVEL?.toLowerCase();
  if (explicit && explicit in LEVELS) return explicit as LogLevel;
  // NOTE: vitest sets NODE_ENV=test. We DON'T silence in that mode any more —
  // many tests spy on console.warn / console.error to assert observability
  // behaviour (bootstrapAdapters fallback, attribution drift signals, etc.).
  // Tests that want quiet output can vi.spyOn(console, 'warn').mockImplementation().
  if (process.env.NODE_ENV === 'production') return 'info';
  return 'debug';
}

function getFormat(): 'json' | 'pretty' {
  const explicit = process.env.LOG_FORMAT?.toLowerCase();
  if (explicit === 'json' || explicit === 'pretty') return explicit;
  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
}

// Read env on every call (not cached). Tests routinely flip NODE_ENV /
// LOG_LEVEL / LOG_FORMAT between cases via process.env mutation; caching at
// module-load time would break those overrides. The cost (a couple of object
// lookups per log call) is negligible — the level filter still short-circuits
// before any work happens.
function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getMinLevel()];
}

function normalizeError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, name: err.name };
  }
  if (typeof err === 'object') {
    return { message: JSON.stringify(err) };
  }
  return { message: String(err) };
}

function formatLine(entry: LogEntry): string {
  if (getFormat() === 'json') return JSON.stringify(entry);
  // Pretty: human-readable, preserves the historical `[module] msg data` shape
  // so devs tailing logs locally keep the same mental model.
  const prefix = `[${entry.module}]`;
  const dataStr = entry.data && Object.keys(entry.data).length > 0
    ? ' ' + JSON.stringify(entry.data)
    : '';
  const errStr = entry.error
    ? ` error=${entry.error.name ?? 'Error'}: ${entry.error.message}`
    : '';
  return `${prefix} ${entry.message}${dataStr}${errStr}`;
}

function emit(entry: LogEntry): void {
  const line = formatLine(entry);
  // Route by level — preserves the historical mapping. Tests that spy on
  // console.warn vs console.error rely on this; container log shippers also
  // split stdout / stderr by these methods (`console.warn`/`error` → stderr).
  switch (entry.level) {
    case 'debug': console.info(line); break;
    case 'info':  console.info(line); break;
    case 'warn':  console.warn(line); break;
    case 'error':
      console.error(line);
      if (entry.error?.stack && getFormat() === 'pretty') {
        // JSON format already embeds the stack inside the entry; only print
        // it separately in pretty mode so devs see the trace in the console.
        console.error(entry.error.stack);
      }
      break;
  }
}

function createEntry(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
  err?: unknown,
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    module,
    timestamp: new Date().toISOString(),
  };
  if (data && Object.keys(data).length > 0) entry.data = data;
  const normalized = normalizeError(err);
  if (normalized) entry.error = normalized;
  return entry;
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>, err?: unknown): void;
  error(msg: string, data?: Record<string, unknown>, err?: unknown): void;
}

export function createLogger(module: string): Logger {
  return {
    debug(msg, data) {
      if (shouldLog('debug')) emit(createEntry('debug', module, msg, data));
    },
    info(msg, data) {
      if (shouldLog('info')) emit(createEntry('info', module, msg, data));
    },
    warn(msg, data, err) {
      if (shouldLog('warn')) emit(createEntry('warn', module, msg, data, err));
    },
    error(msg, data, err) {
      if (shouldLog('error')) emit(createEntry('error', module, msg, data, err));
    },
  };
}
