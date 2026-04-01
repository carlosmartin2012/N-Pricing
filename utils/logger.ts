type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  module: string;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

function getMinLevel(): LogLevel {
  // In production, only warn+error; in dev, everything
  if (import.meta.env.PROD) return 'warn';
  return 'debug';
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getMinLevel()];
}

function createEntry(level: LogLevel, module: string, message: string, data?: Record<string, unknown>, err?: Error): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    module,
    timestamp: new Date().toISOString(),
  };
  if (data) entry.data = data;
  if (err) entry.error = { message: err.message, stack: err.stack };
  return entry;
}

function emit(entry: LogEntry) {
  // Buffer for potential export
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

  // Console output
  const prefix = `[${entry.module}]`;
  switch (entry.level) {
    case 'debug': console.debug(prefix, entry.message, entry.data || ''); break;
    case 'info': console.info(prefix, entry.message, entry.data || ''); break;
    case 'warn': console.warn(prefix, entry.message, entry.data || ''); break;
    case 'error': console.error(prefix, entry.message, entry.data || '', entry.error || ''); break;
  }

  // Future: send to Sentry, Datadog, etc.
  // if (entry.level === 'error' && window.Sentry) { ... }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('debug')) emit(createEntry('debug', module, msg, data));
    },
    info: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('info')) emit(createEntry('info', module, msg, data));
    },
    warn: (msg: string, data?: Record<string, unknown>) => {
      if (shouldLog('warn')) emit(createEntry('warn', module, msg, data));
    },
    error: (msg: string, data?: Record<string, unknown>, err?: Error) => {
      if (shouldLog('error')) emit(createEntry('error', module, msg, data, err));
    },
  };
}

/** Get recent log entries (for debugging / export) */
export function getLogBuffer(): ReadonlyArray<LogEntry> {
  return logBuffer;
}

/** Export log buffer as JSON string */
export function exportLogs(): string {
  return JSON.stringify(logBuffer, null, 2);
}
