import { useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from './useAudit';
import { GeneralRule, BehaviouralModel, YieldCurvePoint, Transaction } from '../types';
import { supabaseService } from '../utils/supabaseService';
import { generateId } from '../utils/generateId';

type RawRow = Record<string, unknown>;

interface ImportSummary {
  module: string;
  imported: number;
  skipped: number;
  failures: Array<{ row: number; error: string }>;
}

const readString = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const readNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const readInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const readReplicationProfile = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Malformed JSON in a single cell must not abort the whole import.
      return [];
    }
  }
  return [];
};

const pick = (row: RawRow, ...keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
};

export const useUniversalImport = () => {
  const { setShocks } = useData();
  const { currentUser } = useAuth();
  const logAudit = useAudit(currentUser);

  const handleUniversalImport = useCallback(
    async (module: string, rawData: RawRow[]): Promise<ImportSummary> => {
      const data = (rawData ?? []).filter(
        (r): r is RawRow =>
          !!r && typeof r === 'object' && Object.values(r).some((v) => v !== null && v !== undefined && v !== ''),
      );

      const summary: ImportSummary = { module, imported: 0, skipped: 0, failures: [] };

      const recordFailure = (index: number, err: unknown) => {
        summary.failures.push({ row: index, error: extractErrorMessage(err, 'Unknown import error') });
      };

      switch (module) {
        case 'YIELD_CURVES': {
          const curves: Record<string, YieldCurvePoint[]> = {};
          data.forEach((r, index) => {
            try {
              const cur = readString(pick(r, 'Currency', 'currency'), 'USD');
              if (!curves[cur]) curves[cur] = [];
              curves[cur].push({
                tenor: readString(pick(r, 'Tenor', 'tenor'), '1M'),
                rate: readNumber(pick(r, 'Rate', 'rate'), 0),
                prev: readNumber(pick(r, 'Prev', 'prev'), 0),
              });
            } catch (err) {
              recordFailure(index, err);
            }
          });
          for (const [cur, points] of Object.entries(curves)) {
            try {
              await supabaseService.saveCurveSnapshot(cur, new Date().toISOString().split('T')[0], points);
              summary.imported += points.length;
              logAudit({
                action: 'IMPORT_YIELD_CURVES',
                module: 'MARKET_DATA',
                description: `Imported ${points.length} curve points for ${cur}`,
              });
            } catch (err) {
              summary.failures.push({
                row: -1,
                error: `${cur}: ${extractErrorMessage(err, 'Curve save failed')}`,
              });
            }
          }
          break;
        }
        case 'METHODOLOGY': {
          const rulesToSave = data.map((r) => ({
            id: readInt(pick(r, 'ID', 'id'), Math.floor(Math.random() * 10_000_000)),
            businessUnit: readString(pick(r, 'BusinessUnit', 'businessUnit'), 'General'),
            product: readString(pick(r, 'Product', 'product'), 'Unknown'),
            segment: readString(pick(r, 'Segment', 'segment'), 'All'),
            tenor: readString(pick(r, 'Tenor', 'tenor'), 'Any'),
            baseMethod: readString(pick(r, 'BaseMethod', 'baseMethod'), 'Matched Maturity'),
            baseReference: readString(pick(r, 'BaseReference', 'baseReference'), 'USD-SOFR'),
            spreadMethod: readString(pick(r, 'SpreadMethod', 'spreadMethod'), 'Fixed'),
            liquidityReference: readString(pick(r, 'LiquidityReference', 'liquidityReference'), 'Standard'),
            strategicSpread: readNumber(pick(r, 'StrategicSpread', 'strategicSpread'), 0),
          }));
          for (let i = 0; i < rulesToSave.length; i++) {
            try {
              await supabaseService.saveRule(rulesToSave[i] as GeneralRule);
              summary.imported += 1;
            } catch (err) {
              recordFailure(i, err);
            }
          }
          logAudit({
            action: 'IMPORT_METHODOLOGY',
            module: 'METHODOLOGY',
            description: `Imported ${summary.imported}/${rulesToSave.length} methodology rules.`,
          });
          break;
        }
        case 'BEHAVIOURAL': {
          const modelsToSave = data.map((r) => ({
            id: readString(pick(r, 'ID', 'id'), generateId('MOD-IMP')),
            name: readString(pick(r, 'Name', 'name'), 'Imported Model'),
            type: readString(pick(r, 'Type', 'type'), 'NMD_Replication') as BehaviouralModel['type'],
            description: readString(pick(r, 'Description', 'description'), ''),
            coreRatio: readNumber(pick(r, 'CoreRatio', 'coreRatio'), 50),
            decayRate: readNumber(pick(r, 'DecayRate', 'decayRate'), 0),
            betaFactor: readNumber(pick(r, 'BetaFactor', 'betaFactor'), 0.5),
            cpr: readNumber(pick(r, 'CPR', 'cpr'), 5),
            penaltyExempt: readNumber(pick(r, 'PenaltyExempt', 'penaltyExempt'), 0),
            replicationProfile: readReplicationProfile(pick(r, 'ReplicationProfile', 'replicationProfile')),
          }));
          for (let i = 0; i < modelsToSave.length; i++) {
            try {
              await supabaseService.saveModel(modelsToSave[i] as BehaviouralModel);
              summary.imported += 1;
            } catch (err) {
              recordFailure(i, err);
            }
          }
          logAudit({
            action: 'IMPORT_BEHAVIOURAL',
            module: 'BEHAVIOURAL',
            description: `Imported ${summary.imported}/${modelsToSave.length} behavioural models.`,
          });
          break;
        }
        case 'SHOCKS': {
          const row = data[0];
          if (!row) {
            summary.skipped = 1;
            break;
          }
          const newShocks = {
            interestRate: readNumber(pick(row, 'InterestRateShock', 'interestRateShock'), 0),
            liquiditySpread: readNumber(pick(row, 'LiquiditySpreadShock', 'liquiditySpreadShock'), 0),
          };
          try {
            setShocks(newShocks);
            await supabaseService.saveShocks(newShocks);
            summary.imported = 1;
            logAudit({
              action: 'IMPORT_SHOCKS',
              module: 'SHOCKS',
              description: `Universal import applied shocks: IR=${newShocks.interestRate}bps, Liq=${newShocks.liquiditySpread}bps`,
            });
          } catch (err) {
            recordFailure(0, err);
          }
          break;
        }
        case 'DEALS': {
          const dealsToSave: Transaction[] = data.map((r) => ({
            id: readString(pick(r, 'ID', 'id', 'Transact ID'), generateId('DL')),
            clientId: readString(pick(r, 'Client', 'clientId'), 'Unknown Client'),
            clientType: readString(pick(r, 'ClientType', 'clientType'), 'Corporate'),
            amount: readNumber(pick(r, 'Amount', 'amount'), 0),
            currency: readString(pick(r, 'Currency', 'currency'), 'USD'),
            productType: readString(pick(r, 'Product', 'productType'), 'LOAN_COMM'),
            category: readString(pick(r, 'Category', 'category'), 'Asset') as 'Asset' | 'Liability' | 'Off-Balance',
            startDate: readString(pick(r, 'Date', 'startDate'), new Date().toISOString().split('T')[0]),
            durationMonths: readInt(pick(r, 'Duration', 'durationMonths'), 12),
            amortization: readString(pick(r, 'Amortization', 'amortization'), 'Bullet') as 'Bullet' | 'French' | 'Linear',
            repricingFreq: readString(pick(r, 'RepricingFreq', 'repricingFreq'), 'Fixed') as
              | 'Daily'
              | 'Monthly'
              | 'Quarterly'
              | 'Fixed',
            status: 'Draft' as const,
            businessUnit: readString(pick(r, 'BU', 'businessUnit'), 'BU-001'),
            fundingBusinessUnit: readString(pick(r, 'FundingBU', 'fundingBusinessUnit'), 'BU-900'),
            businessLine: readString(pick(r, 'BusinessLine', 'businessLine'), 'Imported'),
            marginTarget: readNumber(pick(r, 'Margin', 'marginTarget'), 0),
            riskWeight: readNumber(pick(r, 'RiskWeight', 'riskWeight'), 100),
            capitalRatio: readNumber(pick(r, 'CapitalRatio', 'capitalRatio'), 11.5),
            targetROE: readNumber(pick(r, 'TargetROE', 'targetROE'), 15),
            operationalCostBps: readNumber(pick(r, 'OpCost', 'operationalCostBps'), 40),
            transitionRisk: readString(pick(r, 'TransitionRisk', 'transitionRisk'), 'Neutral') as
              | 'Brown'
              | 'Amber'
              | 'Neutral'
              | 'Green',
            physicalRisk: readString(pick(r, 'PhysicalRisk', 'physicalRisk'), 'Low') as 'High' | 'Medium' | 'Low',
          }));
          for (let i = 0; i < dealsToSave.length; i++) {
            try {
              await supabaseService.upsertDeal(dealsToSave[i]);
              summary.imported += 1;
            } catch (err) {
              recordFailure(i, err);
            }
          }
          break;
        }
        default:
          summary.skipped = data.length;
          break;
      }

      logAudit({
        action: `UNIVERSAL_IMPORT_${module}`,
        module: 'CONFIG',
        description: `Universal import performed for ${module} (${summary.imported}/${data.length} records, ${summary.failures.length} failures)`,
      });

      return summary;
    },
    [logAudit, setShocks],
  );

  return handleUniversalImport;
};
