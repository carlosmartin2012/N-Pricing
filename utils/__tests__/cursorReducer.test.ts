import { describe, expect, it } from 'vitest';
import {
  cursorReducer,
  INITIAL_CURSOR_STATE,
  selectVisibleCursors,
  type CursorState,
} from '../cursors/cursorReducer';

const incoming = (overrides: Partial<{ userId: string; name: string | null; x: number; y: number; viewport: string }> = {}) => ({
  userId: overrides.userId ?? 'u1',
  name: overrides.name ?? 'User One',
  x: overrides.x ?? 100,
  y: overrides.y ?? 200,
  viewport: overrides.viewport ?? 'CALCULATOR',
});

describe('cursorReducer', () => {
  it('CURSOR_RECEIVED inserts a new cursor', () => {
    const state = cursorReducer(INITIAL_CURSOR_STATE, {
      type: 'CURSOR_RECEIVED',
      payload: incoming({ userId: 'alice' }),
      receivedAt: 1000,
    });
    expect(state.cursors.size).toBe(1);
    expect(state.cursors.get('alice')?.x).toBe(100);
  });

  it('CURSOR_RECEIVED upserts: same user dispatches replace prior position', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'a', x: 10, y: 20 }), receivedAt: 1 });
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'a', x: 30, y: 40 }), receivedAt: 2 });
    expect(state.cursors.size).toBe(1);
    expect(state.cursors.get('a')).toMatchObject({ x: 30, y: 40, receivedAt: 2 });
  });

  it('CURSOR_LEFT removes the cursor for the given userId', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'a' }), receivedAt: 1 });
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'b' }), receivedAt: 2 });
    state = cursorReducer(state, { type: 'CURSOR_LEFT', userId: 'a' });
    expect(state.cursors.size).toBe(1);
    expect(state.cursors.has('a')).toBe(false);
  });

  it('CURSOR_LEFT for unknown userId returns same state reference (no churn)', () => {
    const state = cursorReducer(INITIAL_CURSOR_STATE, { type: 'CURSOR_LEFT', userId: 'unknown' });
    expect(state).toBe(INITIAL_CURSOR_STATE);
  });

  it('GC_STALE drops cursors older than staleAfterMs', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'fresh' }), receivedAt: 9_900 });
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'stale' }), receivedAt: 1_000 });
    state = cursorReducer(state, { type: 'GC_STALE', now: 10_000, staleAfterMs: 5_000 });
    expect(state.cursors.has('fresh')).toBe(true);
    expect(state.cursors.has('stale')).toBe(false);
  });

  it('GC_STALE returns same reference when nothing was dropped', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'fresh' }), receivedAt: 9_900 });
    const before = state;
    const after = cursorReducer(before, { type: 'GC_STALE', now: 10_000, staleAfterMs: 5_000 });
    expect(after).toBe(before);
  });
});

describe('selectVisibleCursors', () => {
  it('filters out cursors on different viewports', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'a', viewport: 'CALCULATOR' }), receivedAt: 1 });
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'b', viewport: 'BLOTTER' }), receivedAt: 2 });
    const visible = selectVisibleCursors(state, 'CALCULATOR', 'self');
    expect(visible.map((c) => c.userId)).toEqual(['a']);
  });

  it('always excludes the current user even if they ended up in state', () => {
    let state: CursorState = INITIAL_CURSOR_STATE;
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'self' }), receivedAt: 1 });
    state = cursorReducer(state, { type: 'CURSOR_RECEIVED', payload: incoming({ userId: 'other' }), receivedAt: 2 });
    const visible = selectVisibleCursors(state, 'CALCULATOR', 'self');
    expect(visible.map((c) => c.userId)).toEqual(['other']);
  });

  it('returns empty array when no cursors match', () => {
    expect(selectVisibleCursors(INITIAL_CURSOR_STATE, 'CALCULATOR', 'self')).toEqual([]);
  });
});
