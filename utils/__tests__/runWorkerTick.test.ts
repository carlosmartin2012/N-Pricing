// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  runWorkerTick,
  __resetWorkerHealth,
  getWorkerHealth,
  getWorkerSkipCounts,
} from '../../server/workers/workerHealth';

describe('runWorkerTick', () => {
  beforeEach(() => {
    __resetWorkerHealth();
    // Silence the failure log — we assert on the snapshot, not stderr.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('records a successful tick on the happy path', async () => {
    let ran = false;
    await runWorkerTick('test-worker', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    const snap = getWorkerHealth().find((w) => w.worker === 'test-worker');
    expect(snap?.successCount).toBe(1);
    expect(snap?.failureCount).toBe(0);
  });

  it('records a failed tick when the body throws and never re-throws', async () => {
    await runWorkerTick('bad-worker', async () => {
      throw new Error('boom');
    });
    const snap = getWorkerHealth().find((w) => w.worker === 'bad-worker');
    expect(snap?.failureCount).toBe(1);
    expect(snap?.lastFailureMessage).toBe('boom');
  });

  it('skips a tick when the previous one is still running, increments skip counter', async () => {
    // Hold the first tick open until we explicitly release it.
    let release: () => void = () => {};
    const firstTick = runWorkerTick('slow-worker', async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    // Immediately fire a second tick while the first is in flight.
    await runWorkerTick('slow-worker', async () => {
      throw new Error('this body should never run');
    });
    // The second call returned without running the body OR throwing.
    const skipsMid = getWorkerSkipCounts().find((s) => s.worker === 'slow-worker');
    expect(skipsMid?.skippedCount).toBe(1);
    // Now let the first tick finish and confirm the success was recorded.
    release();
    await firstTick;
    const snap = getWorkerHealth().find((w) => w.worker === 'slow-worker');
    expect(snap?.successCount).toBe(1);
    expect(snap?.failureCount).toBe(0);
  });

  it('releases the running flag on failure so the next tick can run', async () => {
    await runWorkerTick('flaky', async () => {
      throw new Error('first');
    });
    let secondRan = false;
    await runWorkerTick('flaky', async () => {
      secondRan = true;
    });
    expect(secondRan).toBe(true);
    const snap = getWorkerHealth().find((w) => w.worker === 'flaky');
    expect(snap?.failureCount).toBe(1);
    expect(snap?.successCount).toBe(1);
  });
});
