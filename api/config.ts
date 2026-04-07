import type {
  ApprovalTask,
  BusinessUnit,
  ClientEntity,
  FtpRateCard,
  GeneralRule,
  MarketDataSource,
  MethodologyChangeRequest,
  MethodologyVersion,
  PortfolioSnapshot,
  PricingDossier,
  ProductDefinition,
  RuleVersion,
  UserProfile,
} from '../types';
import { apiGet, apiPost, apiDelete } from '../utils/apiFetch';
import {
  mapRuleFromDB,
  mapRuleToDB,
  mapRuleVersionFromDB,
  mapClientFromDB,
  mapBUFromDB,
  mapProductFromDB,
  mapRateCardsFromDB,
} from './mappers';
import { fetchSystemConfigValue, saveSystemConfigValue } from '../utils/supabase/systemConfig';

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function listRules(): Promise<GeneralRule[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/config/rules');
    return rows.map(mapRuleFromDB);
  } catch { return []; }
}

export async function upsertRule(rule: GeneralRule): Promise<void> {
  await apiPost('/config/rules', mapRuleToDB(rule));
}

export async function deleteRule(id: number): Promise<void> {
  await apiDelete(`/config/rules/${id}`);
}

export async function listRuleVersions(ruleId: number): Promise<RuleVersion[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(`/config/rules/${ruleId}/versions`);
    return rows.map(mapRuleVersionFromDB);
  } catch { return []; }
}

export async function createRuleVersion(
  ruleId: number,
  ruleData: Partial<GeneralRule>,
  changedBy: string,
  changeReason: string,
): Promise<void> {
  await apiPost(`/config/rules/${ruleId}/versions`, { ...ruleData, changedBy, changeReason });
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function listClients(): Promise<ClientEntity[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/config/clients');
    return rows.map(mapClientFromDB);
  } catch { return []; }
}

export async function upsertClient(client: ClientEntity): Promise<void> {
  await apiPost('/config/clients', client);
}

export async function deleteClient(id: string): Promise<void> {
  await apiDelete(`/config/clients/${id}`);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(): Promise<ProductDefinition[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/config/products');
    return rows.map(mapProductFromDB);
  } catch { return []; }
}

export async function upsertProduct(product: ProductDefinition): Promise<void> {
  await apiPost('/config/products', product);
}

export async function deleteProduct(id: string): Promise<void> {
  await apiDelete(`/config/products/${id}`);
}

// ---------------------------------------------------------------------------
// Business Units
// ---------------------------------------------------------------------------

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/config/business-units');
    return rows.map(mapBUFromDB);
  } catch { return []; }
}

export async function upsertBusinessUnit(unit: BusinessUnit): Promise<void> {
  await apiPost('/config/business-units', unit);
}

export async function deleteBusinessUnit(id: string): Promise<void> {
  await apiDelete(`/config/business-units/${id}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<UserProfile[]> {
  try {
    return await apiGet<UserProfile[]>('/config/users');
  } catch { return []; }
}

export async function upsertUser(user: UserProfile): Promise<void> {
  await apiPost('/config/users', user);
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/config/users/${id}`);
}

// ---------------------------------------------------------------------------
// System Config (key-value store) — delegates to systemConfig.ts fetch wrappers
// ---------------------------------------------------------------------------

export async function fetchShocks(): Promise<{ interestRate: number; liquiditySpread: number }> {
  return fetchSystemConfigValue('shocks', { interestRate: 0, liquiditySpread: 0 });
}

export async function saveShocks(shocks: { interestRate: number; liquiditySpread: number }): Promise<void> {
  await saveSystemConfigValue('shocks', shocks, 'saveShocks');
}

export async function fetchRateCards(): Promise<FtpRateCard[]> {
  const cards = await fetchSystemConfigValue<unknown>('rate_cards', []);
  return mapRateCardsFromDB(cards);
}

export async function saveRateCards(cards: FtpRateCard[]): Promise<void> {
  await saveSystemConfigValue('rate_cards', cards, 'saveRateCards');
}

