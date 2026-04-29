/**
 * Throttle utility for live-cursor broadcasts (Ola 7 Bloque B.4).
 *
 * Pure function factory — returns a throttled wrapper around `fn`
 * that calls at most once per `windowMs`. Trailing call is preserved
 * so the final position lands on the wire even if the user stops
 * moving mid-window.
 *
 * Built bespoke (vs lodash.throttle) so we can:
 *   - control trailing semantics deterministically for tests
 *   - inject a clock + scheduler for unit tests
 *   - keep the bundle clean (no extra dep)
 *
 * Tested in __tests__/throttle.test.ts.
 */

export interface ThrottleOptions {
  /** Window duration in ms. Calls within the same window are coalesced. */
  windowMs: number;
  /** Optional clock — defaults to Date.now. Useful for tests. */
  now?: () => number;
  /** Optional scheduler — defaults to setTimeout. Useful for tests. */
  schedule?: (cb: () => void, ms: number) => unknown;
  /** Optional canceller — defaults to clearTimeout. */
  cancel?: (handle: unknown) => void;
}

export interface ThrottledFn<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Cancels any pending trailing call. */
  cancel(): void;
  /** Forces the trailing call to fire now (if any pending). */
  flush(): void;
}

export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  options: ThrottleOptions,
): ThrottledFn<TArgs> {
  const { windowMs } = options;
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? ((cb, ms) => setTimeout(cb, ms));
  const cancel = options.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  // -Infinity guarantees the very first call hits the leading-edge
  // branch regardless of clock origin (Date.now in prod, fake clock at 0
  // in tests).
  let lastCallAt = Number.NEGATIVE_INFINITY;
  let trailingHandle: unknown | null = null;
  let trailingArgs: TArgs | null = null;

  function fire(args: TArgs) {
    lastCallAt = now();
    trailingArgs = null;
    fn(...args);
  }

  function clearTrailing() {
    if (trailingHandle !== null) {
      cancel(trailingHandle);
      trailingHandle = null;
    }
  }

  const wrapped = ((...args: TArgs) => {
    const ts = now();
    const elapsed = ts - lastCallAt;
    if (elapsed >= windowMs) {
      // Leading edge — fire immediately.
      clearTrailing();
      fire(args);
      return;
    }
    // Within the window — schedule a trailing call with the latest args.
    trailingArgs = args;
    if (trailingHandle === null) {
      trailingHandle = schedule(() => {
        trailingHandle = null;
        if (trailingArgs) fire(trailingArgs);
      }, windowMs - elapsed);
    }
  }) as ThrottledFn<TArgs>;

  wrapped.cancel = () => {
    clearTrailing();
    trailingArgs = null;
    lastCallAt = Number.NEGATIVE_INFINITY;
  };

  wrapped.flush = () => {
    if (trailingArgs) {
      clearTrailing();
      fire(trailingArgs);
    }
  };

  return wrapped;
}
