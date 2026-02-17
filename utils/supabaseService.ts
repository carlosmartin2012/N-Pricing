import { supabase } from './supabaseClient';
import { Transaction, AuditEntry, BehaviouralModel, YieldCurvePoint, GeneralRule, ClientEntity, BusinessUnit, ProductDefinition, UserProfile } from '../types';

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
    transition_risk: deal.transitionRisk,
    physical_risk: deal.physicalRisk,
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
    transitionRisk: row.transition_risk,
    physicalRisk: row.physical_risk
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
    id: row.id,
    timestamp: row.timestamp,
    userEmail: row.user_email,
    userName: row.user_name,
    action: row.action,
    module: row.module,
    description: row.description,
    details: row.details
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
        if (error) return [];
        return data as GeneralRule[];
    },

    async saveRule(rule: GeneralRule) {
        const { error } = await supabase.from('rules').upsert(rule);
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
        return (data || []).map(mapAuditFromDB);
    },

    async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
        const { error } = await supabase
            .from('audit_log')
            .insert(mapAuditToDB(entry));
        if (error) console.error('Error adding audit entry:', error);
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

    // --- REALTIME SUBSCRIPTIONS ---
    subscribeToAll(onUpdate: (payload: any) => void) {
        return supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                // Map the payload data if it exists
                if (payload.new) {
                    if (payload.table === 'deals') payload.new = mapDealFromDB(payload.new);
                    if (payload.table === 'audit_log') payload.new = mapAuditFromDB(payload.new);
                    if (payload.table === 'behavioural_models') payload.new = mapModelFromDB(payload.new);
                    if (payload.table === 'system_config' && payload.new) {
                        payload.new = (payload.new as any).value;
                    }
                }
                onUpdate(payload);
            })
            .subscribe();
    }
};
