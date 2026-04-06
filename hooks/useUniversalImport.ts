import { useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from './useAudit';
import { GeneralRule, BehaviouralModel, YieldCurvePoint, Transaction } from '../types';
import { supabaseService } from '../utils/supabaseService';
import { generateId } from '../utils/generateId';

export const useUniversalImport = () => {
  const { setShocks } = useData();
  const { currentUser } = useAuth();
  const logAudit = useAudit(currentUser);

  const handleUniversalImport = useCallback(async (module: string, rawData: any[]) => {
    const data = rawData.filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ''));

    switch (module) {
      case 'YIELD_CURVES': {
        const curves: Record<string, YieldCurvePoint[]> = {};
        data.forEach(r => {
          const cur = r.Currency || r.currency || 'USD';
          if (!curves[cur]) curves[cur] = [];
          curves[cur].push({
            tenor: r.Tenor || r.tenor || '1M',
            rate: parseFloat(r.Rate || r.rate) || 0,
            prev: parseFloat(r.Prev || r.prev) || 0,
          });
        });
        for (const [cur, points] of Object.entries(curves)) {
          await supabaseService.saveCurveSnapshot(cur, new Date().toISOString().split('T')[0], points);
          logAudit({ action: 'IMPORT_YIELD_CURVES', module: 'MARKET_DATA', description: `Imported ${points.length} curve points for ${cur}` });
        }
        break;
      }
      case 'METHODOLOGY': {
        const rulesToSave = data.map(r => ({
          id: r.ID || r.id || Math.floor(Math.random() * 10000),
          businessUnit: r.BusinessUnit || r.businessUnit || 'General',
          product: r.Product || r.product || 'Unknown',
          segment: r.Segment || r.segment || 'All',
          tenor: r.Tenor || r.tenor || 'Any',
          baseMethod: r.BaseMethod || r.baseMethod || 'Matched Maturity',
          baseReference: r.BaseReference || r.baseReference || 'USD-SOFR',
          spreadMethod: r.SpreadMethod || r.spreadMethod || 'Fixed',
          liquidityReference: r.LiquidityReference || r.liquidityReference || 'Standard',
          strategicSpread: parseFloat(r.StrategicSpread || r.strategicSpread) || 0,
        }));
        for (const rule of rulesToSave) {
          await supabaseService.saveRule(rule as GeneralRule);
        }
        logAudit({ action: 'IMPORT_METHODOLOGY', module: 'METHODOLOGY', description: `Imported ${rulesToSave.length} methodology rules.` });
        break;
      }
      case 'BEHAVIOURAL': {
        const modelsToSave = data.map(r => ({
          id: r.ID || r.id || generateId('MOD-IMP'),
          name: r.Name || r.name || 'Imported Model',
          type: (r.Type || r.type || 'NMD_Replication') as BehaviouralModel['type'],
          description: r.Description || r.description || '',
          coreRatio: parseFloat(r.CoreRatio || r.coreRatio) || 50,
          decayRate: parseFloat(r.DecayRate || r.decayRate) || 0,
          betaFactor: parseFloat(r.BetaFactor || r.betaFactor) || 0.5,
          cpr: parseFloat(r.CPR || r.cpr) || 5,
          penaltyExempt: parseFloat(r.PenaltyExempt || r.penaltyExempt) || 0,
          replicationProfile: r.ReplicationProfile ? (typeof r.ReplicationProfile === 'string' ? JSON.parse(r.ReplicationProfile) : r.ReplicationProfile) : [],
        }));
        for (const model of modelsToSave) {
          await supabaseService.saveModel(model as BehaviouralModel);
        }
        logAudit({ action: 'IMPORT_BEHAVIOURAL', module: 'BEHAVIOURAL', description: `Imported ${modelsToSave.length} behavioural models.` });
        break;
      }
      case 'SHOCKS': {
        const row = data[0];
        const newShocks = {
          interestRate: parseFloat(row.InterestRateShock || row.interestRateShock) || 0,
          liquiditySpread: parseFloat(row.LiquiditySpreadShock || row.liquiditySpreadShock) || 0,
        };
        setShocks(newShocks);
        await supabaseService.saveShocks(newShocks);
        logAudit({ action: 'IMPORT_SHOCKS', module: 'SHOCKS', description: `Universal import applied shocks: IR=${newShocks.interestRate}bps, Liq=${newShocks.liquiditySpread}bps` });
        break;
      }
      case 'DEALS': {
        const dealsToSave: Transaction[] = data.map(r => ({
          id: r.ID || r.id || r['Transact ID'] || generateId('DL'),
          clientId: r.Client || r.clientId || 'Unknown Client',
          clientType: r.ClientType || r.clientType || 'Corporate',
          amount: parseFloat(r.Amount || r.amount) || 0,
          currency: r.Currency || r.currency || 'USD',
          productType: r.Product || r.productType || 'LOAN_COMM',
          category: (r.Category || r.category || 'Asset') as 'Asset' | 'Liability' | 'Off-Balance',
          startDate: r.Date || r.startDate || new Date().toISOString().split('T')[0],
          durationMonths: parseInt(r.Duration || r.durationMonths) || 12,
          amortization: (r.Amortization || r.amortization || 'Bullet') as 'Bullet' | 'French' | 'Linear',
          repricingFreq: (r.RepricingFreq || r.repricingFreq || 'Fixed') as 'Daily' | 'Monthly' | 'Quarterly' | 'Fixed',
          status: 'Draft' as const,
          businessUnit: r.BU || r.businessUnit || 'BU-001',
          fundingBusinessUnit: r.FundingBU || r.fundingBusinessUnit || 'BU-900',
          businessLine: r.BusinessLine || r.businessLine || 'Imported',
          marginTarget: parseFloat(r.Margin || r.marginTarget) || 0,
          riskWeight: parseFloat(r.RiskWeight || r.riskWeight) || 100,
          capitalRatio: parseFloat(r.CapitalRatio || r.capitalRatio) || 11.5,
          targetROE: parseFloat(r.TargetROE || r.targetROE) || 15,
          operationalCostBps: parseFloat(r.OpCost || r.operationalCostBps) || 40,
          transitionRisk: (r.TransitionRisk || r.transitionRisk || 'Neutral') as 'Brown' | 'Amber' | 'Neutral' | 'Green',
          physicalRisk: (r.PhysicalRisk || r.physicalRisk || 'Low') as 'High' | 'Medium' | 'Low',
        }));
        for (const dl of dealsToSave) {
          await supabaseService.upsertDeal(dl);
        }
        break;
      }
    }

    logAudit({
      action: `UNIVERSAL_IMPORT_${module}`,
      module: 'CONFIG',
      description: `Universal import performed for ${module} (${data.length} records)`,
    });
  }, [logAudit, setShocks]);

  return handleUniversalImport;
};