export async function fetchEsgGrid(type: 'transition' | 'physical'): Promise<unknown[]> {
  return fetchSystemConfigValue(`${type}_grid`, []);
}

export async function saveEsgGrid(type: 'transition' | 'physical', grid: unknown[]): Promise<void> {
  await saveSystemConfigValue(`${type}_grid`, grid, `saveEsgGrid:${type}`);
}

export async function fetchRarocInputs(): Promise<unknown | null> {
  return fetchSystemConfigValue('raroc_inputs', null);
}

export async function saveRarocInputs(inputs: unknown): Promise<void> {
  await saveSystemConfigValue('raroc_inputs', inputs, 'saveRarocInputs');
}

export async function fetchApprovalMatrix(): Promise<unknown | null> {
  return fetchSystemConfigValue('approval_matrix', null);
}

export async function saveApprovalMatrix(config: unknown): Promise<void> {
  await saveSystemConfigValue('approval_matrix', config, 'saveApprovalMatrix');
}

export async function fetchIncentivisationRules(): Promise<unknown[]> {
  return fetchSystemConfigValue('incentivisation_rules', []);
}

export async function saveIncentivisationRules(rules: unknown[]): Promise<void> {
  await saveSystemConfigValue('incentivisation_rules', rules, 'saveIncentivisationRules');
}

export async function fetchSdrConfig(): Promise<unknown | null> {
  return fetchSystemConfigValue('sdr_config', null);
}

export async function saveSdrConfig(config: unknown): Promise<void> {
  await saveSystemConfigValue('sdr_config', config, 'saveSdrConfig');
}

export async function fetchLrConfig(): Promise<unknown | null> {
  return fetchSystemConfigValue('lr_config', null);
}

export async function saveLrConfig(config: unknown): Promise<void> {
  await saveSystemConfigValue('lr_config', config, 'saveLrConfig');
}

export async function saveLiquidityCurves(curves: unknown[]): Promise<void> {
  await saveSystemConfigValue('liquidity_curves', curves, 'saveLiquidityCurves');
}

export async function fetchMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
  return fetchSystemConfigValue('methodology_change_requests', []);
}

export async function saveMethodologyChangeRequests(requests: MethodologyChangeRequest[]): Promise<void> {
  await saveSystemConfigValue('methodology_change_requests', requests, 'saveMethodologyChangeRequests');
}

export async function fetchMethodologyVersions(): Promise<MethodologyVersion[]> {
  return fetchSystemConfigValue('methodology_versions', []);
}

export async function saveMethodologyVersions(versions: MethodologyVersion[]): Promise<void> {
  await saveSystemConfigValue('methodology_versions', versions, 'saveMethodologyVersions');
}

export async function fetchApprovalTasks(): Promise<ApprovalTask[]> {
  return fetchSystemConfigValue('approval_tasks', []);
}

export async function saveApprovalTasks(tasks: ApprovalTask[]): Promise<void> {
  await saveSystemConfigValue('approval_tasks', tasks, 'saveApprovalTasks');
}

export async function fetchPricingDossiers(): Promise<PricingDossier[]> {
  return fetchSystemConfigValue('pricing_dossiers', []);
}

export async function savePricingDossiers(dossiers: PricingDossier[]): Promise<void> {
  await saveSystemConfigValue('pricing_dossiers', dossiers, 'savePricingDossiers');
}

export async function fetchPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  return fetchSystemConfigValue('portfolio_snapshots', []);
}

export async function savePortfolioSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
  await saveSystemConfigValue('portfolio_snapshots', snapshots, 'savePortfolioSnapshots');
}

export async function fetchMarketDataSources(): Promise<MarketDataSource[]> {
  return fetchSystemConfigValue('market_data_sources', []);
}

export async function saveMarketDataSources(sources: MarketDataSource[]): Promise<void> {
  await saveSystemConfigValue('market_data_sources', sources, 'saveMarketDataSources');
}
