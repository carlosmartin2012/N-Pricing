import { useEffect, useMemo, useReducer, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  cursorReducer,
  INITIAL_CURSOR_STATE,
  selectVisibleCursors,
  type RemoteCursor,
} from '../utils/cursors/cursorReducer';
import { throttle } from '../utils/cursors/throttle';

/**
 * useLiveCursors — Ola 7 Bloque B.4c.
 *
 * Opens a Supabase Realtime broadcast channel ('live-cursors') and
 * round-trips cursor positions. Throttled at 50ms (configurable),
 * GC'd at 2s (configurable). Returns the visible-cursor list filtered
 * by viewport + self.
 *
 * Designed with a transport injection point (`createTransport`) so
 * tests can stub the Realtime layer cleanly without touching the
 * supabase global.
 */

export interface CursorBroadcastPayload {
  userId: string;
  name: string | null;
  x: number;
  y: number;
  viewport: string;
}

export interface CursorTransport {
  send(payload: CursorBroadcastPayload): void;
  subscribe(onReceive: (payload: CursorBroadcastPayload) => void): () => void;
}

interface UseLiveCursorsOptions {
  /** Master switch — typically (feature flag enabled) && (presence on). */
  enabled: boolean;
  userId: string;
  name: string | null;
  viewport: string;
  /** ms between outgoing broadcasts. Default 50 (20 fps). */
  throttleMs?: number;
  /** ms after which a remote cursor is GC'd if no fresh positions. Default 2000. */
  staleAfterMs?: number;
  /** Optional transport injection — useful in tests. Falls back to a
   *  Supabase-backed transport when omitted. Returns null when
   *  Supabase is not configured (so the hook becomes a no-op). */
  createTransport?: () => CursorTransport | null;
}

function defaultCreateTransport(): CursorTransport | null {
  if (!isSupabaseConfigured) return null;
  let channel: RealtimeChannel | null = null;
  let receiver: ((payload: CursorBroadcastPayload) => void) | null = null;
  return {
    send(payload) {
      if (!channel) return;
      void channel.send({ type: 'broadcast', event: 'cursor', payload });
    },
    subscribe(onReceive) {
      receiver = onReceive;
      channel = supabase.channel('live-cursors', {
        config: { broadcast: { self: false } },
      });
      channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
        receiver?.(payload as CursorBroadcastPayload);
      });
      void channel.subscribe();
      return () => {
        receiver = null;
        if (channel) {
          void channel.unsubscribe();
          channel = null;
        }
      };
    },
  };
}

export interface UseLiveCursorsResult {
  /** Cursors filtered by viewport + self. Pass to LiveCursorOverlay. */
  cursors: ReadonlyArray<RemoteCursor>;
  /** True when the Supabase channel was successfully opened. Off when
   *  Supabase is not configured or the hook is disabled. */
  active: boolean;
}

export function useLiveCursors(options: UseLiveCursorsOptions): UseLiveCursorsResult {
  const {
    enabled, userId, name, viewport,
    throttleMs = 50, staleAfterMs = 2000,
  } = options;
  const createTransport = options.createTransport ?? defaultCreateTransport;
  const [state, dispatch] = useReducer(cursorReducer, INITIAL_CURSOR_STATE);
  const transportRef = useRef<CursorTransport | null>(null);

  // Subscribe to incoming cursors.
  useEffect(() => {
    if (!enabled) return;
    const transport = createTransport();
    if (!transport) return;
    transportRef.current = transport;
    const unsubscribe = transport.subscribe((payload) => {
      dispatch({
        type: 'CURSOR_RECEIVED',
        payload,
        receivedAt: Date.now(),
      });
    });
    return () => {
      unsubscribe();
      transportRef.current = null;
    };
    // The transport factory is captured intentionally; reconnects only
    // happen on enabled flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Throttled outgoing send.
  const sendCursor = useMemo(
    () => throttle((x: number, y: number) => {
      const t = transportRef.current;
      if (!t) return;
      t.send({ userId, name, x, y, viewport });
    }, { windowMs: throttleMs }),
    [userId, name, viewport, throttleMs],
  );

  // mousemove listener.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const handler = (e: MouseEvent) => sendCursor(e.clientX, e.clientY);
    window.addEventListener('mousemove', handler, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handler);
      sendCursor.cancel();
    };
  }, [enabled, sendCursor]);

  // GC sweep — runs every second, drops stale entries.
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      dispatch({ type: 'GC_STALE', now: Date.now(), staleAfterMs });
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled, staleAfterMs]);

  const cursors = useMemo(
    () => selectVisibleCursors(state, viewport, userId),
    [state, viewport, userId],
  );

  return { cursors, active: enabled && transportRef.current !== null };
}
