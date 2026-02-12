import { Transaction, YieldCurvePoint, UserProfile, AuditEntry, BehaviouralModel, GeneralRule } from '../types';
import { supabaseService } from './supabaseService';

const STORAGE_KEYS = {
    DEALS: 'n_pricing_deals',
    CURVES: 'n_pricing_curves',
    USERS: 'n_pricing_users',
    AUDIT_LOG: 'n_pricing_audit_log',
    CONFIG_RULES: 'n_pricing_rules',
    BEHAVIOURAL: 'n_pricing_behavioural',
};

export const storage = {
    // Legacy Local Storage Fallback
    saveLocal: (key: string, data: any) => {
        localStorage.setItem(key, JSON.stringify(data));
    },

    loadLocal: <T>(key: string, defaultValue: T): T => {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;
        try {
            return JSON.parse(stored) as T;
        } catch (e) {
            return defaultValue;
        }
    },

    // --- NEW SUPABASE ASYNC API ---
    // These track remote state but we keep the naming similar for easier refactoring

    getDeals: async () => await supabaseService.fetchDeals(),
    saveDeal: async (deal: Transaction) => await supabaseService.upsertDeal(deal),
    deleteDeal: async (id: string) => await supabaseService.deleteDeal(id),

    getAuditLog: async () => await supabaseService.fetchAuditLog(),
    addAuditEntry: async (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
        await supabaseService.addAuditEntry(entry);
    },

    getBehaviouralModels: async () => await supabaseService.fetchModels(),
    saveBehaviouralModel: async (model: BehaviouralModel) => await supabaseService.saveModel(model),
    deleteBehaviouralModel: async (id: string) => await supabaseService.deleteModel(id),

    saveCurveSnapshot: async (currency: string, date: string, points: YieldCurvePoint[]) => {
        await supabaseService.saveCurveSnapshot(currency, date, points);
    },

    // Compatibility Getters (Synchronous for initial state initialization in App.tsx)
    // We'll hydrate these from Supabase in a useEffect
    getDealsLocal: () => storage.loadLocal<Transaction[]>(STORAGE_KEYS.DEALS, []),
    getUsersLocal: () => storage.loadLocal<UserProfile[]>(STORAGE_KEYS.USERS, []),
};
