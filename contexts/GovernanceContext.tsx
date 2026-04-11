import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  ApprovalTask,
  PricingDossier,
  MethodologyChangeRequest,
  MethodologyVersion,
  PortfolioSnapshot,
} from '../types';

export interface GovernanceContextType {
  approvalTasks: ApprovalTask[];
  setApprovalTasks: React.Dispatch<React.SetStateAction<ApprovalTask[]>>;
  pricingDossiers: PricingDossier[];
  setPricingDossiers: React.Dispatch<React.SetStateAction<PricingDossier[]>>;
  methodologyChangeRequests: MethodologyChangeRequest[];
  setMethodologyChangeRequests: React.Dispatch<React.SetStateAction<MethodologyChangeRequest[]>>;
  methodologyVersions: MethodologyVersion[];
  setMethodologyVersions: React.Dispatch<React.SetStateAction<MethodologyVersion[]>>;
  portfolioSnapshots: PortfolioSnapshot[];
  setPortfolioSnapshots: React.Dispatch<React.SetStateAction<PortfolioSnapshot[]>>;
}

const GovernanceContext = createContext<GovernanceContextType | null>(null);

export const GovernanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [pricingDossiers, setPricingDossiers] = useState<PricingDossier[]>([]);
  const [methodologyChangeRequests, setMethodologyChangeRequests] = useState<MethodologyChangeRequest[]>([]);
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersion[]>([]);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>([]);

  const value = useMemo(
    () => ({
      approvalTasks,
      setApprovalTasks,
      pricingDossiers,
      setPricingDossiers,
      methodologyChangeRequests,
      setMethodologyChangeRequests,
      methodologyVersions,
      setMethodologyVersions,
      portfolioSnapshots,
      setPortfolioSnapshots,
    }),
    [
      approvalTasks,
      pricingDossiers,
      methodologyChangeRequests,
      methodologyVersions,
      portfolioSnapshots,
    ]
  );

  return (
    <GovernanceContext.Provider value={value}>
      {children}
    </GovernanceContext.Provider>
  );
};

export const useGovernance = (): GovernanceContextType => {
  const ctx = useContext(GovernanceContext);
  if (!ctx) throw new Error('useGovernance must be used within GovernanceProvider');
  return ctx;
};
