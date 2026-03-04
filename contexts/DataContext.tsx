import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Transaction, ClientEntity, ProductDefinition, BusinessUnit,
  GeneralRule, BehaviouralModel, UserProfile, FtpRateCard,
  ApprovalMatrixConfig, RAROCInputs,
} from '../types';
import { PricingShocks } from '../utils/pricingEngine';
import { storage } from '../utils/storage';

interface DataContextType {
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
  behaviouralModels: BehaviouralModel[];
  setBehaviouralModels: React.Dispatch<React.SetStateAction<BehaviouralModel[]>>;
  users: UserProfile[];
  setUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  yieldCurves: any[];
  setYieldCurves: React.Dispatch<React.SetStateAction<any[]>>;

  // Config data
  approvalMatrix: ApprovalMatrixConfig;
  setApprovalMatrix: (config: ApprovalMatrixConfig) => void;
  shocks: PricingShocks;
  setShocks: React.Dispatch<React.SetStateAction<PricingShocks>>;
  ftpRateCards: FtpRateCard[];
  setFtpRateCards: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
  transitionGrid: any[];
  setTransitionGrid: React.Dispatch<React.SetStateAction<any[]>>;
  physicalGrid: any[];
  setPhysicalGrid: React.Dispatch<React.SetStateAction<any[]>>;
  rarocInputs: RAROCInputs | null;
  setRarocInputs: React.Dispatch<React.SetStateAction<RAROCInputs | null>>;

  // Loading & Sync
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  syncStatus: 'idle' | 'mock' | 'synced' | 'error';
  setSyncStatus: React.Dispatch<React.SetStateAction<'idle' | 'mock' | 'synced' | 'error'>>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [rules, setRules] = useState<GeneralRule[]>([]);
  const [behaviouralModels, setBehaviouralModels] = useState<BehaviouralModel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [yieldCurves, setYieldCurves] = useState<any[]>([]);

  const [approvalMatrix, setApprovalMatrixState] = useState<ApprovalMatrixConfig>(() =>
    storage.loadLocal('n_pricing_approval_matrix', {
      autoApprovalThreshold: 15.0,
      l1Threshold: 10.0,
      l2Threshold: 5.0,
    })
  );
  const setApprovalMatrix = useCallback((config: ApprovalMatrixConfig) => {
    setApprovalMatrixState(config);
    storage.saveLocal('n_pricing_approval_matrix', config);
  }, []);

  const [shocks, setShocks] = useState<PricingShocks>({ interestRate: 0, liquiditySpread: 0 });
  const [ftpRateCards, setFtpRateCards] = useState<FtpRateCard[]>([]);
  const [transitionGrid, setTransitionGrid] = useState<any[]>([]);
  const [physicalGrid, setPhysicalGrid] = useState<any[]>([]);
  const [rarocInputs, setRarocInputs] = useState<RAROCInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'mock' | 'synced' | 'error'>('idle');

  return (
    <DataContext.Provider
      value={{
        deals, setDeals,
        clients, setClients,
        products, setProducts,
        businessUnits, setBusinessUnits,
        rules, setRules,
        behaviouralModels, setBehaviouralModels,
        users, setUsers,
        yieldCurves, setYieldCurves,
        approvalMatrix, setApprovalMatrix,
        shocks, setShocks,
        ftpRateCards, setFtpRateCards,
        transitionGrid, setTransitionGrid,
        physicalGrid, setPhysicalGrid,
        rarocInputs, setRarocInputs,
        isLoading, setIsLoading,
        syncStatus, setSyncStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
