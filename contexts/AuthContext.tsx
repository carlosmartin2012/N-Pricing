import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { storage } from '../utils/storage';
import { supabaseService } from '../utils/supabaseService';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  handleLogin: (email: string, users: UserProfile[]) => Promise<void>;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storage.loadCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!storage.loadCurrentUser());

  const handleLogin = useCallback(async (email: string, users: UserProfile[]) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const now = new Date().toISOString();
    let loggedUser: UserProfile;

    if (user) {
      loggedUser = { ...user, lastLogin: now };
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

    setCurrentUser(loggedUser);
    setIsAuthenticated(true);
    storage.saveCurrentUser(loggedUser);
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
    setCurrentUser(null);
    setIsAuthenticated(false);
    storage.saveCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, handleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
