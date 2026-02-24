import { supabase } from './supabaseClient';
import { Transaction, AuditEntry, BehaviouralModel, YieldCurvePoint, GeneralRule, ClientEntity, BusinessUnit, ProductDefinition, UserProfile, FtpRateCard } from '../types';
import { MOCK_DEALS, MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_BEHAVIOURAL_MODELS, MOCK_USERS, MOCK_YIELD_CURVE } from '../constants';

// --- MAPPING HELPERS ---

const mapDealToDB = (deal: Transaction) => ({
    id: deal.id || undefined,
    status: deal.status,
    client_id: deal.clientId,
    client_type: deal.clientType,
    business_unit: deal.businessUnit,
    funding_business_unit: deal.fundingBusinessUnit,
    business_line: deal.businessLine,
    product_type: deal.productType,
    currency: deal.currency,
    amount: deal.amount,
    start_date: deal.startDate,
    duration_months: deal.durationMonths,
    amortization: deal.amortization,
    repricing_freq: deal.repricingFreq,
    margin_target: deal.marginTarget,
    behavioural_model_id: deal.behaviouralModelId,
    risk_weight: deal.riskWeight,
    capital_ratio: deal.capitalRatio,
    target_roe: deal.targetROE,
    operational_cost_bps: deal.operationalCostBps,
    lcr_outflow_pct: deal.lcrOutflowPct,
    category: deal.category,

    // LCR/NSFR (New Baseline)
    drawn_amount: deal.drawnAmount,
    undrawn_amount: deal.undrawnAmount,
    is_committed: deal.isCommitted,
    lcr_classification: deal.lcrClassification,
    deposit_type: deal.depositType,
    behavioral_maturity_override: deal.behavioralMaturityOverride,

    transition_risk: deal.transitionRisk,
    physical_risk: deal.physicalRisk,
    liquidity_spread: deal.liquiditySpread,
    _liquidity_premium_details: deal._liquidityPremiumDetails,
    _clc_charge_details: deal._clcChargeDetails,
    updated_at: new Date().toISOString()
});

const mapDealFromDB = (row: any): Transaction => ({
    id: row.id,
    status: row.status,
    clientId: row.client_id,
    clientType: row.client_type,
    businessUnit: row.business_unit,
    fundingBusinessUnit: row.funding_business_unit,
    businessLine: row.business_line,
    productType: row.product_type,
    currency: row.currency,
    amount: row.amount,
    startDate: row.start_date,
    durationMonths: row.duration_months,
    amortization: row.amortization,
    repricingFreq: row.repricing_freq,
    marginTarget: row.margin_target,
    behaviouralModelId: row.behavioural_model_id,
    riskWeight: row.risk_weight,
    capitalRatio: row.capital_ratio,
    targetROE: row.target_roe,
    operationalCostBps: row.operational_cost_bps,
    lcrOutflowPct: row.lcr_outflow_pct,
    category: row.category,

    // LCR/NSFR (New Baseline)
    drawnAmount: row.drawn_amount,
    undrawnAmount: row.undrawn_amount,
    isCommitted: row.is_committed,
    lcrClassification: row.lcr_classification,
    depositType: row.deposit_type,
    behavioralMaturityOverride: row.behavioral_maturity_override,

    transitionRisk: row.transition_risk,
    physicalRisk: row.physical_risk,
    liquiditySpread: row.liquidity_spread,
    _liquidityPremiumDetails: row._liquidity_premium_details,
    _clcChargeDetails: row._clc_charge_details
});

const mapAuditToDB = (entry: any) => ({
    user_email: entry.userEmail,
    user_name: entry.userName,
    action: entry.action,
    module: entry.module,
    description: entry.description,
    details: entry.details,
    timestamp: entry.timestamp || new Date().toISOString()
});

const mapAuditFromDB = (row: any): AuditEntry => ({
    id: String(row.id || `audit-${Math.random()}`),
    timestamp: row.timestamp || new Date().toISOString(),
    userEmail: row.user_email || 'unknown@system.com',
    userName: row.user_name || 'System User',
    action: row.action || 'UNKNOWN_ACTION',
    module: row.module || 'SYSTEM',
    description: row.description || 'No description provided',
    details: row.details || {}
});

