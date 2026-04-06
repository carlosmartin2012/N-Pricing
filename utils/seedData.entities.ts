import type { Group, Entity, EntityUser } from '../types/entity';

export const DEFAULT_GROUP_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_ENTITY_ID = '00000000-0000-0000-0000-000000000010';
export const DEMO_ENTITY_2_ID = '00000000-0000-0000-0000-000000000020';

export const MOCK_GROUPS: Group[] = [
  {
    id: DEFAULT_GROUP_ID,
    name: 'NFQ Financial Group',
    shortCode: 'NFQ',
    country: 'ES',
    baseCurrency: 'EUR',
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ENTITIES: Entity[] = [
  {
    id: DEFAULT_ENTITY_ID,
    groupId: DEFAULT_GROUP_ID,
    name: 'NFQ Bank Spain',
    legalName: 'NFQ Bank Spain S.A.',
    shortCode: 'NFQES',
    country: 'ES',
    baseCurrency: 'EUR',
    timezone: 'Europe/Madrid',
    approvalMatrix: { autoApprovalThreshold: 15, l1Threshold: 10, l2Threshold: 5 },
    sdrConfig: { stableDepositRatio: 0.75, sdrFloor: 0.60, sdrImpactMultiplier: 0.8, externalFundingPct: 0.35 },
    lrConfig: { totalBufferCostBps: 22, riskAppetiteAddon: 1.3, buAllocations: {} },
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: DEMO_ENTITY_2_ID,
    groupId: DEFAULT_GROUP_ID,
    name: 'NFQ Bank Portugal',
    legalName: 'NFQ Bank Portugal S.A.',
    shortCode: 'NFQPT',
    country: 'PT',
    baseCurrency: 'EUR',
    timezone: 'Europe/Lisbon',
    approvalMatrix: { autoApprovalThreshold: 12, l1Threshold: 8, l2Threshold: 4 },
    sdrConfig: { stableDepositRatio: 0.70, sdrFloor: 0.55, sdrImpactMultiplier: 0.85, externalFundingPct: 0.40 },
    lrConfig: { totalBufferCostBps: 25, riskAppetiteAddon: 1.2, buAllocations: {} },
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ENTITY_USERS: EntityUser[] = [
  { entityId: DEFAULT_ENTITY_ID, userId: 'carlos.martin@nfq.es', role: 'Admin', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'alejandro.lloveras@nfq.es', role: 'Trader', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'f.herrero@nfq.es', role: 'Admin', isPrimaryEntity: true },
  { entityId: DEFAULT_ENTITY_ID, userId: 'demo@nfq.es', role: 'Admin', isPrimaryEntity: true },
  { entityId: DEMO_ENTITY_2_ID, userId: 'carlos.martin@nfq.es', role: 'Admin', isPrimaryEntity: false },
  { entityId: DEMO_ENTITY_2_ID, userId: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', isPrimaryEntity: false },
  { entityId: DEMO_ENTITY_2_ID, userId: 'demo@nfq.es', role: 'Admin', isPrimaryEntity: false },
];
