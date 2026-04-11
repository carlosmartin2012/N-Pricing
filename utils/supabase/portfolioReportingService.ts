import type { ApprovalMatrixConfig, PortfolioScenario, PortfolioSnapshot, Transaction } from '../../types';
import * as configApi from '../../api/config';
import type { PricingContext } from '../pricingEngine';
import { buildPortfolioSnapshot } from '../governanceWorkflows';

export const portfolioReportingService = {
  async fetchPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    return configApi.fetchPortfolioSnapshots();
  },

  async savePortfolioSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
    await configApi.savePortfolioSnapshots(snapshots);
  },

  createPortfolioSnapshot({
    name,
    scenario,
    deals,
    approvalMatrix,
    pricingContext,
    createdByEmail,
    createdByName,
  }: {
    name: string;
    scenario: PortfolioScenario;
    deals: Transaction[];
    approvalMatrix: ApprovalMatrixConfig;
    pricingContext: PricingContext;
    createdByEmail: string;
    createdByName: string;
  }): PortfolioSnapshot {
    return buildPortfolioSnapshot({
      name,
      scenario,
      deals,
      approvalMatrix,
      pricingContext,
      createdByEmail,
      createdByName,
    });
  },
};
