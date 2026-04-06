import type { BehaviouralModel, GeneralRule, YieldCurvePoint } from '../../types';
import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_PRODUCT_DEFS,
  MOCK_USERS,
  MOCK_YIELD_CURVE,
} from '../../constants';
import { mapDealToDB, mapModelFromDB, mapModelToDB, mapRuleToDB } from './mappers';
import { log, supabase, todayIso } from './shared';

export const marketDataService = {
  async fetchModels(): Promise<BehaviouralModel[]> {
    const { data, error } = await supabase
      .from('behavioural_models')
      .select('*');

    if (error) return [];
    return (data || []).map(mapModelFromDB);
  },

  async saveModel(model: BehaviouralModel) {
    const { data, error } = await supabase
      .from('behavioural_models')
      .upsert(mapModelToDB(model))
      .select();

    if (error) log.error('Error saving model', { code: error.code });
    return data ? mapModelFromDB(data[0]) : null;
  },

  async deleteModel(id: string) {
    const { error } = await supabase
      .from('behavioural_models')
      .delete()
      .eq('id', id);

    if (error) log.error('Error deleting model', { code: error.code });
  },

  async saveCurveSnapshot(currency: string, date: string, points: YieldCurvePoint[]) {
    const { error } = await supabase
      .from('yield_curves')
      .insert({
        currency,
        as_of_date: date,
        grid_data: points,
      });

    if (error) log.error('Error saving curve snapshot', { code: error.code });
  },

  async fetchCurveHistory(currency: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('yield_curves')
      .select('*')
      .eq('currency', currency)
      .order('as_of_date', { ascending: false });

    if (error) return [];
    return data || [];
  },

  async fetchCurveHistoryByIdAndMonths(
    curveId: string,
    months: number = 12,
  ): Promise<{ date: string; points: YieldCurvePoint[] }[]> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('yield_curve_history')
      .select('snapshot_date, points')
      .eq('curve_id', curveId)
      .gte('snapshot_date', cutoffStr)
      .order('snapshot_date', { ascending: false });

    if (error) {
      log.error('Error fetching curve history', { code: error.code, curveId });
      return [];
    }

    return (data || []).map((row: any) => ({
      date: row.snapshot_date,
      points: row.points as YieldCurvePoint[],
    }));
  },

  async saveCurveHistorySnapshot(
    curveId: string,
    currency: string,
    date: string,
    points: YieldCurvePoint[],
  ): Promise<void> {
    const { error } = await supabase
      .from('yield_curve_history')
      .upsert(
        { curve_id: curveId, currency, snapshot_date: date, points },
        { onConflict: 'curve_id,snapshot_date' },
      );

    if (error) {
      log.error('Error saving curve history snapshot', { code: error.code, curveId, date });
    }
  },

  async fetchYieldCurves(): Promise<any[]> {
    const { data, error } = await supabase
      .from('yield_curves')
      .select('*')
      .order('as_of_date', { ascending: false });

    if (error) {
      log.error('Error fetching yield curves', { code: error.code });
      return [];
    }

    return data || [];
  },

  async fetchLiquidityCurves(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('liquidity_curves')
        .select('*')
        .order('created_at', { ascending: false });

      return (data || []).map((curve: any) => ({
        currency: curve.currency,
        curveType: curve.curve_type,
        lastUpdate: curve.last_update,
        points: curve.points || [],
      }));
    } catch (error) {
      log.warn('fetchLiquidityCurves failed', { error: String(error) });
      return [];
    }
  },

  async seedDatabase(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    log.info('Starting database seed');

    const { error: clientsErr } = await supabase.from('clients').upsert(MOCK_CLIENTS);
    if (clientsErr) errors.push(`clients: ${clientsErr.message}`);
    else log.info('Clients seeded');

    const { error: productsErr } = await supabase.from('products').upsert(MOCK_PRODUCT_DEFS);
    if (productsErr) errors.push(`products: ${productsErr.message}`);
    else log.info('Products seeded');

    const { error: buErr } = await supabase.from('business_units').upsert(MOCK_BUSINESS_UNITS);
    if (buErr) errors.push(`business_units: ${buErr.message}`);
    else log.info('Business Units seeded');

    const { error: usersErr } = await supabase.from('users').upsert(MOCK_USERS);
    if (usersErr) errors.push(`users: ${usersErr.message}`);
    else log.info('Users seeded');

    const { error: modelsErr } = await supabase
      .from('behavioural_models')
      .upsert(MOCK_BEHAVIOURAL_MODELS.map(mapModelToDB));
    if (modelsErr) errors.push(`behavioural_models: ${modelsErr.message}`);
    else log.info('Behavioural Models seeded');

    const { error: dealsErr } = await supabase
      .from('deals')
      .upsert(MOCK_DEALS.map(mapDealToDB));
    if (dealsErr) errors.push(`deals: ${dealsErr.message}`);
    else log.info('Deals seeded');

    const defaultRules: GeneralRule[] = [
      {
        id: 1,
        businessUnit: 'Commercial Banking',
        product: 'Commercial Loan',
        segment: 'Corporate',
        tenor: '< 1Y',
        baseMethod: 'Matched Maturity',
        baseReference: 'USD-SOFR',
        spreadMethod: 'Curve Lookup',
        liquidityReference: 'RC-LIQ-USD-STD',
        strategicSpread: 10,
      },
      {
        id: 2,
        businessUnit: 'SME / Business',
        product: 'Commercial Loan',
        segment: 'SME',
        tenor: 'Any',
        baseMethod: 'Rate Card',
        baseReference: 'USD-SOFR',
        spreadMethod: 'Grid Pricing',
        liquidityReference: 'RC-COM-SME-A',
        strategicSpread: 25,
      },
      {
        id: 3,
        businessUnit: 'Retail Banking',
        product: 'Term Deposit',
        segment: 'Retail',
        tenor: '> 2Y',
        baseMethod: 'Moving Average',
        baseReference: 'EUR-ESTR',
        spreadMethod: 'Fixed Spread',
        liquidityReference: 'RC-LIQ-EUR-HY',
        strategicSpread: 0,
      },
      {
        id: 4,
        businessUnit: 'Retail Banking',
        product: 'Mortgage',
        segment: 'All',
        tenor: 'Fixed',
        baseMethod: 'Matched Maturity',
        baseReference: 'USD-SOFR',
        spreadMethod: 'Curve Lookup',
        liquidityReference: 'RC-LIQ-USD-STD',
        strategicSpread: 5,
      },
    ];

    const { error: rulesErr } = await supabase
      .from('rules')
      .upsert(defaultRules.map(mapRuleToDB));
    if (rulesErr) errors.push(`rules: ${rulesErr.message}`);
    else log.info('Rules seeded');

    const { error: curveErr } = await supabase
      .from('yield_curves')
      .insert({
        currency: 'USD',
        as_of_date: todayIso(),
        grid_data: MOCK_YIELD_CURVE,
      });
    if (curveErr) errors.push(`yield_curves: ${curveErr.message}`);
    else log.info('Yield Curve seeded');

    log.info(errors.length === 0 ? 'Seed complete' : 'Seed finished with errors', { errors });
    return { success: errors.length === 0, errors };
  },
};
