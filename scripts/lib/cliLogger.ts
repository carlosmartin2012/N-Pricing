/**
 * CLI / Script structured logger.
 *
 * Zero-dependency, Node + tsx friendly. Same Logger interface as server/logger.ts
 * and utils/logger.ts for consistency across the platform.
 *
 * Usage:
 *   import { createLogger } from './lib/cliLogger';
 *   const logger = createLogger('provision-tenant');
 *   logger.info('starting', { shortCode });
 *   logger.error('failed', { code: 'DB_ERROR' }, err);
 *
 * Output:
 *   - Pretty (default for humans): [provision-tenant] starting {"shortCode":"BBVA-ES"}
 *   - JSON (when LOG_FORMAT=json or CI=true): {"level":"info","message":"starting",...}
 *
 * Levels: debug | info | warn | error (filtered by LOG_LEVEL, default debug in dev, info in CI/prod).
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
  // In CI / production-like environments, be quieter by default
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') return 'info';
  return 'debug';
}

function getFormat(): 'json' | 'pretty' {
  const explicit = process.env.LOG_FORMAT?.toLowerCase();
  if (explicit === 'json' || explicit === 'pretty') return explicit;
  return (process.env.CI === 'true' || process.env.NODE_ENV === 'production') ? 'json' : 'pretty';
}

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
  if (getFormat() === 'json') {
    return JSON.stringify(entry);
  }
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
  switch (entry.level) {
    case 'debug':
    case 'info':
      console.info(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      if (entry.error?.stack && getFormat() === 'pretty') {
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
