/**
 * API layer — Configuration
 *
 * Wraps Supabase calls for rules, master data (clients, products,
 * business units, users), and system_config key-value pairs.
 */

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
import { safeSupabaseCall } from '../utils/validation';
import { supabase } from '../utils/supabase/shared';
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

/** Fetch all pricing rules. */
export async function listRules(): Promise<GeneralRule[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('rules').select('*'),
    [],
    'listRules',
  );
  return (data as Record<string, unknown>[]).map(mapRuleFromDB);
}

/** Insert or update a pricing rule. */
export async function upsertRule(rule: GeneralRule): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('rules').upsert(mapRuleToDB(rule)),
    null,
    'upsertRule',
  );
}

/** Delete a pricing rule by id. */
export async function deleteRule(id: number): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('rules').delete().eq('id', id),
    null,
    'deleteRule',
  );
}

/** Fetch version history for a given rule. */
export async function listRuleVersions(ruleId: number): Promise<RuleVersion[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('rule_versions')
        .select('*')
        .eq('rule_id', ruleId)
        .order('version', { ascending: false }),
    [],
    'listRuleVersions',
  );
  return (data as Record<string, unknown>[]).map(mapRuleVersionFromDB);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** Fetch all client entities. */
export async function listClients(): Promise<ClientEntity[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('clients').select('*'),
    [],
    'listClients',
  );
  return (data as Record<string, unknown>[]).map(mapClientFromDB);
}

/** Insert or update a client entity. */
export async function upsertClient(client: ClientEntity): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('clients').upsert(client),
    null,
    'upsertClient',
  );
}

/** Delete a client entity by id. */
export async function deleteClient(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('clients').delete().eq('id', id),
    null,
    'deleteClient',
  );
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Fetch all product definitions. */
export async function listProducts(): Promise<ProductDefinition[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('products').select('*'),
    [],
    'listProducts',
  );
  return (data as Record<string, unknown>[]).map(mapProductFromDB);
}

/** Insert or update a product definition. */
export async function upsertProduct(product: ProductDefinition): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('products').upsert(product),
    null,
    'upsertProduct',
  );
}

/** Delete a product definition by id. */
export async function deleteProduct(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('products').delete().eq('id', id),
    null,
    'deleteProduct',
  );
}

// ---------------------------------------------------------------------------
// Business Units
// ---------------------------------------------------------------------------

/** Fetch all business units. */
export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('business_units').select('*'),
    [],
    'listBusinessUnits',
  );
  return (data as Record<string, unknown>[]).map(mapBUFromDB);
}

/** Insert or update a business unit. */
export async function upsertBusinessUnit(unit: BusinessUnit): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('business_units').upsert(unit),
    null,
    'upsertBusinessUnit',
  );
}

/** Delete a business unit by id. */
export async function deleteBusinessUnit(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('business_units').delete().eq('id', id),
    null,
    'deleteBusinessUnit',
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Fetch all user profiles. */
export async function listUsers(): Promise<UserProfile[]> {
  const { data } = await safeSupabaseCall(
    async () => supabase.from('users').select('*'),
    [],
    'listUsers',
  );
  return (data ?? []) as UserProfile[];
}

/** Insert or update a user profile. */
export async function upsertUser(user: UserProfile): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('users').upsert(user),
    null,
    'upsertUser',
  );
}

/** Delete a user profile by id. */
export async function deleteUser(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('users').delete().eq('id', id),
    null,
    'deleteUser',
  );
}

// ---------------------------------------------------------------------------
// System Config (key-value store)
// ---------------------------------------------------------------------------

/** Fetch shocks configuration. */
export async function fetchShocks(): Promise<{ interestRate: number; liquiditySpread: number }> {
  return fetchSystemConfigValue('shocks', { interestRate: 0, liquiditySpread: 0 });
}

/** Save shocks configuration. */
export async function saveShocks(shocks: { interestRate: number; liquiditySpread: number }): Promise<void> {
  await saveSystemConfigValue('shocks', shocks, 'saveShocks');
}

/** Fetch FTP rate cards. */
export async function fetchRateCards(): Promise<FtpRateCard[]> {
  const cards = await fetchSystemConfigValue<unknown>('rate_cards', []);
  return mapRateCardsFromDB(cards);
}

/** Save FTP rate cards. */
export async function saveRateCards(cards: FtpRateCard[]): Promise<void> {
  await saveSystemConfigValue('rate_cards', cards, 'saveRateCards');
}

/** Fetch ESG grid (transition or physical). */
export async function fetchEsgGrid(type: 'transition' | 'physical'): Promise<unknown[]> {
  return fetchSystemConfigValue(`${type}_grid`, []);
}

