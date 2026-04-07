import type {
  ApprovalTask,
  FtpRateCard,
  MarketDataSource,
  MethodologyChangeRequest,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
} from '../../types';
import { mapRateCardsFromDB } from './mappers';
import { fetchSystemConfigValue, saveSystemConfigValue } from './systemConfig';

export const configService = {
  async fetchShocks(): Promise<any> {
    return fetchSystemConfigValue('shocks', { interestRate: 0, liquiditySpread: 0 });
  },

  async saveShocks(shocks: any) {
    await saveSystemConfigValue('shocks', shocks, 'saveShocks');
  },

  async fetchRateCards(): Promise<FtpRateCard[]> {
    const cards = await fetchSystemConfigValue<unknown>('rate_cards', []);
    return mapRateCardsFromDB(cards);
  },

  async saveRateCards(cards: FtpRateCard[]) {
    await saveSystemConfigValue('rate_cards', cards, 'saveRateCards');
  },

  async fetchEsgGrid(type: 'transition' | 'physical' | 'greenium'): Promise<any[]> {
    return fetchSystemConfigValue(`${type}_grid`, []);
  },

  async saveEsgGrid(type: 'transition' | 'physical' | 'greenium', grid: any[]) {
    await saveSystemConfigValue(`${type}_grid`, grid, `saveEsgGrid:${type}`);
  },

  async fetchRarocInputs(): Promise<any | null> {
    return fetchSystemConfigValue('raroc_inputs', null);
  },

  async saveRarocInputs(inputs: any) {
    await saveSystemConfigValue('raroc_inputs', inputs, 'saveRarocInputs');
  },

  async saveApprovalMatrix(config: any): Promise<void> {
    await saveSystemConfigValue('approval_matrix', config, 'saveApprovalMatrix');
  },

  async fetchApprovalMatrix(): Promise<any | null> {
    return fetchSystemConfigValue('approval_matrix', null);
  },

  async saveIncentivisationRules(rules: any[]): Promise<void> {
    await saveSystemConfigValue('incentivisation_rules', rules, 'saveIncentivisationRules');
  },

  async fetchIncentivisationRules(): Promise<any[]> {
    return fetchSystemConfigValue('incentivisation_rules', []);
  },

  async saveSdrConfig(config: any): Promise<void> {
    await saveSystemConfigValue('sdr_config', config, 'saveSdrConfig');
  },

  async fetchSdrConfig(): Promise<any | null> {
    return fetchSystemConfigValue('sdr_config', null);
  },

  async saveLrConfig(config: any): Promise<void> {
    await saveSystemConfigValue('lr_config', config, 'saveLrConfig');
  },

  async fetchLrConfig(): Promise<any | null> {
    return fetchSystemConfigValue('lr_config', null);
  },

  async saveLiquidityCurves(curves: any[]): Promise<void> {
    await saveSystemConfigValue('liquidity_curves', curves, 'saveLiquidityCurves');
  },

  async fetchMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
    return fetchSystemConfigValue('methodology_change_requests', []);
  },

  async saveMethodologyChangeRequests(requests: MethodologyChangeRequest[]): Promise<void> {
    await saveSystemConfigValue('methodology_change_requests', requests, 'saveMethodologyChangeRequests');
  },

  async fetchMethodologyVersions(): Promise<MethodologyVersion[]> {
    return fetchSystemConfigValue('methodology_versions', []);
  },

  async saveMethodologyVersions(versions: MethodologyVersion[]): Promise<void> {
    await saveSystemConfigValue('methodology_versions', versions, 'saveMethodologyVersions');
  },

  async fetchApprovalTasks(): Promise<ApprovalTask[]> {
    return fetchSystemConfigValue('approval_tasks', []);
  },

  async saveApprovalTasks(tasks: ApprovalTask[]): Promise<void> {
    await saveSystemConfigValue('approval_tasks', tasks, 'saveApprovalTasks');
  },

  async fetchPricingDossiers(): Promise<PricingDossier[]> {
    return fetchSystemConfigValue('pricing_dossiers', []);
  },

  async savePricingDossiers(dossiers: PricingDossier[]): Promise<void> {
    await saveSystemConfigValue('pricing_dossiers', dossiers, 'savePricingDossiers');
  },

  async fetchPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    return fetchSystemConfigValue('portfolio_snapshots', []);
  },

  async savePortfolioSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
    await saveSystemConfigValue('portfolio_snapshots', snapshots, 'savePortfolioSnapshots');
  },

  async fetchMarketDataSources(): Promise<MarketDataSource[]> {
    return fetchSystemConfigValue('market_data_sources', []);
  },

  async saveMarketDataSources(sources: MarketDataSource[]): Promise<void> {
    await saveSystemConfigValue('market_data_sources', sources, 'saveMarketDataSources');
  },
};
