import type {
  ApprovalTask,
  FtpRateCard,
  MarketDataSource,
  MethodologyChangeRequest,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
} from '../../types';
import * as configApi from '../../api/config';
import { fetchSystemConfigValue, saveSystemConfigValue } from './systemConfig';

/**
 * @deprecated Use `api/config.ts` directly for CRUD flows. This adapter remains
 * only to preserve the public `supabaseService` surface during the migration.
 */
export const configService = {
  fetchShocks: configApi.fetchShocks,
  saveShocks: configApi.saveShocks,
  fetchRateCards: configApi.fetchRateCards,
  saveRateCards: configApi.saveRateCards,
  fetchRarocInputs: configApi.fetchRarocInputs,
  saveRarocInputs: configApi.saveRarocInputs,
  fetchApprovalMatrix: configApi.fetchApprovalMatrix,
  saveApprovalMatrix: configApi.saveApprovalMatrix,
  fetchIncentivisationRules: configApi.fetchIncentivisationRules,
  saveIncentivisationRules: configApi.saveIncentivisationRules,
  fetchSdrConfig: configApi.fetchSdrConfig,
  saveSdrConfig: configApi.saveSdrConfig,
  fetchLrConfig: configApi.fetchLrConfig,
  saveLrConfig: configApi.saveLrConfig,
  saveLiquidityCurves: configApi.saveLiquidityCurves,
  fetchMethodologyChangeRequests: configApi.fetchMethodologyChangeRequests,
  saveMethodologyChangeRequests: configApi.saveMethodologyChangeRequests,
  fetchMethodologyVersions: configApi.fetchMethodologyVersions,
  saveMethodologyVersions: configApi.saveMethodologyVersions,
  fetchApprovalTasks: configApi.fetchApprovalTasks,
  saveApprovalTasks: configApi.saveApprovalTasks,
  fetchPricingDossiers: configApi.fetchPricingDossiers,
  savePricingDossiers: configApi.savePricingDossiers,
  fetchPortfolioSnapshots: configApi.fetchPortfolioSnapshots,
  savePortfolioSnapshots: configApi.savePortfolioSnapshots,
  fetchMarketDataSources: configApi.fetchMarketDataSources,
  saveMarketDataSources: configApi.saveMarketDataSources,

  fetchEsgGrid(type: 'transition' | 'physical' | 'greenium') {
    if (type === 'greenium') {
      return fetchSystemConfigValue('greenium_grid', []);
    }
    return configApi.fetchEsgGrid(type);
  },

  saveEsgGrid(type: 'transition' | 'physical' | 'greenium', grid: unknown[]) {
    if (type === 'greenium') {
      return saveSystemConfigValue('greenium_grid', grid, 'saveEsgGrid:greenium');
    }
    return configApi.saveEsgGrid(type, grid);
  },

  async fetchLegacyRateCards(): Promise<FtpRateCard[]> {
    return configApi.fetchRateCards();
  },

  async fetchLegacyMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
    return configApi.fetchMethodologyChangeRequests();
  },

  async fetchLegacyMethodologyVersions(): Promise<MethodologyVersion[]> {
    return configApi.fetchMethodologyVersions();
  },

  async fetchLegacyApprovalTasks(): Promise<ApprovalTask[]> {
    return configApi.fetchApprovalTasks();
  },

  async fetchLegacyPricingDossiers(): Promise<PricingDossier[]> {
    return configApi.fetchPricingDossiers();
  },

  async fetchLegacyPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    return configApi.fetchPortfolioSnapshots();
  },

  async fetchLegacyMarketDataSources(): Promise<MarketDataSource[]> {
    return configApi.fetchMarketDataSources();
  },
};