/** Save ESG grid (transition or physical). */
export async function saveEsgGrid(type: 'transition' | 'physical', grid: unknown[]): Promise<void> {
  await saveSystemConfigValue(`${type}_grid`, grid, `saveEsgGrid:${type}`);
}

/** Fetch RAROC inputs. */
export async function fetchRarocInputs(): Promise<unknown | null> {
  return fetchSystemConfigValue('raroc_inputs', null);
}

/** Save RAROC inputs. */
export async function saveRarocInputs(inputs: unknown): Promise<void> {
  await saveSystemConfigValue('raroc_inputs', inputs, 'saveRarocInputs');
}

/** Fetch approval matrix. */
export async function fetchApprovalMatrix(): Promise<unknown | null> {
  return fetchSystemConfigValue('approval_matrix', null);
}

/** Save approval matrix. */
export async function saveApprovalMatrix(config: unknown): Promise<void> {
  await saveSystemConfigValue('approval_matrix', config, 'saveApprovalMatrix');
}

/** Fetch incentivisation rules. */
export async function fetchIncentivisationRules(): Promise<unknown[]> {
  return fetchSystemConfigValue('incentivisation_rules', []);
}

/** Save incentivisation rules. */
export async function saveIncentivisationRules(rules: unknown[]): Promise<void> {
  await saveSystemConfigValue('incentivisation_rules', rules, 'saveIncentivisationRules');
}

/** Fetch SDR config. */
export async function fetchSdrConfig(): Promise<unknown | null> {
  return fetchSystemConfigValue('sdr_config', null);
}

/** Save SDR config. */
export async function saveSdrConfig(config: unknown): Promise<void> {
  await saveSystemConfigValue('sdr_config', config, 'saveSdrConfig');
}

/** Fetch liquidity recharge config. */
export async function fetchLrConfig(): Promise<unknown | null> {
  return fetchSystemConfigValue('lr_config', null);
}

/** Save liquidity recharge config. */
export async function saveLrConfig(config: unknown): Promise<void> {
  await saveSystemConfigValue('lr_config', config, 'saveLrConfig');
}

/** Save liquidity curves to system config. */
export async function saveLiquidityCurves(curves: unknown[]): Promise<void> {
  await saveSystemConfigValue('liquidity_curves', curves, 'saveLiquidityCurves');
}

/** Fetch methodology change requests. */
export async function fetchMethodologyChangeRequests(): Promise<MethodologyChangeRequest[]> {
  return fetchSystemConfigValue('methodology_change_requests', []);
}

/** Save methodology change requests. */
export async function saveMethodologyChangeRequests(requests: MethodologyChangeRequest[]): Promise<void> {
  await saveSystemConfigValue('methodology_change_requests', requests, 'saveMethodologyChangeRequests');
}

/** Fetch methodology versions. */
export async function fetchMethodologyVersions(): Promise<MethodologyVersion[]> {
  return fetchSystemConfigValue('methodology_versions', []);
}

/** Save methodology versions. */
export async function saveMethodologyVersions(versions: MethodologyVersion[]): Promise<void> {
  await saveSystemConfigValue('methodology_versions', versions, 'saveMethodologyVersions');
}

/** Fetch approval tasks. */
export async function fetchApprovalTasks(): Promise<ApprovalTask[]> {
  return fetchSystemConfigValue('approval_tasks', []);
}

/** Save approval tasks. */
export async function saveApprovalTasks(tasks: ApprovalTask[]): Promise<void> {
  await saveSystemConfigValue('approval_tasks', tasks, 'saveApprovalTasks');
}

/** Fetch pricing dossiers. */
export async function fetchPricingDossiers(): Promise<PricingDossier[]> {
  return fetchSystemConfigValue('pricing_dossiers', []);
}

/** Save pricing dossiers. */
export async function savePricingDossiers(dossiers: PricingDossier[]): Promise<void> {
  await saveSystemConfigValue('pricing_dossiers', dossiers, 'savePricingDossiers');
}

/** Fetch portfolio snapshots. */
export async function fetchPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  return fetchSystemConfigValue('portfolio_snapshots', []);
}

/** Save portfolio snapshots. */
export async function savePortfolioSnapshots(snapshots: PortfolioSnapshot[]): Promise<void> {
  await saveSystemConfigValue('portfolio_snapshots', snapshots, 'savePortfolioSnapshots');
}

/** Fetch market data sources. */
export async function fetchMarketDataSources(): Promise<MarketDataSource[]> {
  return fetchSystemConfigValue('market_data_sources', []);
}

/** Save market data sources. */
export async function saveMarketDataSources(sources: MarketDataSource[]): Promise<void> {
  await saveSystemConfigValue('market_data_sources', sources, 'saveMarketDataSources');
}
