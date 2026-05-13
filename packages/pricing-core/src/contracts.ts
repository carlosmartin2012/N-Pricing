import type { ApprovalMatrixConfig, FTPResult, Transaction } from '../../../types';
import type { PricingContext, PricingFeatureFlags, PricingShocks } from '../../../utils/pricingEngine';

export type PricingCoreRequest = {
  deal: Transaction;
  approvalMatrix: ApprovalMatrixConfig;
  context?: PricingContext;
  shocks?: PricingShocks;
  featureFlags?: PricingFeatureFlags;
};

export type PricingCoreMetadata = {
  boundary: 'pricing-core';
  coreVersion: 'legacy-orchestrator-v1';
  featureFlags: PricingFeatureFlags;
};

export type PricingCoreResult = {
  output: FTPResult;
  metadata: PricingCoreMetadata;
};

export type PricingCoreBatchRequest = {
  deals: Transaction[];
  approvalMatrix: ApprovalMatrixConfig;
  context: PricingContext;
  shocks?: PricingShocks;
  featureFlags?: PricingFeatureFlags;
};
