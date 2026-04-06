import type {
  ApprovalTask,
  MarketDataSource,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  Transaction,
} from '../../types';

export interface CommitteePackage {
  exportedAt: string;
  packageType: 'COMMITTEE_REVIEW';
  deal: Transaction;
  dossier: PricingDossier;
  approvalTask?: ApprovalTask;
  methodologyVersion?: MethodologyVersion;
  portfolioSnapshot?: PortfolioSnapshot;
  marketDataSources: MarketDataSource[];
}

export function buildCommitteePackage({
  deal,
  dossier,
  approvalTask,
  methodologyVersion,
  portfolioSnapshot,
  marketDataSources,
}: {
  deal: Transaction;
  dossier: PricingDossier;
  approvalTask?: ApprovalTask;
  methodologyVersion?: MethodologyVersion;
  portfolioSnapshot?: PortfolioSnapshot;
  marketDataSources: MarketDataSource[];
}): CommitteePackage {
  return {
    exportedAt: new Date().toISOString(),
    packageType: 'COMMITTEE_REVIEW',
    deal,
    dossier,
    approvalTask,
    methodologyVersion,
    portfolioSnapshot,
    marketDataSources,
  };
}

export function downloadCommitteePackage(committeePackage: CommitteePackage) {
  const blob = new Blob([JSON.stringify(committeePackage, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${committeePackage.dossier.dealId}_committee_package.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function summarizeCommitteeQueue({
  deals,
  dossiers,
  approvalTasks,
}: {
  deals: Transaction[];
  dossiers: PricingDossier[];
  approvalTasks: ApprovalTask[];
}) {
  const pendingReview = dossiers.filter((dossier) => dossier.status === 'Pending_Approval').length;
  const readyToBook = deals.filter((deal) => deal.status === 'Approved').length;
  const aiSupported = dossiers.filter((dossier) => (dossier.aiResponseTraces?.length || 0) > 0).length;
  const openTasks = approvalTasks.filter((task) => task.scope === 'DEAL_PRICING' && task.status === 'Pending').length;

  return {
    pendingReview,
    readyToBook,
    aiSupported,
    openTasks,
  };
}
