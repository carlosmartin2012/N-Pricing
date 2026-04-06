/**
 * Hook for batch pricing using Web Workers.
 * Falls back to synchronous pricing if Web Workers are not available.
 */

import { useState, useCallback, useRef } from 'react';
import { PricingContext, PricingShocks, batchReprice } from '../utils/pricingEngine';
import type { Transaction, ApprovalMatrixConfig, FTPResult } from '../types';

interface BatchProgress {
  completed: number;
  total: number;
  percentage: number;
}

interface BatchPricingState {
  isRunning: boolean;
  progress: BatchProgress | null;
  results: Map<string, FTPResult> | null;
  error: string | null;
}

export function useBatchPricing() {
  const [state, setState] = useState<BatchPricingState>({
    isRunning: false,
    progress: null,
    results: null,
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);

  const runSyncFallback = useCallback((
    deals: Transaction[],
    approvalMatrix: ApprovalMatrixConfig,
    context?: PricingContext,
    shocks?: PricingShocks,
  ) => {
    try {
      const results = batchReprice(deals, approvalMatrix, context || {} as PricingContext, shocks);
      setState({
        isRunning: false,
        progress: { completed: deals.length, total: deals.length, percentage: 100 },
        results,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: err.message || 'Batch pricing failed',
      }));
    }
  }, []);

  const runBatchPricing = useCallback((
    deals: Transaction[],
    approvalMatrix: ApprovalMatrixConfig,
    context?: PricingContext,
    shocks?: PricingShocks,
  ) => {
    setState({ isRunning: true, progress: null, results: null, error: null });

    // Try Web Worker for large portfolios
    if (deals.length > 100 && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(
          new URL('../utils/pricingWorker.ts', import.meta.url),
          { type: 'module' },
        );

        workerRef.current = worker;

        worker.onmessage = (event) => {
          const data = event.data;

          if (data.type === 'progress') {
            setState(prev => ({
              ...prev,
              progress: {
                ...data.progress,
                percentage: Math.round((data.progress.completed / data.progress.total) * 100),
              },
            }));
          }

          if (data.type === 'result') {
            const resultsMap = new Map<string, FTPResult>(data.results);
            setState({
              isRunning: false,
              progress: { completed: data.results.length, total: data.results.length, percentage: 100 },
              results: resultsMap,
              error: null,
            });
            worker.terminate();
            workerRef.current = null;
          }

          if (data.type === 'error') {
            setState(prev => ({
              ...prev,
              isRunning: false,
              error: data.error,
            }));
            worker.terminate();
            workerRef.current = null;
          }
        };

        worker.onerror = (err) => {
          // Fallback to synchronous if worker fails
          console.warn('Worker failed, falling back to sync:', err.message);
          worker.terminate();
          workerRef.current = null;
          runSyncFallback(deals, approvalMatrix, context, shocks);
        };

        worker.postMessage({
          type: 'batch',
          deals,
          approvalMatrix,
          context,
          shocks,
        });

        return;
      } catch {
        // Worker creation failed, fall through to sync
      }
    }

    // Synchronous fallback for small portfolios or no Worker support
    runSyncFallback(deals, approvalMatrix, context, shocks);
  }, [runSyncFallback]);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setState(prev => ({ ...prev, isRunning: false }));
  }, []);

  return {
    ...state,
    runBatchPricing,
    cancel,
  };
}
