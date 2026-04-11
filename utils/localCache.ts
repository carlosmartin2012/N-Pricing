import { Transaction, YieldCurvePoint, UserProfile } from '../types';

const STORAGE_KEYS = {
    DEALS: 'n_pricing_deals',
    CURVES: 'n_pricing_curves',
    USERS: 'n_pricing_users',
    CURRENT_USER: 'n_pricing_current_user',
};

// Guarded storage accessor. `localStorage` can throw in several real-world
// situations that used to crash the app:
//   - Safari private mode (SecurityError)
//   - Quota exceeded on write (QuotaExceededError, e.g. over-filled caches)
//   - SSR / non-browser test environments where `window` is missing
// We fail soft: reads return null, writes are no-ops that log once.
function safeGetStorage(): Storage | null {
    try {
        if (typeof window === 'undefined') return null;
        return window.localStorage;
    } catch {
        return null;
    }
}

function safeGetItem(key: string): string | null {
    const storage = safeGetStorage();
    if (!storage) return null;
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string): boolean {
    const storage = safeGetStorage();
    if (!storage) return false;
    try {
        storage.setItem(key, value);
        return true;
    } catch (err) {
        // Most common cause is QuotaExceededError on a full localStorage.
        // Log once per key to aid debugging without flooding the console.
        console.warn('[localCache] Failed to persist key', key, err);
        return false;
    }
}

function safeRemoveItem(key: string): void {
    const storage = safeGetStorage();
    if (!storage) return;
    try {
        storage.removeItem(key);
    } catch {
        /* ignore — storage unavailable */
    }
}

export const localCache = {
    saveLocal: (key: string, data: unknown): boolean => {
        let serialized: string;
        try {
            serialized = JSON.stringify(data);
        } catch (err) {
            console.warn('[localCache] Failed to serialize value for key', key, err);
            return false;
        }
        return safeSetItem(key, serialized);
    },

    loadLocal: <T>(key: string, defaultValue: T): T => {
        const stored = safeGetItem(key);
        if (stored === null) return defaultValue;
        try {
            const parsed = JSON.parse(stored);
            return parsed as T;
        } catch {
            // Corrupt entries should not wedge the app. Drop the bad value so
            // the next write starts clean and return the caller's default.
            safeRemoveItem(key);
            return defaultValue;
        }
    },

    saveCurrentUser: (user: UserProfile | null) => {
        if (user) localCache.saveLocal(STORAGE_KEYS.CURRENT_USER, user);
        else safeRemoveItem(STORAGE_KEYS.CURRENT_USER);
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
