import type { ApprovalMatrixConfig, SDRConfig, LRConfig } from '../types';

export interface Group {
  id: string;
  name: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface Entity {
  id: string;
  groupId: string;
  name: string;
  legalName: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  approvalMatrix: ApprovalMatrixConfig;
  sdrConfig: SDRConfig;
  lrConfig: LRConfig;
  isActive: boolean;
  createdAt: string;
}

export interface EntityUser {
  entityId: string;
  userId: string;
  role: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';
  defaultBuId?: string;
  isPrimaryEntity: boolean;
}

export interface EntityScope {
  activeEntity: Entity;
  availableEntities: Entity[];
  group: Group | null;
  isGroupScope: boolean;
}
