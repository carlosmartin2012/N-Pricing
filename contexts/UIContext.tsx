import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ViewState } from '../types';
import { Language, translations, getTranslations } from '../translations';
import { pathToView, viewToPath } from '../appNavigation';

export type ThemeMode = 'dark' | 'light' | 'system';

interface UIContextType {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  /** Effective theme (always 'dark' or 'light') — use for rendering decisions */
  theme: 'dark' | 'light';
  /** User preference including 'system' option */
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  t: (typeof translations)['en'];
  isSidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isImportModalOpen: boolean;
  setIsImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isConfigModalOpen: boolean;
  setIsConfigModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiOpen: boolean;
  setIsAiOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const UIContext = createContext<UIContextType | null>(null);

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = useMemo(() => pathToView(location.pathname), [location.pathname]);
  const setCurrentView = useCallback(
    (view: ViewState) => navigate(viewToPath(view)),
    [navigate]
  );

  const [language, setLanguage] = useState<Language>('en');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Theme: preference can be 'dark' | 'light' | 'system'
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(getSystemTheme);

  // Listen to OS theme changes when mode is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const theme: 'dark' | 'light' = themeMode === 'system' ? systemTheme : themeMode;
  const setTheme = useCallback((mode: ThemeMode) => setThemeMode(mode), []);

  const t = useMemo(() => getTranslations(language), [language]);
  const value = useMemo(
    () => ({
      currentView, setCurrentView,
      language, setLanguage,
      theme, themeMode, setTheme, t,
      isSidebarOpen, setSidebarOpen,
      isImportModalOpen, setIsImportModalOpen,
      isConfigModalOpen, setIsConfigModalOpen,
      isAiOpen, setIsAiOpen,
    }),
    [
      currentView,
      setCurrentView,
      language,
      theme,
      themeMode,
      setTheme,
      t,
      isSidebarOpen,
      isImportModalOpen,
      isConfigModalOpen,
      isAiOpen,
    ]
  );

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
