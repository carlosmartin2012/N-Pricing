/**
 * Cursor state reducer (Ola 7 Bloque B.4).
 *
 * Pure logic for managing the set of remote cursors. The hook layer
 * applies dispatch on incoming Realtime broadcast events; the
 * component layer renders from `state`. Tested independently.
 */

export interface RemoteCursor {
  userId: string;
  name: string | null;
  x: number;
  y: number;
  /** Viewport key — clients only render cursors that share their
   *  current viewport (e.g. 'CALCULATOR' vs 'BLOTTER'). */
  viewport: string;
  /** ms since epoch the position was received. Used for stale GC. */
  receivedAt: number;
}

export interface CursorState {
  /** userId → cursor. Map provides O(1) update + dedupe by user. */
  cursors: Map<string, RemoteCursor>;
}

export type CursorAction =
  | { type: 'CURSOR_RECEIVED'; payload: Omit<RemoteCursor, 'receivedAt'>; receivedAt: number }
  | { type: 'CURSOR_LEFT'; userId: string }
  | { type: 'GC_STALE'; now: number; staleAfterMs: number };

export const INITIAL_CURSOR_STATE: CursorState = { cursors: new Map() };

export function cursorReducer(state: CursorState, action: CursorAction): CursorState {
  switch (action.type) {
    case 'CURSOR_RECEIVED': {
      const next = new Map(state.cursors);
      next.set(action.payload.userId, { ...action.payload, receivedAt: action.receivedAt });
      return { cursors: next };
    }
    case 'CURSOR_LEFT': {
      if (!state.cursors.has(action.userId)) return state;
      const next = new Map(state.cursors);
      next.delete(action.userId);
      return { cursors: next };
    }
    case 'GC_STALE': {
      // Drop cursors not updated within the last `staleAfterMs`.
      const cutoff = action.now - action.staleAfterMs;
      let mutated = false;
      const next = new Map(state.cursors);
      for (const [userId, c] of next) {
        if (c.receivedAt < cutoff) {
          next.delete(userId);
          mutated = true;
        }
      }
      return mutated ? { cursors: next } : state;
    }
    default:
      return state;
  }
}

/** Selector: visible cursors filtered by viewport, excluding self. */
export function selectVisibleCursors(
  state: CursorState,
  viewport: string,
  selfUserId: string,
): RemoteCursor[] {
  const out: RemoteCursor[] = [];
  for (const c of state.cursors.values()) {
    if (c.userId === selfUserId) continue;
    if (c.viewport !== viewport) continue;
    out.push(c);
  }
  return out;
}
