import { useMemo, useState } from 'react';
import type { DataContextType } from '../../../contexts/DataContext';
import { findLatestPortfolioSnapshotForDeal } from '../../../utils/aiGrounding';
import { getAvailableActions, type UserRole } from '../../../utils/dealWorkflow';
import type { Transaction } from '../../../types';
import { summarizeCommitteeQueue } from '../committeeDossierUtils';

interface UseBlotterStateParams {
  deals: Transaction[];
  data: Pick<
    DataContextType,
    'approvalTasks' | 'pricingDossiers' | 'methodologyVersions' | 'portfolioSnapshots' | 'marketDataSources'
  >;
  userRole: UserRole;
}

export function useBlotterState({ deals, data, userRole }: UseBlotterStateParams) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedDossierDealId, setSelectedDossierDealId] = useState<string | null>(null);

  const filteredDeals = useMemo(
    () =>
      deals.filter((deal) => {
        const normalizedSearch = searchTerm.toLowerCase();
        const matchesSearch =
          deal.clientId.toLowerCase().includes(normalizedSearch) ||
          (deal.id || '').toLowerCase().includes(normalizedSearch);
        const matchesStatus = filterStatus === 'All' || deal.status === filterStatus;
        return matchesSearch && matchesStatus;
      }),
    [deals, searchTerm, filterStatus]
  );

  const filteredDealIds = useMemo(() => new Set(filteredDeals.map((deal) => deal.id)), [filteredDeals]);

  const selectedDossierDeal = useMemo(
    () => deals.find((deal) => deal.id === selectedDossierDealId) || null,
    [deals, selectedDossierDealId]
  );

  const selectedPricingDossier = useMemo(
    () =>
      selectedDossierDeal?.id
        ? data.pricingDossiers.find((dossier) => dossier.dealId === selectedDossierDeal.id)
        : undefined,
    [data.pricingDossiers, selectedDossierDeal?.id]
  );

  const selectedApprovalTask = useMemo(() => {
    if (!selectedDossierDeal?.id) return undefined;

    return (
      (selectedPricingDossier?.approvalTaskId
        ? data.approvalTasks.find((task) => task.id === selectedPricingDossier.approvalTaskId)
        : undefined) ||
      data.approvalTasks.find((task) => task.scope === 'DEAL_PRICING' && task.subject.id === selectedDossierDeal.id)
    );
  }, [data.approvalTasks, selectedDossierDeal?.id, selectedPricingDossier?.approvalTaskId]);

  const selectedMethodologyVersion = useMemo(
    () =>
      selectedPricingDossier
        ? data.methodologyVersions.find((version) => version.id === selectedPricingDossier.methodologyVersionId)
        : undefined,
    [data.methodologyVersions, selectedPricingDossier]
  );

  const selectedPortfolioSnapshot = useMemo(() => {
    if (!selectedDossierDeal?.id) return undefined;

    return (
      (selectedPricingDossier?.groundedContext?.portfolioSnapshotId
        ? data.portfolioSnapshots.find(
            (snapshot) => snapshot.id === selectedPricingDossier.groundedContext?.portfolioSnapshotId
          )
        : undefined) || findLatestPortfolioSnapshotForDeal(selectedDossierDeal.id, data.portfolioSnapshots)
    );
  }, [data.portfolioSnapshots, selectedDossierDeal?.id, selectedPricingDossier?.groundedContext?.portfolioSnapshotId]);

  const selectedMarketDataSources = useMemo(() => {
    if (!selectedPricingDossier?.groundedContext?.marketDataSourceIds?.length) return data.marketDataSources;

    return data.marketDataSources.filter((source) =>
      selectedPricingDossier.groundedContext?.marketDataSourceIds?.includes(source.id)
    );
  }, [data.marketDataSources, selectedPricingDossier?.groundedContext?.marketDataSourceIds]);

  const committeeSummary = useMemo(
    () =>
      summarizeCommitteeQueue({
        deals: filteredDeals,
        dossiers: data.pricingDossiers.filter((dossier) => filteredDealIds.has(dossier.dealId)),
        approvalTasks: data.approvalTasks.filter(
          (task) => task.scope === 'DEAL_PRICING' && filteredDealIds.has(task.subject.id)
        ),
      }),
    [data.approvalTasks, data.pricingDossiers, filteredDealIds, filteredDeals]
  );

  const selectedAvailableActions = useMemo(
    () => (selectedDossierDeal ? getAvailableActions(selectedDossierDeal.status || 'Draft', userRole) : []),
    [selectedDossierDeal, userRole]
  );

  return {
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredDeals,
    selectedDossierDeal,
    selectedPricingDossier,
    selectedApprovalTask,
    selectedMethodologyVersion,
    selectedPortfolioSnapshot,
    selectedMarketDataSources,
    committeeSummary,
    selectedAvailableActions,
    setSelectedDossierDealId,
  };
}
