import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { UserProfile } from '../types';
import { logAudit } from '../api/audit';
import { upsertUser } from '../api/config';
import { localCache } from '../utils/localCache';
import { errorTracker } from '../utils/errorTracking';

interface GoogleAccountsIdApi {
  cancel: () => void;
  disableAutoSelect: () => void;
}

interface WindowWithGoogle {
  google?: {
    accounts?: {
      id?: GoogleAccountsIdApi;
    };
  };
}

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // check every minute

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  handleLogin: (email: string, users: UserProfile[]) => Promise<void>;
  handleLogout: () => void;
  hasRole: (requiredRoles: string[]) => boolean;
  sessionExpiresAt: number | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => localCache.loadCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!localCache.loadCurrentUser());
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(() => {
    const stored = localCache.loadLocal<number | null>('n_pricing_session_expires', null);
    if (stored && stored > Date.now()) return stored;
    return null;
  });
  const lastActivity = useRef(Date.now());

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setSessionExpiresAt(null);
    localCache.saveCurrentUser(null);
    localCache.saveLocal('n_pricing_session_expires', null);
    localStorage.removeItem('n_pricing_auth_token');
  }, []);

  const logAuthEvent = useCallback((user: UserProfile, action: string, description: string) => {
    void logAudit({
      userEmail: user.email,
      userName: user.name,
      action,
      module: 'AUTH',
      description,
    });
  }, []);

  // Restore error tracker user context from cached session
  useEffect(() => {
    if (currentUser) {
      errorTracker.setUser({
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one-time hydration from cache

  // Track user activity to extend session. The previous version wired up the
  // listeners but never consumed `lastActivity`, so sessions always expired at
  // the SESSION_TIMEOUT_MS wall-clock even if the user was still clicking —
  // see the interval below which now reads the ref to slide the expiry.
  useEffect(() => {
    if (!isAuthenticated) return;
    const updateActivity = () => { lastActivity.current = Date.now(); };
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, [isAuthenticated]);

  const handleLogin = useCallback(async (email: string, users: UserProfile[]) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const now = new Date().toISOString();
    let loggedUser: UserProfile;

    if (user) {
      // Check if user is locked
      if (user.status === 'Locked') {
        throw new Error('Account is locked. Contact administrator.');
      }
      loggedUser = { ...user, lastLogin: now, status: 'Active' };
    } else {
      loggedUser = {
        id: `USR-${crypto.randomUUID().slice(0, 8)}`,
        name: email.split('@')[0].replace('.', ' '),
        email,
        role: 'Trader',
        status: 'Active',
        lastLogin: now,
        department: 'General',
      };
    }

    const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    // Reset the activity marker so the idle-timeout checker starts fresh for
    // this session. Without this, a login-after-logout inside the same tab
    // would inherit stale activity from the previous session.
    lastActivity.current = Date.now();
    setCurrentUser(loggedUser);
    setIsAuthenticated(true);
    setSessionExpiresAt(expiresAt);
    localCache.saveCurrentUser(loggedUser);
    localCache.saveLocal('n_pricing_session_expires', expiresAt);
    await upsertUser(loggedUser);

    logAuthEvent(loggedUser, 'LOGIN', `User ${loggedUser.name} logged into the system.`);

    // Clean up Google Identity Services to prevent COOP polling and overlay injection
    try {
      const goog = (window as Window & WindowWithGoogle).google;
      if (goog?.accounts?.id) {
        goog.accounts.id.cancel();
        goog.accounts.id.disableAutoSelect();
      }
      // Remove any Google-injected One Tap iframe/overlay
      document.getElementById('credential_picker_container')?.remove();
      document.getElementById('credential_picker_iframe')?.remove();
      // Remove the GIS script tag to stop all background polling
      document.querySelectorAll('script[src*="accounts.google.com/gsi"]').forEach(s => s.remove());
    } catch { /* ignore cleanup errors */ }

    // Wire user context into error tracker
    errorTracker.setUser({
      id: loggedUser.id,
      email: loggedUser.email,
      role: loggedUser.role,
    });
  }, [logAuthEvent]);

  const handleLogout = useCallback(() => {
    if (currentUser) {
      logAuthEvent(currentUser, 'LOGOUT', `User ${currentUser.name} logged out.`);
    }
    clearSession();
  }, [clearSession, currentUser, logAuthEvent]);

  // Session timeout checker. Expires the session when the idle window
  // (SESSION_TIMEOUT_MS) has elapsed since the last recorded user activity.
  // Previously this read the initial `sessionExpiresAt` and never consulted
  // `lastActivity`, so sessions died exactly 8 hours after login regardless
  // of whether the user was still working.
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (idleFor >= SESSION_TIMEOUT_MS) {
        logAuthEvent(
          currentUser,
          'SESSION_TIMEOUT',
          `User ${currentUser.name} session expired after inactivity window.`,
        );
        clearSession();
        return;
      }
      // Slide the "session expires at" marker forward so any UI showing
      // remaining time reflects the actual idle window.
      const nextExpiry = lastActivity.current + SESSION_TIMEOUT_MS;
      setSessionExpiresAt((prev) => (prev === nextExpiry ? prev : nextExpiry));
    }, ACTIVITY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [clearSession, currentUser, isAuthenticated, logAuthEvent]);

  // Role check utility
  const hasRole = useCallback((requiredRoles: string[]) => {
    if (!currentUser) return false;
    return requiredRoles.includes(currentUser.role);
  }, [currentUser]);

  const value = useMemo(
    () => ({ currentUser, isAuthenticated, handleLogin, handleLogout, hasRole, sessionExpiresAt }),
    [currentUser, isAuthenticated, handleLogin, handleLogout, hasRole, sessionExpiresAt]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
