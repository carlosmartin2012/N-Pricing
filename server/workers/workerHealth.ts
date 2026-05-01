/**
 * Worker health observability — Ola 11.3.
 *
 * Provee un punto único de logging y conteo para los 5 workers
 * trimestrales/intervalados (alertEvaluator, escalationSweeper,
 * ltvSnapshotWorker, crmEventSync, attributionDriftDetector,
 * attributionThresholdRecalibrator). Antes cada uno hacía
 * `console.error('[X] tick failed', err)` aislado — sin contador
 * agregado, ningún dashboard ops sabía si un worker estaba muerto.
 *
 * Diseño:
 *   - Counter in-memory por worker (resets al reiniciar el process).
 *   - Log estructurado con prefijo común `[worker-tick]` + worker name
 *     y categoría (success | failure) para que log drains puedan
 *     parsear y alertar.
 *   - Endpoint `/health/workers` lee el snapshot del state.
 *
 * No persistimos a DB para evitar dependencia de tabla nueva en este
 * sprint — el counter trimestral típico (worker corre cada 15 min)
 * acumula < 100 ticks/día, suficiente para que ops detecte outages
 * vía heartbeat ausente. La persistencia a `metrics` queda como
 * follow-up cuando `metrics_workers_health` se cree.
 */

export interface WorkerHealthSnapshot {
  /** Identificador estable del worker (e.g. `alert-eval`). */
  worker: string;
  /** Last successful tick timestamp (ISO 8601). null = aún no ha tickado OK. */
  lastSuccessAt: string | null;
  /** Last failed tick timestamp (ISO 8601). null = aún no ha fallado. */
  lastFailureAt: string | null;
  /** Mensaje del último error (truncado a 256 chars). */
  lastFailureMessage: string | null;
  /** Counter total de ticks fallidos desde boot del process. */
  failureCount: number;
  /** Counter total de ticks exitosos desde boot. */
  successCount: number;
}

const STATE = new Map<string, WorkerHealthSnapshot>();

function ensure(worker: string): WorkerHealthSnapshot {
  let snapshot = STATE.get(worker);
  if (!snapshot) {
    snapshot = {
      worker,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastFailureMessage: null,
      failureCount: 0,
      successCount: 0,
    };
    STATE.set(worker, snapshot);
  }
  return snapshot;
}

/**
 * Marca un tick exitoso. Llamar al final del happy path de cada loop.
 *
 * @example
 *   try {
 *     await runRecalibrationSweep();
 *     recordWorkerTickSuccess('attribution-recalibrator');
 *   } catch (err) {
 *     recordWorkerTickFailure('attribution-recalibrator', err);
 *   }
 */
export function recordWorkerTickSuccess(worker: string): void {
  const snapshot = ensure(worker);
  snapshot.successCount += 1;
  snapshot.lastSuccessAt = new Date().toISOString();
}

/**
 * Marca un tick fallido + log estructurado consistente. El log lleva
 * el prefijo `[worker-tick]` para que el log drain agrupe los 6
 * workers bajo un único filtro `worker-tick failure`.
 */
export function recordWorkerTickFailure(worker: string, err: unknown): void {
  const snapshot = ensure(worker);
  snapshot.failureCount += 1;
  snapshot.lastFailureAt = new Date().toISOString();
  const message = err instanceof Error ? err.message : String(err ?? 'unknown');
  snapshot.lastFailureMessage = message.slice(0, 256);
  console.error('[worker-tick] failure', {
    worker,
    failureCount: snapshot.failureCount,
    successCount: snapshot.successCount,
    message: snapshot.lastFailureMessage,
  });
}

/** Devuelve copia inmutable del snapshot (para `/health/workers`). */
export function getWorkerHealth(): WorkerHealthSnapshot[] {
  return Array.from(STATE.values()).map((s) => ({ ...s }));
}

/** Test helper — limpia state in-memory. */
export function __resetWorkerHealth(): void {
  STATE.clear();
  RUNNING.clear();
}

// ---------------------------------------------------------------------------
// Tick lock — defence against overlapping ticks
// ---------------------------------------------------------------------------
// setInterval(asyncFn, ms) does NOT wait for the previous tick to finish. If
// a tick takes longer than the interval (a slow query, a CRM stub timing
// out), Node fires the next tick while the first is still running. Two
// concurrent ticks of the same worker means: doubled DB pool usage, races
// on append-only inserts, duplicate alert dispatch.
//
// `runWorkerTick` wraps the async body in:
//   1. A `running` flag — second tick exits immediately, increments a
//      `skippedCount` so ops can spot a worker that's chronically slower
//      than its interval.
//   2. The success/failure heartbeat call — same as recordWorkerTickSuccess
//      / recordWorkerTickFailure, so the wrapper is the single source of
//      truth and individual workers can't forget either branch.

const RUNNING = new Set<string>();

export interface WorkerSkipSnapshot {
  worker: string;
  skippedCount: number;
}

const SKIPPED = new Map<string, number>();

/**
 * Run an async tick body with the overlap guard + heartbeat. If a previous
 * tick is still in flight for the same worker name, this call is a no-op
 * and the skipped counter is incremented.
 *
 * Note: `runWorkerTick` does NOT throw — errors are recorded via
 * `recordWorkerTickFailure` so the calling setInterval loop never sees a
 * rejection.
 */
export async function runWorkerTick(
  worker: string,
  body: () => Promise<void>,
): Promise<void> {
  if (RUNNING.has(worker)) {
    SKIPPED.set(worker, (SKIPPED.get(worker) ?? 0) + 1);
    return;
  }
  RUNNING.add(worker);
  try {
    await body();
    recordWorkerTickSuccess(worker);
  } catch (err) {
    recordWorkerTickFailure(worker, err);
  } finally {
    RUNNING.delete(worker);
  }
}

/** Snapshot of overlap-skip counters for the /health/workers endpoint. */
export function getWorkerSkipCounts(): WorkerSkipSnapshot[] {
  return Array.from(SKIPPED.entries()).map(([worker, skippedCount]) => ({
    worker,
    skippedCount,
  }));
}
