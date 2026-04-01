import { supabase } from './supabaseClient';
import { Transaction, AuditEntry, BehaviouralModel, YieldCurvePoint, GeneralRule, RuleVersion, ClientEntity, BusinessUnit, ProductDefinition, UserProfile, FtpRateCard, FTPResult, DealComment, Notification } from '../types';
import { MOCK_DEALS, MOCK_CLIENTS, MOCK_PRODUCT_DEFS, MOCK_BUSINESS_UNITS, MOCK_BEHAVIOURAL_MODELS, MOCK_USERS, MOCK_YIELD_CURVE } from '../constants';
import { createLogger } from './logger';

const log = createLogger('supabase');

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

const mapRuleVersionFromDB = (row: any): RuleVersion => ({
    id: row.id,
    ruleId: row.rule_id,
    version: row.version,
    businessUnit: row.business_unit,
    product: row.product,
    segment: row.segment,
    tenor: row.tenor,
    baseMethod: row.base_method,
    baseReference: row.base_reference,
    spreadMethod: row.spread_method,
    liquidityReference: row.liquidity_reference,
    strategicSpread: row.strategic_spread,
    formulaSpec: row.formula_spec,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    changedBy: row.changed_by,
    changeReason: row.change_reason,
    createdAt: row.created_at,
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
            log.error('Error fetching deals', { code: error.code }, error);
            return [];
        }
        return (data || []).map(mapDealFromDB);
    },

    async upsertDeal(deal: Transaction) {
        const { data, error } = await supabase
            .from('deals')
            .upsert(mapDealToDB(deal))
            .select();

        if (error) log.error('Error saving deal', { code: error.code });
        return data ? mapDealFromDB(data[0]) : null;
    },

    async deleteDeal(id: string) {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);
        if (error) log.error('Error deleting deal', { code: error.code });
    },

    // --- SYSTEM CONFIG & MASTER DATA ---
    async fetchRules(): Promise<GeneralRule[]> {
        const { data, error } = await supabase.from('rules').select('*');
        if (error) {
            log.error('Error fetching rules', { code: error.code });
            return [];
        }
        return (data || []).map(mapRuleFromDB);
    },

    async saveRule(rule: GeneralRule) {
        const { error } = await supabase.from('rules').upsert(mapRuleToDB(rule));
        if (error) log.error('Error saving rule', { code: error.code });
    },

    async deleteRule(id: number) {
        const { error } = await supabase.from('rules').delete().eq('id', id);
        if (error) log.error('Error deleting rule', { code: error.code });
    },

    // --- RULE VERSIONING ---
    async fetchRuleVersions(ruleId: number): Promise<RuleVersion[]> {
        const { data, error } = await supabase
            .from('rule_versions')
            .select('*')
            .eq('rule_id', ruleId)
            .order('version', { ascending: false });

        if (error) {
            log.error('Error fetching rule versions', { code: error.code });
            return [];
        }
        return (data || []).map(mapRuleVersionFromDB);
    },

    async createRuleVersion(
        ruleId: number,
        ruleData: Partial<GeneralRule>,
        changedBy: string,
        changeReason: string,
    ): Promise<void> {
        try {
            // 1. Get current max version for this rule_id
            const { data: existing } = await supabase
                .from('rule_versions')
                .select('version')
                .eq('rule_id', ruleId)
                .order('version', { ascending: false })
                .limit(1);

            const currentMaxVersion = existing && existing.length > 0 ? existing[0].version : 0;
            const newVersion = currentMaxVersion + 1;
            const today = new Date().toISOString().split('T')[0];

            // 2. Set effective_to = today on the current active version
            if (currentMaxVersion > 0) {
                const { error: updateError } = await supabase
                    .from('rule_versions')
                    .update({ effective_to: today })
                    .eq('rule_id', ruleId)
                    .eq('version', currentMaxVersion);

                if (updateError) log.error('Error closing previous rule version', { code: updateError.code });
            }

            // 3. Insert new version with version = max + 1, effective_from = today
            const { error: insertError } = await supabase
                .from('rule_versions')
                .insert({
                    rule_id: ruleId,
                    version: newVersion,
                    business_unit: ruleData.businessUnit,
                    product: ruleData.product,
                    segment: ruleData.segment,
                    tenor: ruleData.tenor,
                    base_method: ruleData.baseMethod,
                    base_reference: ruleData.baseReference,
                    spread_method: ruleData.spreadMethod,
                    liquidity_reference: ruleData.liquidityReference,
                    strategic_spread: ruleData.strategicSpread ?? 0,
                    formula_spec: ruleData.formulaSpec ?? null,
                    effective_from: today,
                    effective_to: null,
                    changed_by: changedBy,
                    change_reason: changeReason,
                });

            if (insertError) log.error('Error creating rule version', { code: insertError.code });
        } catch (e) {
            log.warn('createRuleVersion failed', { error: String(e) });
        }
    },

    async fetchClients(): Promise<ClientEntity[]> {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) return [];
        return data as ClientEntity[];
    },

    async saveClient(client: ClientEntity) {
        const { error } = await supabase.from('clients').upsert(client);
        if (error) log.error('Error saving client', { code: error.code });
    },

    async deleteClient(id: string) {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) log.error('Error deleting client', { code: error.code });
    },

    async fetchBusinessUnits(): Promise<BusinessUnit[]> {
        const { data, error } = await supabase.from('business_units').select('*');
        if (error) return [];
        return data as BusinessUnit[];
    },

    async saveBusinessUnit(unit: BusinessUnit) {
        const { error } = await supabase.from('business_units').upsert(unit);
        if (error) log.error('Error saving unit', { code: error.code });
    },

    async deleteBusinessUnit(id: string) {
        const { error } = await supabase.from('business_units').delete().eq('id', id);
        if (error) log.error('Error deleting unit', { code: error.code });
    },

    async fetchProducts(): Promise<ProductDefinition[]> {
        const { data, error } = await supabase.from('products').select('*');
        if (error) return [];
        return data as ProductDefinition[];
    },

    async saveProduct(product: ProductDefinition) {
        const { error } = await supabase.from('products').upsert(product);
        if (error) log.error('Error saving product', { code: error.code });
    },

    async deleteProduct(id: string) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) log.error('Error deleting product', { code: error.code });
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
        if (error) log.error('Error upserting user', { code: error.code });
    },

    trackPresence(userId: string, userDetails: any) {
        const room = supabase.channel('online-users');
        return room
            .on('presence', { event: 'sync' }, () => {
                const state = room.presenceState();
                log.debug('Online users updated', { userCount: Object.keys(state).length });
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
            log.error('Error fetching audit log', { code: error.code });
            return [];
        }
        log.info('Fetched audit entries', { count: data?.length || 0 });
        return (data || []).map(mapAuditFromDB);
    },

    async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
        const { error } = await supabase
            .from('audit_log')
            .insert(mapAuditToDB(entry));
        if (error) {
            log.error('Error adding audit entry', { code: error.code, message: error.message });
            alert(`Error de Supabase (${error.code}): ${error.message}\nVerifique los permisos de la tabla audit_log.`);
        } else {
            log.info('Successfully added audit entry', { action: entry.action });
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

    // --- YIELD CURVES ---
    async saveCurveSnapshot(currency: string, date: string, points: YieldCurvePoint[]) {
        const { error } = await supabase
            .from('yield_curves')
            .insert({
                currency,
                as_of_date: date,
                grid_data: points
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
        return data;
    },

    // --- YIELD CURVE HISTORY (for Moving Average FTP) ---
    async fetchCurveHistoryByIdAndMonths(curveId: string, months: number = 12): Promise<{ date: string; points: YieldCurvePoint[] }[]> {
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

    async saveCurveHistorySnapshot(curveId: string, currency: string, date: string, points: YieldCurvePoint[]): Promise<void> {
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

    // --- LIQUIDITY CURVES ---
    async fetchLiquidityCurves(): Promise<any[]> {
        try {
            const { data } = await supabase
                .from('liquidity_curves')
                .select('*')
                .order('created_at', { ascending: false });
            return (data || []).map((c: any) => ({
                currency: c.currency,
                curveType: c.curve_type,
                lastUpdate: c.last_update,
                points: c.points || [],
            }));
        } catch (e) {
            log.warn('fetchLiquidityCurves failed', { error: String(e) });
            return [];
        }
    },

    async saveLiquidityCurves(curves: any[]): Promise<void> {
        try {
            await supabase.from('system_config').upsert({
                key: 'liquidity_curves',
                value: curves,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            log.warn('saveLiquidityCurves failed', { error: String(e) });
        }
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
        if (error) log.error('Error saving shocks', { code: error.code });
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
        if (error) log.error('Error saving rate cards', { code: error.code });
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
        if (error) log.error('Error saving ESG grid', { code: error.code, type });
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
        if (error) log.error('Error saving RAROC inputs', { code: error.code });
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

                log.debug(`Realtime update on ${payload.table}`, { eventType: payload.eventType });
                onUpdate({ ...payload, mapped: data?.mapped });
            })
            .subscribe((status) => {
                log.info('Supabase Channel Subscription Status', { status });
                if (status === 'SUBSCRIBED') {
                    log.info('Successfully connected to Supabase Realtime');
                } else if (status === 'CHANNEL_ERROR') {
                    log.error('Error connecting to Supabase Realtime channel');
                }
            });
    },

    // --- DATABASE SEEDING ---
    async seedDatabase(): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        log.info('Starting database seed');

        // 1. Seed Clients
        const { error: clientsErr } = await supabase.from('clients').upsert(MOCK_CLIENTS);
        if (clientsErr) errors.push(`clients: ${clientsErr.message}`);
        else log.info('Clients seeded');

        // 2. Seed Products
        const { error: productsErr } = await supabase.from('products').upsert(MOCK_PRODUCT_DEFS);
        if (productsErr) errors.push(`products: ${productsErr.message}`);
        else log.info('Products seeded');

        // 3. Seed Business Units
        const { error: buErr } = await supabase.from('business_units').upsert(MOCK_BUSINESS_UNITS);
        if (buErr) errors.push(`business_units: ${buErr.message}`);
        else log.info('Business Units seeded');

        // 4. Seed Users
        const { error: usersErr } = await supabase.from('users').upsert(MOCK_USERS);
        if (usersErr) errors.push(`users: ${usersErr.message}`);
        else log.info('Users seeded');

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
        else log.info('Behavioural Models seeded');

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
        else log.info('Deals seeded');

        // 7. Seed Default Rules
        const defaultRules = [
            { id: 1, business_unit: 'Commercial Banking', product: 'Commercial Loan', segment: 'Corporate', tenor: '< 1Y', base_method: 'Matched Maturity', base_reference: 'USD-SOFR', spread_method: 'Curve Lookup', liquidity_reference: 'RC-LIQ-USD-STD', strategic_spread: 10 },
            { id: 2, business_unit: 'SME / Business', product: 'Commercial Loan', segment: 'SME', tenor: 'Any', base_method: 'Rate Card', base_reference: 'USD-SOFR', spread_method: 'Grid Pricing', liquidity_reference: 'RC-COM-SME-A', strategic_spread: 25 },
            { id: 3, business_unit: 'Retail Banking', product: 'Term Deposit', segment: 'Retail', tenor: '> 2Y', base_method: 'Moving Average', base_reference: 'EUR-ESTR', spread_method: 'Fixed Spread', liquidity_reference: 'RC-LIQ-EUR-HY', strategic_spread: 0 },
            { id: 4, business_unit: 'Retail Banking', product: 'Mortgage', segment: 'All', tenor: 'Fixed', base_method: 'Matched Maturity', base_reference: 'USD-SOFR', spread_method: 'Curve Lookup', liquidity_reference: 'RC-LIQ-USD-STD', strategic_spread: 5 },
        ];
        const { error: rulesErr } = await supabase.from('rules').upsert(defaultRules);
        if (rulesErr) errors.push(`rules: ${rulesErr.message}`);
        else log.info('Rules seeded');

        // 8. Seed Yield Curve snapshot
        const { error: curveErr } = await supabase.from('yield_curves').insert({
            currency: 'USD',
            as_of_date: new Date().toISOString().split('T')[0],
            grid_data: MOCK_YIELD_CURVE
        });
        if (curveErr) errors.push(`yield_curves: ${curveErr.message}`);
        else log.info('Yield Curve seeded');

        log.info(errors.length === 0 ? 'Seed complete' : 'Seed finished with errors', { errors });
        return { success: errors.length === 0, errors };
    },

    // --- DEAL VERSIONING ---
    async createDealVersion(dealId: string, version: number, snapshot: Transaction, pricingResult: FTPResult | null, changedBy: string, reason?: string) {
        const { error } = await supabase
            .from('deal_versions')
            .insert({
                deal_id: dealId,
                version,
                snapshot: JSON.parse(JSON.stringify(snapshot)),
                pricing_result: pricingResult ? JSON.parse(JSON.stringify(pricingResult)) : null,
                changed_by: changedBy,
                change_reason: reason || null,
            });
        if (error) log.error('Error creating deal version', { code: error.code });
    },

    async fetchDealVersions(dealId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('deal_versions')
            .select('*')
            .eq('deal_id', dealId)
            .order('version', { ascending: false });
        if (error) {
            log.error('Error fetching deal versions', { code: error.code });
            return [];
        }
        return data || [];
    },

    // --- DEAL WORKFLOW ---
    async transitionDeal(dealId: string, newStatus: string, userEmail: string, pricingSnapshot?: FTPResult) {
        const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        if (newStatus === 'Approved') {
            updateData.approved_by = userEmail;
            updateData.approved_at = new Date().toISOString();
        }

        if (newStatus === 'Pending_Approval' && pricingSnapshot) {
            updateData.pricing_snapshot = JSON.parse(JSON.stringify(pricingSnapshot));
            updateData.locked_at = new Date().toISOString();
            updateData.locked_by = userEmail;
        }

        if (newStatus === 'Booked') {
            updateData.locked_at = new Date().toISOString();
            updateData.locked_by = userEmail;
        }

        if (newStatus === 'Draft' || newStatus === 'Rejected') {
            updateData.locked_at = null;
            updateData.locked_by = null;
            updateData.approved_by = null;
            updateData.approved_at = null;
        }

        const { data, error } = await supabase
            .from('deals')
            .update(updateData)
            .eq('id', dealId)
            .select();

        if (error) {
            log.error('Error transitioning deal', { code: error.code });
            return null;
        }
        return data ? mapDealFromDB(data[0]) : null;
    },

    // --- PAGINATED QUERIES ---
    async fetchDealsPaginated(page: number = 1, pageSize: number = 50): Promise<{ data: Transaction[]; total: number }> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from('deals')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            log.error('Error fetching paginated deals', { code: error.code });
            return { data: [], total: 0 };
        }
        return {
            data: (data || []).map(mapDealFromDB),
            total: count || 0,
        };
    },

    async fetchAuditLogPaginated(page: number = 1, pageSize: number = 100): Promise<{ data: AuditEntry[]; total: number }> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from('audit_log')
            .select('*', { count: 'exact' })
            .order('timestamp', { ascending: false })
            .range(from, to);

        if (error) {
            log.error('Error fetching paginated audit log', { code: error.code });
            return { data: [], total: 0 };
        }
        return {
            data: (data || []).map(mapAuditFromDB),
            total: count || 0,
        };
    },

    // --- PRICING RESULTS ---
    async savePricingResult(dealId: string, result: any, dealSnapshot: any, calculatedBy: string): Promise<void> {
        try {
            // Get current version count
            const { count } = await supabase
                .from('pricing_results')
                .select('*', { count: 'exact', head: true })
                .eq('deal_id', dealId);

            await supabase.from('pricing_results').insert({
                deal_id: dealId,
                version: (count || 0) + 1,
                base_rate: result.baseRate,
                liquidity_spread: result.liquiditySpread,
                strategic_spread: result.strategicSpread,
                option_cost: result.optionCost,
                regulatory_cost: result.regulatoryCost,
                lcr_cost: result.lcrCost || 0,
                nsfr_cost: result.nsfrCost || 0,
                operational_cost: result.operationalCost,
                capital_charge: result.capitalCharge,
                esg_transition_charge: result.esgTransitionCharge,
                esg_physical_charge: result.esgPhysicalCharge,
                floor_price: result.floorPrice,
                technical_price: result.technicalPrice,
                target_price: result.targetPrice,
                total_ftp: result.totalFTP,
                final_client_rate: result.finalClientRate,
                raroc: result.raroc,
                economic_profit: result.economicProfit,
                approval_level: result.approvalLevel,
                matched_methodology: result.matchedMethodology,
                match_reason: result.matchReason,
                formula_used: result.formulaUsed || null,
                behavioral_maturity_used: result.behavioralMaturityUsed || null,
                incentivisation_adj: result.incentivisationAdj || null,
                capital_income: result.capitalIncome || null,
                calculated_by: calculatedBy,
                deal_snapshot: dealSnapshot
            });
        } catch (e) {
            log.warn('savePricingResult failed', { error: String(e) });
        }
    },

    async fetchPricingHistory(dealId: string): Promise<any[]> {
        try {
            const { data } = await supabase
                .from('pricing_results')
                .select('*')
                .eq('deal_id', dealId)
                .order('version', { ascending: false });
            return data || [];
        } catch (e) {
            log.warn('fetchPricingHistory failed', { error: String(e) });
            return [];
        }
    },

    // --- APPROVAL MATRIX ---
    async saveApprovalMatrix(config: any): Promise<void> {
        try {
            await supabase.from('system_config').upsert({
                key: 'approval_matrix',
                value: config,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            log.warn('saveApprovalMatrix failed', { error: String(e) });
        }
    },

    async fetchApprovalMatrix(): Promise<any | null> {
        try {
            const { data } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'approval_matrix')
                .single();
            return data?.value || null;
        } catch (e) {
            return null;
        }
    },

    // --- INCENTIVISATION RULES ---
    async saveIncentivisationRules(rules: any[]): Promise<void> {
        try {
            await supabase.from('system_config').upsert({
                key: 'incentivisation_rules',
                value: rules,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            log.warn('saveIncentivisationRules failed', { error: String(e) });
        }
    },

    async fetchIncentivisationRules(): Promise<any[]> {
        try {
            const { data } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'incentivisation_rules')
                .single();
            return (data?.value as any[]) || [];
        } catch (e) {
            return [];
        }
    },

    // --- ALM CONFIGS (SDR / LR) ---
    async saveSdrConfig(config: any): Promise<void> {
        try {
            await supabase.from('system_config').upsert({
                key: 'sdr_config',
                value: config,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            log.warn('saveSdrConfig failed', { error: String(e) });
        }
    },

    async fetchSdrConfig(): Promise<any | null> {
        try {
            const { data } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'sdr_config')
                .single();
            return data?.value || null;
        } catch (e) {
            return null;
        }
    },

    async saveLrConfig(config: any): Promise<void> {
        try {
            await supabase.from('system_config').upsert({
                key: 'lr_config',
                value: config,
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            log.warn('saveLrConfig failed', { error: String(e) });
        }
    },

    async fetchLrConfig(): Promise<any | null> {
        try {
            const { data } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'lr_config')
                .single();
            return data?.value || null;
        } catch (e) {
            return null;
        }
    },

    // --- DEAL COMMENTS ---
    async fetchDealComments(dealId: string): Promise<DealComment[]> {
        const { data, error } = await supabase
            .from('deal_comments')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false });
        if (error) {
            log.error('Error fetching deal comments', { code: error.code });
            return [];
        }
        return (data || []).map((row: any): DealComment => ({
            id: row.id,
            dealId: row.deal_id,
            userEmail: row.user_email,
            userName: row.user_name,
            action: row.action,
            comment: row.comment,
            createdAt: row.created_at,
        }));
    },

    async addDealComment(dealId: string, userEmail: string, userName: string, action: string, comment: string): Promise<void> {
        const { error } = await supabase
            .from('deal_comments')
            .insert({
                deal_id: dealId,
                user_email: userEmail,
                user_name: userName,
                action,
                comment,
            });
        if (error) log.error('Error adding deal comment', { code: error.code });
    },

    // --- NOTIFICATIONS ---
    async fetchNotifications(email: string): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_email', email)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            log.error('Error fetching notifications', { code: error.code });
            return [];
        }
        return (data || []).map((row: any): Notification => ({
            id: row.id,
            recipientEmail: row.recipient_email,
            senderEmail: row.sender_email,
            type: row.type,
            title: row.title,
            message: row.message,
            dealId: row.deal_id,
            isRead: row.is_read,
            createdAt: row.created_at,
        }));
    },

    async markNotificationRead(id: number): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
        if (error) log.error('Error marking notification read', { code: error.code });
    },

    async createNotification(recipient: string, sender: string, type: string, title: string, message: string, dealId?: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .insert({
                recipient_email: recipient,
                sender_email: sender,
                type,
                title,
                message,
                deal_id: dealId || null,
            });
        if (error) log.error('Error creating notification', { code: error.code });
    },

    async getUnreadCount(email: string): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_email', email)
            .eq('is_read', false);
        if (error) {
            log.error('Error getting unread count', { code: error.code });
            return 0;
        }
        return count || 0;
    },
};
