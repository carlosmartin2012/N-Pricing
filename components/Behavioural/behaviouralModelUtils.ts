import type {
  BehaviouralModel,
  ReplicationTranche,
} from '../../types';
import { generateId } from '../../utils/generateId';

type ImportRow = Record<string, unknown>;

const DEFAULT_REPLICATION_PROFILE: ReplicationTranche[] = [
  { term: '1M', weight: 30, spread: 0 },
  { term: '3M', weight: 20, spread: 5 },
  { term: '1Y', weight: 50, spread: 10 },
];

const readString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseReplicationProfile = (value: unknown): ReplicationTranche[] => {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      term: readString((item as ReplicationTranche).term, '1Y'),
      weight: readNumber((item as ReplicationTranche).weight, 0),
      spread: readNumber((item as ReplicationTranche).spread, 0),
    }));
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseReplicationProfile(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

export const createDefaultBehaviouralModel = (
  type: BehaviouralModel['type'],
): BehaviouralModel => ({
  id: generateId('MOD'),
  name: '',
  type,
  nmdMethod: 'Caterpillar',
  description: '',
  coreRatio: 50,
  decayRate: 0,
  betaFactor: 0.5,
  cpr: 5,
  penaltyExempt: 0,
  replicationProfile: [...DEFAULT_REPLICATION_PROFILE],
});

export const normalizeBehaviouralModel = (
  model: Partial<BehaviouralModel>,
  fallbackType: BehaviouralModel['type'],
): BehaviouralModel => {
  const type = (model.type || fallbackType) as BehaviouralModel['type'];
  const replicationProfile = parseReplicationProfile(model.replicationProfile);

  return {
    id: readString(model.id, generateId('MOD')),
    name: readString(model.name),
    type,
    nmdMethod: model.nmdMethod || 'Caterpillar',
    description: readString(model.description),
    coreRatio: readNumber(model.coreRatio, 50),
    decayRate: readNumber(model.decayRate, 0),
    betaFactor: readNumber(model.betaFactor, 0.5),
    cpr: readNumber(model.cpr, 5),
    penaltyExempt: readNumber(model.penaltyExempt, 0),
    replicationProfile: replicationProfile.length > 0
      ? replicationProfile
      : [...DEFAULT_REPLICATION_PROFILE],
  };
};

export const parseImportedBehaviouralModel = (
  row: ImportRow,
  fallbackType: BehaviouralModel['type'],
): BehaviouralModel =>
  normalizeBehaviouralModel({
    id: readString(row.ID ?? row.id, generateId('MOD-IMP')),
    name: readString(row.Name ?? row.name, 'Imported Model'),
    type: readString(row.Type ?? row.type, fallbackType) as BehaviouralModel['type'],
    description: readString(row.Description ?? row.description),
    nmdMethod: readString(row.Method ?? row.method, 'Caterpillar') as BehaviouralModel['nmdMethod'],
    coreRatio: readNumber(row.CoreRatio ?? row.coreRatio, 50),
    decayRate: readNumber(row.DecayRate ?? row.decayRate, 0),
    betaFactor: readNumber(row.BetaFactor ?? row.betaFactor, 0.5),
    cpr: readNumber(row.CPR ?? row.cpr, 5),
    penaltyExempt: readNumber(row.PenaltyExempt ?? row.penaltyExempt, 0),
    replicationProfile: parseReplicationProfile(row.ReplicationProfile ?? row.replicationProfile),
  }, fallbackType);

export const buildBehaviouralExportData = (
  models: BehaviouralModel[],
) => ({
  'NMD Models': models
    .filter(model => model.type === 'NMD_Replication')
    .map(model => ({
      Name: model.name,
      Type: model.type,
      Method: model.nmdMethod,
      CoreRatio: model.coreRatio,
      BetaFactor: model.betaFactor,
      Description: model.description,
      ReplicationProfile: JSON.stringify(model.replicationProfile),
    })),
  'Prepayment Models': models
    .filter(model => model.type === 'Prepayment_CPR')
    .map(model => ({
      Name: model.name,
      Type: model.type,
      CPR: model.cpr,
      PenaltyExempt: model.penaltyExempt,
      Description: model.description,
    })),
});

export const mergeBehaviouralModels = (
  existingModels: BehaviouralModel[],
  incomingModels: BehaviouralModel[],
) => {
  const merged = new Map(existingModels.map(model => [model.id, model]));
  incomingModels.forEach(model => {
    merged.set(model.id, model);
  });
  return Array.from(merged.values());
};

export const matchesBehaviouralSearch = (
  model: BehaviouralModel,
  searchTerm: string,
) => {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) return true;

  return [
    model.id,
    model.name,
    model.description,
  ].some(value => value.toLowerCase().includes(normalizedTerm));
};
