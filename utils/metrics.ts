import { isSupabaseConfigured, supabase } from './supabaseClient';
import { createLogger } from './logger';

const log = createLogger('metrics');

interface MetricEntry {
  entityId: string;
  metricName: string;
  metricValue: number;
  dimensions: Record<string, unknown>;
  recordedAt: string;
}

const FLUSH_INTERVAL_MS = 60_000; // 60 seconds
const MAX_BUFFER_SIZE = 100;

let buffer: MetricEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flushMetrics(), FLUSH_INTERVAL_MS);
}

export async function flushMetrics(): Promise<void> {
  if (buffer.length === 0 || !isSupabaseConfigured) return;

  const toFlush = [...buffer];
  buffer = [];

  try {
    const rows = toFlush.map((m) => ({
      entity_id: m.entityId,
      metric_name: m.metricName,
      metric_value: m.metricValue,
      dimensions: m.dimensions,
      recorded_at: m.recordedAt,
    }));

    const { error } = await supabase.from('metrics').insert(rows);
    if (error) {
      log.warn('Failed to flush metrics, re-buffering', { count: toFlush.length });
      buffer = [...toFlush, ...buffer].slice(0, MAX_BUFFER_SIZE);
    } else {
      log.debug('Flushed metrics', { count: toFlush.length });
    }
  } catch (err) {
    log.warn('Metrics flush error', err as Record<string, unknown>);
    buffer = [...toFlush, ...buffer].slice(0, MAX_BUFFER_SIZE);
  }
}

export function trackMetric(
  entityId: string,
  metricName: string,
  metricValue: number,
  dimensions: Record<string, unknown> = {},
): void {
  buffer.push({
    entityId,
    metricName,
    metricValue,
    dimensions,
    recordedAt: new Date().toISOString(),
  });

  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flushMetrics();
  }

  startFlushTimer();
}

// Convenience helpers
export function trackPricingLatency(entityId: string, dealId: string, durationMs: number): void {
  trackMetric(entityId, 'pricing_latency_ms', durationMs, { dealId });
}

export function trackDealVolume(entityId: string, count: number): void {
  trackMetric(entityId, 'deal_volume', count);
}

export function trackErrorRate(entityId: string, module: string, count: number = 1): void {
  trackMetric(entityId, 'error_count', count, { module });
}

export function trackReportGeneration(entityId: string, reportType: string, durationMs: number): void {
  trackMetric(entityId, 'report_generation_ms', durationMs, { reportType });
}

// Cleanup
export function stopMetricsFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  void flushMetrics(); // Final flush
}
