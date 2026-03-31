import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { storage } from '../utils/storage';
import { supabaseService } from '../utils/supabaseService';

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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storage.loadCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!storage.loadCurrentUser());
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(() => {
    const stored = storage.loadLocal<number | null>('n_pricing_session_expires', null);
    if (stored && stored > Date.now()) return stored;
    return null;
  });
  const lastActivity = useRef(Date.now());

  // Track user activity to extend session
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

  // Session timeout checker
  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return;
    const interval = setInterval(() => {
      if (Date.now() > sessionExpiresAt) {
        handleLogout();
      }
    }, ACTIVITY_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated, sessionExpiresAt]);

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
    setCurrentUser(loggedUser);
    setIsAuthenticated(true);
    setSessionExpiresAt(expiresAt);
    storage.saveCurrentUser(loggedUser);
    storage.saveLocal('n_pricing_session_expires', expiresAt);
    await supabaseService.upsertUser(loggedUser);

    storage.addAuditEntry({
      userEmail: email,
      userName: loggedUser.name,
      action: 'LOGIN',
      module: 'CALCULATOR',
      description: `User ${loggedUser.name} logged into the system.`,
    });
  }, []);

  const handleLogout = useCallback(() => {
    if (currentUser) {
      storage.addAuditEntry({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: 'LOGOUT',
        module: 'CALCULATOR',
        description: `User ${currentUser.name} logged out.`,
      });
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setSessionExpiresAt(null);
    storage.saveCurrentUser(null);
    storage.saveLocal('n_pricing_session_expires', null);
  }, [currentUser]);

  // Role check utility
  const hasRole = useCallback((requiredRoles: string[]) => {
    if (!currentUser) return false;
    return requiredRoles.includes(currentUser.role);
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, handleLogin, handleLogout, hasRole, sessionExpiresAt }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