const mapModelToDB = (model: BehaviouralModel) => ({
    id: model.id,
    name: model.name,
    type: model.type,
    nmd_method: model.nmdMethod,
    description: model.description,
    core_ratio: model.coreRatio,
    decay_rate: model.decayRate,
    beta_factor: model.betaFactor,
    replication_profile: model.replicationProfile,
    cpr: model.cpr,
    penalty_exempt: model.penaltyExempt
});

const mapModelFromDB = (row: any): BehaviouralModel => ({
    id: row.id,
    name: row.name,
    type: row.type,
    nmdMethod: row.nmd_method,
    description: row.description,
    coreRatio: row.core_ratio,
    decayRate: row.decay_rate,
    betaFactor: row.beta_factor,
    replicationProfile: row.replication_profile,
    cpr: row.cpr,
    penaltyExempt: row.penalty_exempt
});

const mapRuleToDB = (rule: GeneralRule) => ({
    id: rule.id || undefined,
    business_unit: rule.businessUnit,
    product: rule.product,
    segment: rule.segment,
    tenor: rule.tenor,
    base_method: rule.baseMethod,
    base_reference: rule.baseReference,
    spread_method: rule.spreadMethod,
    liquidity_reference: rule.liquidityReference,
    strategic_spread: rule.strategicSpread
});

const mapRuleFromDB = (row: any): GeneralRule => ({
    id: row.id,
    businessUnit: row.business_unit,
    product: row.product,
    segment: row.segment,
    tenor: row.tenor,
    baseMethod: row.base_method,
    baseReference: row.base_reference,
    spreadMethod: row.spread_method,
    liquidityReference: row.liquidity_reference,
    strategicSpread: row.strategic_spread
});

const mapClientToDB = (client: ClientEntity) => ({ ...client }); // Assuming simple mapping for now
const mapClientFromDB = (row: any): ClientEntity => ({ ...row });
const mapBUToDB = (bu: BusinessUnit) => ({ ...bu });
const mapBUFromDB = (row: any): BusinessUnit => ({ ...row });
const mapProductToDB = (p: ProductDefinition) => ({ ...p });
const mapProductFromDB = (row: any): ProductDefinition => ({ ...row });

