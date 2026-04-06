import type { ApprovalMatrixConfig, PortfolioScenario, PortfolioSnapshot, Transaction } from '../../types';
import type { PricingContext } from '../pricingEngine';
import { buildPortfolioSnapshot } from '../governanceWorkflows';
import { configService } from './config';

export const portfolioReportingService = {
  async fetchPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    return configService.fetchPortfolioSnapshots();
  },

  async savePortfolioSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
    await configService.savePortfolioSnapshots(snapshots);
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
