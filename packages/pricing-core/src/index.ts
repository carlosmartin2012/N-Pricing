import {
  batchReprice as legacyBatchReprice,
  calculatePricing as legacyCalculatePricing,
  DEFAULT_PRICING_SHOCKS,
  type PricingContext,
  type PricingFeatureFlags,
} from '../../../utils/pricingEngine';
import type { FTPResult } from '../../../types';
import type { PricingCoreBatchRequest, PricingCoreRequest, PricingCoreResult } from './contracts';

export type { PricingContext, PricingFeatureFlags, PricingShocks } from '../../../utils/pricingEngine';
export type { PricingCoreBatchRequest, PricingCoreMetadata, PricingCoreRequest, PricingCoreResult } from './contracts';

export { DEFAULT_PRICING_SHOCKS } from '../../../utils/pricingEngine';
export { resolveEffectiveTenors } from '../../../utils/pricingEngine';

export function calculatePricingCore(request: PricingCoreRequest): PricingCoreResult {
  const featureFlags = mergeFeatureFlags(request.context?.featureFlags, request.featureFlags);
  const context = withFeatureFlags(request.context, featureFlags);
  const output = legacyCalculatePricing(
    request.deal,
    request.approvalMatrix,
    context,
    request.shocks ?? DEFAULT_PRICING_SHOCKS
  );
  return {
    output,
    metadata: {
      boundary: 'pricing-core',
      coreVersion: 'legacy-orchestrator-v1',
      featureFlags,
    },
  };
}

export function calculatePricingOutput(request: PricingCoreRequest): FTPResult {
  return calculatePricingCore(request).output;
}

export function calculatePricing(
  deal: PricingCoreRequest['deal'],
  approvalMatrix: PricingCoreRequest['approvalMatrix'],
  context?: PricingContext,
  shocks = DEFAULT_PRICING_SHOCKS
): FTPResult {
  return calculatePricingOutput({
    deal,
    approvalMatrix,
    context,
    shocks,
  });
}

export function batchRepriceCore(request: PricingCoreBatchRequest): Map<string, FTPResult> {
  const featureFlags = mergeFeatureFlags(request.context.featureFlags, request.featureFlags);
  return legacyBatchReprice(
    request.deals,
    request.approvalMatrix,
    {
      ...request.context,
      featureFlags,
    },
    request.shocks ?? DEFAULT_PRICING_SHOCKS
  );
}

export function batchReprice(
  deals: PricingCoreBatchRequest['deals'],
  approvalMatrix: PricingCoreBatchRequest['approvalMatrix'],
  context: PricingContext,
  shocks = DEFAULT_PRICING_SHOCKS
): Map<string, FTPResult> {
  return batchRepriceCore({
    deals,
    approvalMatrix,
    context,
    shocks,
  });
}

function withFeatureFlags(
  context: PricingContext | undefined,
  featureFlags: PricingFeatureFlags
): PricingContext | undefined {
  if (!context && Object.keys(featureFlags).length === 0) return undefined;
  return {
    ...(context ?? {}),
    featureFlags,
  } as PricingContext;
}

function mergeFeatureFlags(
  contextFlags: PricingFeatureFlags | undefined,
  requestFlags: PricingFeatureFlags | undefined
): PricingFeatureFlags {
  return {
    ...(contextFlags ?? {}),
    ...(requestFlags ?? {}),
  };
}
