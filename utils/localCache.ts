import { Transaction, YieldCurvePoint, UserProfile } from '../types';

const STORAGE_KEYS = {
    DEALS: 'n_pricing_deals',
    CURVES: 'n_pricing_curves',
    USERS: 'n_pricing_users',
    CURRENT_USER: 'n_pricing_current_user',
};

export const localCache = {
    saveLocal: (key: string, data: any) => {
        localStorage.setItem(key, JSON.stringify(data));
    },

    loadLocal: <T>(key: string, defaultValue: T): T => {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;
        try {
            return JSON.parse(stored) as T;
        } catch {
            return defaultValue;
        }
    },

    saveCurrentUser: (user: UserProfile | null) => {
        if (user) localCache.saveLocal(STORAGE_KEYS.CURRENT_USER, user);
        else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    },

    loadCurrentUser: (): UserProfile | null => {
        return localCache.loadLocal<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
    },

    getCurves: (): Record<string, YieldCurvePoint[]> => {
        return localCache.loadLocal(STORAGE_KEYS.CURVES, {});
    },

    saveCurves: (curves: Record<string, YieldCurvePoint[]>) => {
        localCache.saveLocal(STORAGE_KEYS.CURVES, curves);
    },

    getDealsLocal: () => localCache.loadLocal<Transaction[]>(STORAGE_KEYS.DEALS, []),
    getUsersLocal: () => localCache.loadLocal<UserProfile[]>(STORAGE_KEYS.USERS, []),
};
