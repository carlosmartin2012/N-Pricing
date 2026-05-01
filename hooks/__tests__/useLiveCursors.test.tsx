// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useLiveCursors,
  type CursorBroadcastPayload,
  type CursorTransport,
} from '../useLiveCursors';

// Memory transport — broadcast goes to a local subscriber set so
// "two contexts" can synthesise a multi-user scenario in tests.
function createMemoryTransport(hub: { subs: Set<(p: CursorBroadcastPayload) => void> }): CursorTransport {
  return {
    send(payload) {
      // Self-deliver to all subscribers (caller decides whether self
      // is filtered downstream — selectVisibleCursors does that).
      for (const cb of hub.subs) cb(payload);
    },
    subscribe(onReceive) {
      hub.subs.add(onReceive);
      return () => hub.subs.delete(onReceive);
    },
  };
}

describe('useLiveCursors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns empty cursors when disabled', () => {
    const hub = { subs: new Set<(p: CursorBroadcastPayload) => void>() };
    const { result } = renderHook(() =>
      useLiveCursors({
        enabled: false,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        createTransport: () => createMemoryTransport(hub),
      }),
    );
    expect(result.current.cursors).toEqual([]);
  });

  it('returns empty cursors when transport factory yields null (e.g. Supabase not configured)', () => {
    const { result } = renderHook(() =>
      useLiveCursors({
        enabled: true,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        createTransport: () => null,
      }),
    );
    expect(result.current.cursors).toEqual([]);
  });

  it('subscribes on mount and exposes incoming cursors filtered by viewport', () => {
    const hub = { subs: new Set<(p: CursorBroadcastPayload) => void>() };
    const transport = createMemoryTransport(hub);
    const { result } = renderHook(() =>
      useLiveCursors({
        enabled: true,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        createTransport: () => transport,
      }),
    );

    act(() => {
      transport.send({ userId: 'alice', name: 'Alice', x: 10, y: 20, viewport: 'CALCULATOR' });
      transport.send({ userId: 'bob',   name: 'Bob',   x: 30, y: 40, viewport: 'BLOTTER' });
    });

    const ids = result.current.cursors.map((c) => c.userId);
    expect(ids).toContain('alice');
    expect(ids).not.toContain('bob');     // wrong viewport
    expect(ids).not.toContain('self');    // self filtered
  });

  it('throttles outgoing mousemove broadcasts to ~1 per windowMs', () => {
    const hub = { subs: new Set<(p: CursorBroadcastPayload) => void>() };
    const transport = createMemoryTransport(hub);
    const sendSpy = vi.spyOn(transport, 'send');

    renderHook(() =>
      useLiveCursors({
        enabled: true,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        throttleMs: 50,
        createTransport: () => transport,
      }),
    );

    // 5 mousemoves in quick succession — leading edge fires once,
    // remaining are coalesced into a trailing call.
    for (let i = 0; i < 5; i += 1) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: i, clientY: i }));
    }
    // Leading call has fired; trailing not yet (timer pending).
    expect(sendSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(60);
    });
    // Trailing call has fired now.
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it('GCs stale cursors after staleAfterMs without new broadcasts', () => {
    const hub = { subs: new Set<(p: CursorBroadcastPayload) => void>() };
    const transport = createMemoryTransport(hub);
    const { result } = renderHook(() =>
      useLiveCursors({
        enabled: true,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        staleAfterMs: 1500,
        createTransport: () => transport,
      }),
    );

    act(() => {
      transport.send({ userId: 'alice', name: 'Alice', x: 10, y: 20, viewport: 'CALCULATOR' });
    });
    expect(result.current.cursors.map((c) => c.userId)).toEqual(['alice']);

    act(() => {
      // Advance past staleAfterMs without fresh broadcasts; the GC
      // sweep runs every 1s.
      vi.advanceTimersByTime(2200);
    });
    expect(result.current.cursors).toEqual([]);
  });

  it('removes the mousemove listener on unmount', () => {
    const hub = { subs: new Set<(p: CursorBroadcastPayload) => void>() };
    const transport = createMemoryTransport(hub);
    const sendSpy = vi.spyOn(transport, 'send');

    const { unmount } = renderHook(() =>
      useLiveCursors({
        enabled: true,
        userId: 'self',
        name: 'Self',
        viewport: 'CALCULATOR',
        createTransport: () => transport,
      }),
    );

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    expect(sendSpy).toHaveBeenCalledTimes(1);

    unmount();
    sendSpy.mockClear();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }));
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
