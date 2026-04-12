import React, { useState, useEffect } from 'react';
import { Panel } from '../ui/LayoutComponents';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import GeneralRulesTab from './tabs/GeneralRulesTab';
import RateCardsTab from './tabs/RateCardsTab';
import ESGGridTab from './tabs/ESGGridTab';
import GovernanceTab from './tabs/GovernanceTab';
import MasterDataTab from './tabs/MasterDataTab';
import ReportSchedulingTab from './tabs/ReportSchedulingTab';
import MethodologyTabNavigation from './MethodologyTabNavigation';
import ModelInventoryPanel from './ModelInventoryPanel';
import type { MethodologyConfigMode, MethodologyTabId } from './configTypes';

interface Props {
  mode: MethodologyConfigMode;
}

const MethodologyConfig: React.FC<Props> = ({ mode }) => {
  const { currentUser: user } = useAuth();
  const data = useData();
  const {
    rules, approvalMatrix, setApprovalMatrix,
    products, setProducts, businessUnits, setBusinessUnits,
    clients, setClients, ftpRateCards, setFtpRateCards,
    transitionGrid, setTransitionGrid, physicalGrid, setPhysicalGrid,
    greeniumGrid, setGreeniumGrid,
  } = data;
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
        greeniumGrid={greeniumGrid}
        setGreeniumGrid={setGreeniumGrid!}
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
    MRM: <ModelInventoryPanel />,
  };

  return (
    <Panel
      title={mode === 'METHODOLOGY' ? 'Methodology & Rules Engine' : 'System Configuration & Master Data'}
      className="h-full"
    >
      <div data-tour="config-panel" className="flex flex-col h-full">
        <MethodologyTabNavigation mode={mode} activeTab={activeTab} onChange={setActiveTab} />

        {tabContent[activeTab]}
      </div>
    </Panel>
  );
};

export default MethodologyConfig;
