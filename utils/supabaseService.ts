import { supabase } from './supabaseClient';
import { Transaction, AuditEntry, BehaviouralModel, YieldCurvePoint } from '../types';

// Helper to convert snake_case (DB) to camelCase (TS) and vice-versa if needed
// For simplicity, we designed the DB schema to match the TS interfaces where possible,
// but some adjustments (like as_of_date -> asOfDate) might be handled here.

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
        return data as unknown as Transaction[];
    },

    async upsertDeal(deal: Transaction) {
        const { data, error } = await supabase
            .from('deals')
            .upsert({
                ...deal,
                id: deal.id || undefined, // Let Supabase generate UUID if missing
                updated_at: new Date().toISOString()
            })
            .select();

        if (error) console.error('Error saving deal:', error);
        return data;
    },

    async deleteDeal(id: string) {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);
        if (error) console.error('Error deleting deal:', error);
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
        return data as unknown as AuditEntry[];
    },

    async addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
        const { error } = await supabase
            .from('audit_log')
            .insert({
                ...entry,
                timestamp: new Date().toISOString()
            });
        if (error) console.error('Error adding audit entry:', error);
    },

    // --- BEHAVIOURAL MODELS ---
    async fetchModels(): Promise<BehaviouralModel[]> {
        const { data, error } = await supabase
            .from('behavioural_models')
            .select('*');
        if (error) return [];
        return data as unknown as BehaviouralModel[];
    },

    async saveModel(model: BehaviouralModel) {
        await supabase.from('behavioural_models').upsert(model);
    },

    async deleteModel(id: string) {
        await supabase.from('behavioural_models').delete().eq('id', id);
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

    // --- REALTIME SUBSCRIPTIONS ---
    subscribeToAll(onUpdate: (payload: any) => void) {
        return supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                onUpdate(payload);
            })
            .subscribe();
    }
};
