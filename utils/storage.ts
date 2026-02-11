import { Transaction, YieldCurvePoint, UserProfile, AuditEntry, BehaviouralModel, GeneralRule } from '../types';

const STORAGE_KEYS = {
    DEALS: 'n_pricing_deals',
    CURVES: 'n_pricing_curves',
    USERS: 'n_pricing_users',
    AUDIT_LOG: 'n_pricing_audit_log',
    CONFIG_RULES: 'n_pricing_rules',
    BEHAVIOURAL: 'n_pricing_behavioural',
};

export const storage = {
    // Generic Load/Save
    save: (key: string, data: any) => {
        localStorage.setItem(key, JSON.stringify(data));
    },

    load: <T>(key: string, defaultValue: T): T => {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;
        try {
            return JSON.parse(stored) as T;
        } catch (e) {
            console.error(`Error parsing storage key ${key}:`, e);
            return defaultValue;
        }
    },

    // Specific Helpers
    getDeals: () => storage.load<Transaction[]>(STORAGE_KEYS.DEALS, []),
    saveDeals: (deals: Transaction[]) => storage.save(STORAGE_KEYS.DEALS, deals),

    getCurves: () => storage.load<Record<string, YieldCurvePoint[]>>(STORAGE_KEYS.CURVES, {}),
    saveCurves: (curves: Record<string, YieldCurvePoint[]>) => storage.save(STORAGE_KEYS.CURVES, curves),

    getUsers: () => storage.load<UserProfile[]>(STORAGE_KEYS.USERS, []),
    saveUsers: (users: UserProfile[]) => storage.save(STORAGE_KEYS.USERS, users),

    getAuditLog: () => storage.load<AuditEntry[]>(STORAGE_KEYS.AUDIT_LOG, []),
    saveAuditLog: (log: AuditEntry[]) => storage.save(STORAGE_KEYS.AUDIT_LOG, log),

    addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
        const log = storage.getAuditLog();
        const newEntry: AuditEntry = {
            ...entry,
            id: `LOG-${Date.now()}`,
            timestamp: new Date().toISOString(),
        };
        storage.saveAuditLog([newEntry, ...log].slice(0, 1000)); // Keep last 1000 entries
    }
};
