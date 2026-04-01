/**
 * Web Worker for batch pricing of large portfolios.
 * Offloads calculatePricing() to a background thread to avoid UI blocking.
 *
 * Usage:
 *   const worker = new Worker(new URL('./pricingWorker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ deals, approvalMatrix, context, shocks });
 *   worker.onmessage = (e) => { const results = e.data.results; };
 */

import { calculatePricing, PricingContext, PricingShocks } from './pricingEngine';
import type { Transaction, ApprovalMatrixConfig, FTPResult } from '../types';

interface WorkerRequest {
  type: 'batch' | 'single';
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  context?: PricingContext;
  shocks?: PricingShocks;
}

interface WorkerResponse {
  type: 'result' | 'progress' | 'error';
  results?: [string, FTPResult][];
  progress?: { completed: number; total: number };
  error?: string;
}

// Chunk size for progress reporting
const CHUNK_SIZE = 50;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { deals, approvalMatrix, context, shocks } = event.data;
  const defaultShocks: PricingShocks = shocks || { interestRate: 0, liquiditySpread: 0 };

  try {
    const results: [string, FTPResult][] = [];
    const validDeals = deals.filter(d => d.id && d.productType && d.amount > 0);

    for (let i = 0; i < validDeals.length; i++) {
      const deal = validDeals[i];
      const result = calculatePricing(deal, approvalMatrix, context, defaultShocks);
      results.push([deal.id!, result]);

      // Report progress every CHUNK_SIZE deals
      if ((i + 1) % CHUNK_SIZE === 0 || i === validDeals.length - 1) {
        const response: WorkerResponse = {
          type: 'progress',
          progress: { completed: i + 1, total: validDeals.length },
        };
        self.postMessage(response);
      }
    }

    const response: WorkerResponse = { type: 'result', results };
    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerResponse = {
      type: 'error',
      error: err.message || 'Worker pricing error',
    };
    self.postMessage(response);
  }
};
