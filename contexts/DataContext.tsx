import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Transaction,
  ClientEntity,
  ProductDefinition,
  BusinessUnit,
  GeneralRule,
  UserProfile,
  ApprovalMatrixConfig,
  RAROCInputs,
} from '../types';
import { PricingShocks } from '../utils/pricingEngine';
import { localCache } from '../utils/localCache';
import { useMarketData } from './MarketDataContext';
import type { MarketDataContextType } from './MarketDataContext';
import { useGovernance } from './GovernanceContext';
import type { GovernanceContextType } from './GovernanceContext';

// Re-export sub-context types and hooks for consumers that import from DataContext
export type { MarketDataContextType } from './MarketDataContext';
export type { GovernanceContextType } from './GovernanceContext';
export { useMarketData } from './MarketDataContext';
export { useGovernance } from './GovernanceContext';

// --- Core data context (deals, clients, products, etc.) ---

export interface CoreDataContextType {
  // Core domain data
  deals: Transaction[];
  setDeals: React.Dispatch<React.SetStateAction<Transaction[]>>;
  clients: ClientEntity[];
  setClients: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
  products: ProductDefinition[];
  setProducts: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
  businessUnits: BusinessUnit[];
  setBusinessUnits: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
  rules: GeneralRule[];
  setRules: React.Dispatch<React.SetStateAction<GeneralRule[]>>;
  users: UserProfile[];
  setUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;

  // Config data
  approvalMatrix: ApprovalMatrixConfig;
  setApprovalMatrix: (config: ApprovalMatrixConfig) => void;
  shocks: PricingShocks;
  setShocks: React.Dispatch<React.SetStateAction<PricingShocks>>;
  rarocInputs: RAROCInputs | null;
  setRarocInputs: React.Dispatch<React.SetStateAction<RAROCInputs | null>>;

  // Loading & Sync
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  syncStatus: 'idle' | 'mock' | 'synced' | 'error';
  setSyncStatus: React.Dispatch<React.SetStateAction<'idle' | 'mock' | 'synced' | 'error'>>;
}

/**
 * Full DataContextType — union of all three sub-contexts.
 * Backward compatible: existing `useData()` consumers see the same shape.
 */
export type DataContextType = CoreDataContextType & MarketDataContextType & GovernanceContextType;

const CoreDataContext = createContext<CoreDataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [rules, setRules] = useState<GeneralRule[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [approvalMatrix, setApprovalMatrixState] = useState<ApprovalMatrixConfig>(() =>
    localCache.loadLocal('n_pricing_approval_matrix', {
      autoApprovalThreshold: 15.0,
      l1Threshold: 10.0,
      l2Threshold: 5.0,
    })
  );
  const setApprovalMatrix = useCallback((config: ApprovalMatrixConfig) => {
    setApprovalMatrixState(config);
    localCache.saveLocal('n_pricing_approval_matrix', config);
  }, []);

  const [shocks, setShocks] = useState<PricingShocks>({ interestRate: 0, liquiditySpread: 0 });
  const [rarocInputs, setRarocInputs] = useState<RAROCInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'mock' | 'synced' | 'error'>('idle');

  return (
    <CoreDataContext.Provider
      value={{
        deals,
        setDeals,
        clients,
        setClients,
        products,
        setProducts,
        businessUnits,
        setBusinessUnits,
        rules,
        setRules,
        users,
        setUsers,
        approvalMatrix,
        setApprovalMatrix,
        shocks,
        setShocks,
        rarocInputs,
        setRarocInputs,
        isLoading,
        setIsLoading,
        syncStatus,
        setSyncStatus,
      }}
    >
      {children}
    </CoreDataContext.Provider>
  );
};

export const useCoreData = (): CoreDataContextType => {
  const ctx = useContext(CoreDataContext);
  if (!ctx) throw new Error('useCoreData must be used within DataProvider');
  return ctx;
};

/**
 * Backward-compatible hook that merges all three sub-contexts.
 * Existing components that call useData() continue to work unchanged.
 */
export const useData = (): DataContextType => {
  const core = useCoreData();
  const market = useMarketData();
  const governance = useGovernance();
  return { ...core, ...market, ...governance };
};
