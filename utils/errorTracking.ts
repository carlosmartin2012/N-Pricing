/**
 * Lightweight, extensible error tracking infrastructure.
 *
 * - Logs to console in development
 * - Stores recent errors in a circular buffer (last 50)
 * - Supports pluggable reporters (Supabase audit log, Sentry, etc.)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorContext {
  module?: string;
  userId?: string;
  dealId?: string;
  extra?: Record<string, unknown>;
}

export interface TrackedError {
  timestamp: string;
  error: { message: string; stack?: string };
  context?: ErrorContext;
}

export interface TrackedMessage {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  context?: ErrorContext;
}

export interface ErrorReporter {
  name: string;
  onException(error: Error, context?: ErrorContext): void;
  onMessage?(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext): void;
}

interface UserInfo {
  id: string;
  email: string;
  role: string;
}

interface ErrorTrackerConfig {
  dsn?: string;
  environment?: string;
}

interface ErrorTracker {
  init(config?: ErrorTrackerConfig): void;
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext): void;
  setUser(user: UserInfo): void;
  getRecentErrors(): ReadonlyArray<TrackedError>;
  getRecentMessages(): ReadonlyArray<TrackedMessage>;
  addReporter(reporter: ErrorReporter): void;
  removeReporter(name: string): void;
}

// ---------------------------------------------------------------------------
// Circular buffer
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 50;
const errorBuffer: TrackedError[] = [];
const messageBuffer: TrackedMessage[] = [];

function pushError(entry: TrackedError) {
  errorBuffer.push(entry);
  if (errorBuffer.length > BUFFER_SIZE) errorBuffer.shift();
}

function pushMessage(entry: TrackedMessage) {
  messageBuffer.push(entry);
  if (messageBuffer.length > BUFFER_SIZE) messageBuffer.shift();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentUser: UserInfo | null = null;
const reporters: ErrorReporter[] = [];
let initialized = false;

// ---------------------------------------------------------------------------
// Supabase reporter (optional)
// ---------------------------------------------------------------------------

function createSupabaseReporter(): ErrorReporter {
  return {
    name: 'supabase',
    onException(error: Error, context?: ErrorContext) {
      // Lazy-import to avoid circular dependencies and keep it optional
      void import('../api/audit').then(({ logAudit }) => {
        void logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.id || 'system',
          action: 'ERROR_CAPTURED',
          module: context?.module || 'SYSTEM',
          description: `[ErrorTracker] ${error.message}`,
          details: {
            stack: error.stack,
            dealId: context?.dealId,
            ...context?.extra,
          },
        });
      }).catch(() => {
        // Module not available — Supabase not configured
      });
    },
    onMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext) {
      if (level !== 'error') return; // Only persist errors to audit log
      void import('../api/audit').then(({ logAudit }) => {
        void logAudit({
          userEmail: currentUser?.email || 'system',
          userName: currentUser?.id || 'system',
          action: 'ERROR_MESSAGE',
          module: context?.module || 'SYSTEM',
          description: `[ErrorTracker] ${message}`,
          details: {
            level,
            dealId: context?.dealId,
            ...context?.extra,
          },
        });
      }).catch(() => {
        // Module not available
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Console reporter (development)
// ---------------------------------------------------------------------------

function createConsoleReporter(): ErrorReporter {
  return {
    name: 'console',
    onException(error: Error, context?: ErrorContext) {
      console.error(
        '[ErrorTracker]',
        error.message,
        context ? { ...context } : '',
        error.stack || '',
      );
    },
    onMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext) {
      const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
      logFn('[ErrorTracker]', message, context ? { ...context } : '');
    },
  };
}

// ---------------------------------------------------------------------------
// Tracker implementation
// ---------------------------------------------------------------------------

export const errorTracker: ErrorTracker = {
  init(_cfg?: ErrorTrackerConfig) {
    if (initialized) return;
    initialized = true;

    // Always add console reporter in development
    if (!import.meta.env.PROD) {
      reporters.push(createConsoleReporter());
    }

    // Add Supabase reporter — it self-guards against missing config
    reporters.push(createSupabaseReporter());
  },

  captureException(error: Error, context?: ErrorContext) {
    const enrichedContext: ErrorContext = {
      ...context,
      userId: context?.userId || currentUser?.id,
    };

    pushError({
      timestamp: new Date().toISOString(),
      error: { message: error.message, stack: error.stack },
      context: enrichedContext,
    });

    for (const reporter of reporters) {
      try {
        reporter.onException(error, enrichedContext);
      } catch {
        // Never let a reporter crash the app
      }
    }
  },

  captureMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext) {
    const enrichedContext: ErrorContext = {
      ...context,
      userId: context?.userId || currentUser?.id,
    };

    pushMessage({
      timestamp: new Date().toISOString(),
      message,
      level,
      context: enrichedContext,
    });

    for (const reporter of reporters) {
      try {
        reporter.onMessage?.(message, level, enrichedContext);
      } catch {
        // Never let a reporter crash the app
      }
    }
  },

  setUser(user: UserInfo) {
    currentUser = user;
  },

  getRecentErrors(): ReadonlyArray<TrackedError> {
    return errorBuffer;
  },

  getRecentMessages(): ReadonlyArray<TrackedMessage> {
    return messageBuffer;
  },

  addReporter(reporter: ErrorReporter) {
    const idx = reporters.findIndex((r) => r.name === reporter.name);
    if (idx !== -1) {
      reporters[idx] = reporter;
    } else {
      reporters.push(reporter);
    }
  },

  removeReporter(name: string) {
    const idx = reporters.findIndex((r) => r.name === name);
    if (idx !== -1) reporters.splice(idx, 1);
  },
};