export const supabaseService = {
    // --- DEALS ---
    async fetchDeals(): Promise<Transaction[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deals:', error);
            return [];
        }
        return (data || []).map(mapDealFromDB);
    },

    async upsertDeal(deal: Transaction) {
        const { data, error } = await supabase
            .from('deals')
            .upsert(mapDealToDB(deal))
            .select();

        if (error) console.error('Error saving deal:', error);
        return data ? mapDealFromDB(data[0]) : null;
    },

    async deleteDeal(id: string) {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);
        if (error) console.error('Error deleting deal:', error);
    },

    // --- SYSTEM CONFIG & MASTER DATA ---
    async fetchRules(): Promise<GeneralRule[]> {
        const { data, error } = await supabase.from('rules').select('*');
        if (error) {
            console.error('Error fetching rules:', error);
            return [];
        }
        return (data || []).map(mapRuleFromDB);
    },

    async saveRule(rule: GeneralRule) {
        const { error } = await supabase.from('rules').upsert(mapRuleToDB(rule));
        if (error) console.error('Error saving rule:', error);
    },

    async deleteRule(id: number) {
        const { error } = await supabase.from('rules').delete().eq('id', id);
        if (error) console.error('Error deleting rule:', error);
    },

    async fetchClients(): Promise<ClientEntity[]> {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) return [];
        return data as ClientEntity[];
    },

    async saveClient(client: ClientEntity) {
        const { error } = await supabase.from('clients').upsert(client);
        if (error) console.error('Error saving client:', error);
    },

    async deleteClient(id: string) {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) console.error('Error deleting client:', error);
    },

    async fetchBusinessUnits(): Promise<BusinessUnit[]> {
        const { data, error } = await supabase.from('business_units').select('*');
        if (error) return [];
        return data as BusinessUnit[];
    },

    async saveBusinessUnit(unit: BusinessUnit) {
        const { error } = await supabase.from('business_units').upsert(unit);
        if (error) console.error('Error saving unit:', error);
    },

    async deleteBusinessUnit(id: string) {
        const { error } = await supabase.from('business_units').delete().eq('id', id);
        if (error) console.error('Error deleting unit:', error);
    },

    async fetchProducts(): Promise<ProductDefinition[]> {
        const { data, error } = await supabase.from('products').select('*');
        if (error) return [];
        return data as ProductDefinition[];
    },

    async saveProduct(product: ProductDefinition) {
        const { error } = await supabase.from('products').upsert(product);
        if (error) console.error('Error saving product:', error);
    },

    async deleteProduct(id: string) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) console.error('Error deleting product:', error);
    },

    // --- USERS & PRESENCE ---
    async fetchUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase.from('users').select('*');
        if (error) return [];
        // Map DB snake_case to CamelCase if necessary, but assuming types match for now
        return data as UserProfile[];
    },

    async upsertUser(user: UserProfile) {
        const { error } = await supabase.from('users').upsert(user);
        if (error) console.error('Error upserting user:', error);
    },

    trackPresence(userId: string, userDetails: any) {
        const room = supabase.channel('online-users');
        return room
            .on('presence', { event: 'sync' }, () => {
                const state = room.presenceState();
                console.log('Online users:', state);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await room.track({
                        id: userId,
                        online_at: new Date().toISOString(),
                        ...userDetails
                    });
                }
            });
    },

    // --- AUDIT LOG ---
    async fetchAuditLog(): Promise<AuditEntry[]> {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error fetching audit log:', error);
            return [];
        }
        console.log(`Fetched ${data?.length || 0} audit entries from Supabase.`);
        return (data || []).map(mapAuditFromDB);
    },

    async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
        const { error } = await supabase
            .from('audit_log')
            .insert(mapAuditToDB(entry));
        if (error) {
            console.error('Error adding audit entry:', error);
            alert(`Error de Supabase (${error.code}): ${error.message}\nVerifique los permisos de la tabla audit_log.`);
        } else {
            console.log('Successfully added audit entry:', entry.action);
        }
    },

    // --- BEHAVIOURAL MODELS ---
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
        if (error) console.error('Error saving model:', error);
        return data ? mapModelFromDB(data[0]) : null;
    },

    async deleteModel(id: string) {
        const { error } = await supabase
            .from('behavioural_models')
            .delete()
            .eq('id', id);
        if (error) console.error('Error deleting model:', error);
    },

    // --- YIELD CURVES ---
    async saveCurveSnapshot(currency: string, date: string, points: YieldCurvePoint[]) {
        const { error } = await supabase
            .from('yield_curves')
            .insert({
                currency,
                as_of_date: date,
                grid_data: points
            });
        if (error) console.error('Error saving curve snapshot:', error);
    },

    async fetchCurveHistory(currency: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('yield_curves')
            .select('*')
            .eq('currency', currency)
            .order('as_of_date', { ascending: false });
        if (error) return [];
        return data;
    },

    async fetchYieldCurves(): Promise<any[]> {
        const { data, error } = await supabase
            .from('yield_curves')
            .select('*')
            .order('as_of_date', { ascending: false });
        if (error) {
            console.error('Error fetching yield curves:', error);
            return [];
        }
        return data || [];
    },

    // --- SYSTEM CONFIG (Shocks, etc.) ---
    async fetchShocks(): Promise<any> {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'shocks')
            .single();
        if (error) return { interestRate: 0, liquiditySpread: 0 };
        return data.value;
    },

    async saveShocks(shocks: any) {
        const { error } = await supabase
            .from('system_config')
            .upsert({ key: 'shocks', value: shocks, updated_at: new Date().toISOString() });
        if (error) console.error('Error saving shocks:', error);
    },

    async fetchRateCards(): Promise<FtpRateCard[]> {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'rate_cards')
            .single();
        if (error) return [];
        return data.value;
    },

    async saveRateCards(cards: FtpRateCard[]) {
        const { error } = await supabase
            .from('system_config')
            .upsert({ key: 'rate_cards', value: cards, updated_at: new Date().toISOString() });
        if (error) console.error('Error saving rate cards:', error);
    },

    async fetchEsgGrid(type: 'transition' | 'physical'): Promise<any[]> {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', `${type}_grid`)
            .single();
        if (error) return [];
        return data.value;
    },

    async saveEsgGrid(type: 'transition' | 'physical', grid: any[]) {
        const { error } = await supabase
            .from('system_config')
            .upsert({ key: `${type}_grid`, value: grid, updated_at: new Date().toISOString() });
        if (error) console.error('Error saving ESG grid:', error);
    },

    // --- RAROC SESSION PERSISTENCE ---
    async fetchRarocInputs(): Promise<any | null> {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'raroc_inputs')
            .single();
        if (error) return null;
        return data.value;
    },

    async saveRarocInputs(inputs: any) {
        const { error } = await supabase
            .from('system_config')
            .upsert({ key: 'raroc_inputs', value: inputs, updated_at: new Date().toISOString() });
        if (error) console.error('Error saving RAROC inputs:', error);
    },

    // --- REALTIME SUBSCRIPTIONS ---
    subscribeToAll(onUpdate: (payload: any) => void) {
        return supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                const isDelete = payload.eventType === 'DELETE';
                const data = isDelete ? payload.old : payload.new;

                if (data) {
                    if (payload.table === 'deals') (data as any).id = (data as any).id || (payload.old as any)?.id; // Ensure ID for deletes

                    // Map the data
                    if (payload.table === 'deals') data.mapped = mapDealFromDB(data);
                    if (payload.table === 'audit_log') data.mapped = mapAuditFromDB(data);
                    if (payload.table === 'behavioural_models') data.mapped = mapModelFromDB(data);
                    if (payload.table === 'rules') data.mapped = mapRuleFromDB(data);
                    if (payload.table === 'clients') data.mapped = mapClientFromDB(data);
                    if (payload.table === 'products') data.mapped = mapProductFromDB(data);
                    if (payload.table === 'business_units') data.mapped = mapBUFromDB(data);
                    if (payload.table === 'yield_curves') {
                        data.mapped = {
                            currency: data.currency,
                            date: data.as_of_date,
                            points: data.grid_data
                        };
                    }
                    if (payload.table === 'system_config' && !isDelete) {
                        data.mapped = (data as any).value;
                        // Special handling for keys to help App.tsx distinguish
                        (data as any).config_key = (data as any).key;
                    }
                    if (payload.table === 'audit_log') {
                        data.mapped = mapAuditFromDB(data);
                    }
                }

                console.log(`Realtime update on ${payload.table}:`, payload.eventType, data?.mapped || data);
                onUpdate({ ...payload, mapped: data?.mapped });
            })
            .subscribe((status) => {
                console.log('Supabase Channel Subscription Status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully connected to Supabase Realtime.');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Error connecting to Supabase Realtime channel.');
                }
            });
    },

    // --- DATABASE SEEDING ---
    async seedDatabase(): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        console.log('🌱 Starting database seed...');

        // 1. Seed Clients
        const { error: clientsErr } = await supabase.from('clients').upsert(MOCK_CLIENTS);
        if (clientsErr) errors.push(`clients: ${clientsErr.message}`);
        else console.log('✅ Clients seeded');

        // 2. Seed Products
        const { error: productsErr } = await supabase.from('products').upsert(MOCK_PRODUCT_DEFS);
        if (productsErr) errors.push(`products: ${productsErr.message}`);
        else console.log('✅ Products seeded');

        // 3. Seed Business Units
        const { error: buErr } = await supabase.from('business_units').upsert(MOCK_BUSINESS_UNITS);
        if (buErr) errors.push(`business_units: ${buErr.message}`);
        else console.log('✅ Business Units seeded');

        // 4. Seed Users
        const { error: usersErr } = await supabase.from('users').upsert(MOCK_USERS);
        if (usersErr) errors.push(`users: ${usersErr.message}`);
        else console.log('✅ Users seeded');

        // 5. Seed Behavioural Models (map camelCase → snake_case)
        const mappedModels = MOCK_BEHAVIOURAL_MODELS.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type,
            nmd_method: m.nmdMethod,
            description: m.description,
            core_ratio: m.coreRatio,
            decay_rate: m.decayRate,
            beta_factor: m.betaFactor,
            replication_profile: m.replicationProfile,
            cpr: m.cpr,
            penalty_exempt: m.penaltyExempt
        }));
        const { error: modelsErr } = await supabase.from('behavioural_models').upsert(mappedModels);
        if (modelsErr) errors.push(`behavioural_models: ${modelsErr.message}`);
        else console.log('✅ Behavioural Models seeded');

        // 6. Seed Deals (map camelCase → snake_case)
        const mappedDeals = MOCK_DEALS.map(d => ({
            id: d.id,
            status: d.status,
            client_id: d.clientId,
            client_type: d.clientType,
            business_unit: d.businessUnit,
            funding_business_unit: d.fundingBusinessUnit,
            business_line: d.businessLine,
            product_type: d.productType,
            currency: d.currency,
            amount: d.amount,
            start_date: d.startDate,
            duration_months: d.durationMonths,
            amortization: d.amortization,
            repricing_freq: d.repricingFreq,
            margin_target: d.marginTarget,
            behavioural_model_id: d.behaviouralModelId,
            risk_weight: d.riskWeight,
            capital_ratio: d.capitalRatio,
            target_roe: d.targetROE,
            operational_cost_bps: d.operationalCostBps,
            lcr_outflow_pct: d.lcrOutflowPct,
            category: d.category,
            transition_risk: d.transitionRisk,
            physical_risk: d.physicalRisk,
            updated_at: new Date().toISOString()
        }));
        const { error: dealsErr } = await supabase.from('deals').upsert(mappedDeals);
        if (dealsErr) errors.push(`deals: ${dealsErr.message}`);
        else console.log('✅ Deals seeded');

        // 7. Seed Default Rules
        const defaultRules = [
            { id: 1, business_unit: 'Commercial Banking', product: 'Commercial Loan', segment: 'Corporate', tenor: '< 1Y', base_method: 'Matched Maturity', base_reference: 'USD-SOFR', spread_method: 'Curve Lookup', liquidity_reference: 'RC-LIQ-USD-STD', strategic_spread: 10 },
            { id: 2, business_unit: 'SME / Business', product: 'Commercial Loan', segment: 'SME', tenor: 'Any', base_method: 'Rate Card', base_reference: 'USD-SOFR', spread_method: 'Grid Pricing', liquidity_reference: 'RC-COM-SME-A', strategic_spread: 25 },
            { id: 3, business_unit: 'Retail Banking', product: 'Term Deposit', segment: 'Retail', tenor: '> 2Y', base_method: 'Moving Average', base_reference: 'EUR-ESTR', spread_method: 'Fixed Spread', liquidity_reference: 'RC-LIQ-EUR-HY', strategic_spread: 0 },
            { id: 4, business_unit: 'Retail Banking', product: 'Mortgage', segment: 'All', tenor: 'Fixed', base_method: 'Matched Maturity', base_reference: 'USD-SOFR', spread_method: 'Curve Lookup', liquidity_reference: 'RC-LIQ-USD-STD', strategic_spread: 5 },
        ];
        const { error: rulesErr } = await supabase.from('rules').upsert(defaultRules);
        if (rulesErr) errors.push(`rules: ${rulesErr.message}`);
        else console.log('✅ Rules seeded');

        // 8. Seed Yield Curve snapshot
        const { error: curveErr } = await supabase.from('yield_curves').insert({
            currency: 'USD',
            as_of_date: new Date().toISOString().split('T')[0],
            grid_data: MOCK_YIELD_CURVE
        });
        if (curveErr) errors.push(`yield_curves: ${curveErr.message}`);
        else console.log('✅ Yield Curve seeded');

        console.log(errors.length === 0 ? '🎉 Seed complete!' : `⚠️ Seed finished with errors: ${errors.join(', ')}`);
        return { success: errors.length === 0, errors };
    }
};
