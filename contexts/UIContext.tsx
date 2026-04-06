import React, { createContext, useContext, useState } from 'react';
import { ViewState } from '../types';
import { Language, translations } from '../translations';

interface UIContextType {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  theme: 'dark' | 'light';
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
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

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewState>('CALCULATOR');
  const [language, setLanguage] = useState<Language>('en');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const t = translations[language];

  return (
    <UIContext.Provider
      value={{
        currentView, setCurrentView,
        language, setLanguage,
        theme, setTheme, t,
        isSidebarOpen, setSidebarOpen,
        isImportModalOpen, setIsImportModalOpen,
        isConfigModalOpen, setIsConfigModalOpen,
        isAiOpen, setIsAiOpen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
