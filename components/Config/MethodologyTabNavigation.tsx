import React from 'react';
import {
  Clock,
  Database,
  FileSpreadsheet,
  GitBranch,
  Leaf,
  ShieldCheck,
} from 'lucide-react';
import type {
  MethodologyConfigMode,
  MethodologyTabId,
} from './configTypes';
import { useUI } from '../../contexts/UIContext';

interface Props {
  mode: MethodologyConfigMode;
  activeTab: MethodologyTabId;
  onChange: (tab: MethodologyTabId) => void;
}

interface TabDescriptor {
  id: MethodologyTabId;
  labelKey: 'generalRules' | 'ftpCurvesAndSpreads' | 'esgRateCards' | 'governance' | 'masterData' | 'reportSchedules';
  icon: React.ReactNode;
  activeClasses: string;
  visible: (mode: MethodologyConfigMode) => boolean;
}

const TAB_DESCRIPTORS: TabDescriptor[] = [
  {
    id: 'GENERAL',
    labelKey: 'generalRules',
    icon: <GitBranch size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'METHODOLOGY' || mode === 'ALL',
  },
  {
    id: 'RATE_CARDS',
    labelKey: 'ftpCurvesAndSpreads',
    icon: <FileSpreadsheet size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'SYS_CONFIG' || mode === 'ALL',
  },
  {
    id: 'ESG',
    labelKey: 'esgRateCards',
    icon: <Leaf size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'SYS_CONFIG' || mode === 'ALL',
  },
  {
    id: 'GOVERNANCE',
    labelKey: 'governance',
    icon: <ShieldCheck size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'SYS_CONFIG' || mode === 'ALL',
  },
  {
    id: 'MASTER',
    labelKey: 'masterData',
    icon: <Database size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'SYS_CONFIG' || mode === 'ALL',
  },
  {
    id: 'SCHEDULES',
    labelKey: 'reportSchedules',
    icon: <Clock size={14} />,
    activeClasses: 'nfq-tab--active',
    visible: (mode) => mode === 'SYS_CONFIG' || mode === 'ALL',
  },
];

const MethodologyTabNavigation: React.FC<Props> = ({
  mode,
  activeTab,
  onChange,
}) => {
  const { t } = useUI();
  return (
  <div className="nfq-tab-list">
    {TAB_DESCRIPTORS.filter(tab => tab.visible(mode)).map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`nfq-tab ${activeTab === tab.id ? tab.activeClasses : ''}`}
      >
        <div className="flex items-center gap-2">
          {tab.icon}
          {t[tab.labelKey]}
        </div>
      </button>
    ))}
  </div>
  );
};

export default MethodologyTabNavigation;
