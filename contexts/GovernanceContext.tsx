import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  ApprovalTask,
  PricingDossier,
  MethodologyChangeRequest,
  MethodologyVersion,
  PortfolioSnapshot,
  MethodologySnapshot,
} from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('GovernanceContext');

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
  /** Ola 1: Methodology snapshots for target grid */
  methodologySnapshots: MethodologySnapshot[];
  setMethodologySnapshots: React.Dispatch<React.SetStateAction<MethodologySnapshot[]>>;
  /** Triggers target grid snapshot computation on methodology approval */
  onMethodologyApproved: (requestId: string, approverEmail: string) => void;
}

const GovernanceContext = createContext<GovernanceContextType | null>(null);

export const GovernanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [pricingDossiers, setPricingDossiers] = useState<PricingDossier[]>([]);
  const [methodologyChangeRequests, setMethodologyChangeRequests] = useState<MethodologyChangeRequest[]>([]);
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersion[]>([]);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [methodologySnapshots, setMethodologySnapshots] = useState<MethodologySnapshot[]>([]);

  const onMethodologyApproved = useCallback(
    (requestId: string, approverEmail: string) => {
      log.info('Methodology approved — snapshot creation triggered', { requestId, approverEmail });
      // In production, this would call the API to compute a new target grid snapshot.
      // For now, we log and let the React Query invalidation handle the UI refresh.
      // The actual computation is triggered server-side via the governance approval endpoint.
    },
    [],
  );

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
      methodologySnapshots,
      setMethodologySnapshots,
      onMethodologyApproved,
    }),
    [
      approvalTasks,
      pricingDossiers,
      methodologyChangeRequests,
      methodologyVersions,
      portfolioSnapshots,
      methodologySnapshots,
      onMethodologyApproved,
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
