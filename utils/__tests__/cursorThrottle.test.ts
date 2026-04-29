import { describe, expect, it } from 'vitest';
import { throttle } from '../cursors/throttle';

interface FakeClock {
  now: () => number;
  advance(ms: number): void;
  schedule: (cb: () => void, delay: number) => number;
  cancel: (handle: unknown) => void;
}

function makeFakeClock(): FakeClock {
  let t = 0;
  const pending = new Map<number, { cb: () => void; fireAt: number }>();
  let nextHandle = 0;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
      // Run scheduled timers whose fireAt is now in the past.
      for (const [h, p] of [...pending]) {
        if (p.fireAt <= t) {
          pending.delete(h);
          p.cb();
        }
      }
    },
    schedule(cb, delay) {
      const handle = ++nextHandle;
      pending.set(handle, { cb, fireAt: t + delay });
      return handle;
    },
    cancel(h) {
      pending.delete(h as number);
    },
  };
}

describe('throttle', () => {
  it('fires the leading call immediately', () => {
    const clock = makeFakeClock();
    const calls: string[] = [];
    const fn = throttle(
      (s: string) => calls.push(s),
      { windowMs: 50, now: clock.now, schedule: clock.schedule, cancel: clock.cancel },
    );
    fn('a');
    expect(calls).toEqual(['a']);
  });

  it('coalesces calls inside the window into a single trailing call', () => {
    const clock = makeFakeClock();
    const calls: string[] = [];
    const fn = throttle(
      (s: string) => calls.push(s),
      { windowMs: 50, now: clock.now, schedule: clock.schedule, cancel: clock.cancel },
    );
    fn('a'); // fires now
    clock.advance(10);
    fn('b'); // schedules trailing
    fn('c'); // overrides trailing args
    fn('d');
    expect(calls).toEqual(['a']); // only leading so far

    clock.advance(40); // 50ms window completes — trailing fires
    expect(calls).toEqual(['a', 'd']);
  });

  it('separated calls outside the window all fire as leading edges', () => {
    const clock = makeFakeClock();
    const calls: string[] = [];
    const fn = throttle(
      (s: string) => calls.push(s),
      { windowMs: 50, now: clock.now, schedule: clock.schedule, cancel: clock.cancel },
    );
    fn('a');
    clock.advance(60);
    fn('b');
    clock.advance(60);
    fn('c');
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('cancel() drops pending trailing call', () => {
    const clock = makeFakeClock();
    const calls: string[] = [];
    const fn = throttle(
      (s: string) => calls.push(s),
      { windowMs: 50, now: clock.now, schedule: clock.schedule, cancel: clock.cancel },
    );
    fn('a'); // leading
    clock.advance(10);
    fn('b'); // pending trailing
    fn.cancel();
    clock.advance(60);
    expect(calls).toEqual(['a']);
  });

  it('flush() forces the trailing call to fire immediately', () => {
    const clock = makeFakeClock();
    const calls: string[] = [];
    const fn = throttle(
      (s: string) => calls.push(s),
      { windowMs: 50, now: clock.now, schedule: clock.schedule, cancel: clock.cancel },
    );
    fn('a');
    clock.advance(10);
    fn('b');
    fn.flush();
    expect(calls).toEqual(['a', 'b']);
  });
});
