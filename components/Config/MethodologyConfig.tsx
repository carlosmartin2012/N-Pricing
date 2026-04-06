import React, { useState, useEffect } from 'react';
import { Panel } from '../ui/LayoutComponents';
import {
  ApprovalMatrixConfig,
  ProductDefinition,
  BusinessUnit,
  ClientEntity,
  GeneralRule,
  FtpRateCard,
} from '../../types';
import GeneralRulesTab from './tabs/GeneralRulesTab';
import RateCardsTab from './tabs/RateCardsTab';
import ESGGridTab from './tabs/ESGGridTab';
import GovernanceTab from './tabs/GovernanceTab';
import MasterDataTab from './tabs/MasterDataTab';
import ReportSchedulingTab from './tabs/ReportSchedulingTab';
import MethodologyTabNavigation from './MethodologyTabNavigation';
import type { ConfigUser, MethodologyConfigMode, MethodologyTabId } from './configTypes';

interface Props {
  mode: MethodologyConfigMode;
  rules: GeneralRule[];
  setRules: React.Dispatch<React.SetStateAction<GeneralRule[]>>;
  approvalMatrix?: ApprovalMatrixConfig;
  setApprovalMatrix?: (config: ApprovalMatrixConfig) => void;
  products?: ProductDefinition[];
  setProducts?: React.Dispatch<React.SetStateAction<ProductDefinition[]>>;
  businessUnits?: BusinessUnit[];
  setBusinessUnits?: React.Dispatch<React.SetStateAction<BusinessUnit[]>>;
  clients?: ClientEntity[];
  setClients?: React.Dispatch<React.SetStateAction<ClientEntity[]>>;
  ftpRateCards?: FtpRateCard[];
  setFtpRateCards?: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
  transitionGrid?: any[];
  setTransitionGrid?: React.Dispatch<React.SetStateAction<any[]>>;
  physicalGrid?: any[];
  setPhysicalGrid?: React.Dispatch<React.SetStateAction<any[]>>;
  user: ConfigUser;
}

const MethodologyConfig: React.FC<Props> = ({
  mode,
  rules,
  approvalMatrix,
  setApprovalMatrix,
  products = [],
  setProducts,
  businessUnits = [],
  setBusinessUnits,
  clients = [],
  setClients,
  ftpRateCards = [],
  setFtpRateCards,
  transitionGrid = [],
  setTransitionGrid,
  physicalGrid = [],
  setPhysicalGrid,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<MethodologyTabId>(mode === 'SYS_CONFIG' ? 'RATE_CARDS' : 'GENERAL');

  useEffect(() => {
    if (mode === 'METHODOLOGY') setActiveTab('GENERAL');
    else if (mode === 'SYS_CONFIG') {
      setActiveTab((prev) => (prev === 'GENERAL' ? 'RATE_CARDS' : prev));
    }
  }, [mode]);

  const tabContent: Record<MethodologyTabId, React.ReactNode> = {
    GENERAL: <GeneralRulesTab rules={rules} businessUnits={businessUnits} ftpRateCards={ftpRateCards} user={user} />,
    RATE_CARDS: <RateCardsTab ftpRateCards={ftpRateCards} setFtpRateCards={setFtpRateCards!} user={user} />,
    ESG: (
      <ESGGridTab
        transitionGrid={transitionGrid}
        setTransitionGrid={setTransitionGrid!}
        physicalGrid={physicalGrid}
        setPhysicalGrid={setPhysicalGrid!}
        user={user}
      />
    ),
    GOVERNANCE: <GovernanceTab approvalMatrix={approvalMatrix} setApprovalMatrix={setApprovalMatrix} user={user} />,
    MASTER: (
      <MasterDataTab
        clients={clients}
        setClients={setClients}
        products={products}
        setProducts={setProducts}
        businessUnits={businessUnits}
        setBusinessUnits={setBusinessUnits}
        user={user}
      />
    ),
    SCHEDULES: <ReportSchedulingTab user={user} />,
  };

  return (
    <Panel
      title={mode === 'METHODOLOGY' ? 'Methodology & Rules Engine' : 'System Configuration & Master Data'}
      className="h-full"
    >
      <div className="flex flex-col h-full">
        <MethodologyTabNavigation mode={mode} activeTab={activeTab} onChange={setActiveTab} />

        {tabContent[activeTab]}
      </div>
    </Panel>
  );
};

export default MethodologyConfig;
