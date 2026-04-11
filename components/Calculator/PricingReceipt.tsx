import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import * as auditApi from '../../api/audit';
import * as configApi from '../../api/config';
import * as dealsApi from '../../api/deals';
import { Transaction, FTPResult, ApprovalMatrixConfig, type CreditRiskResult } from '../../types';
import { calculatePricing, DEFAULT_PRICING_SHOCKS, PricingShocks } from '../../utils/pricingEngine';
import { validateDeal, type ValidationError } from '../../utils/validation';
import { Panel, Badge } from '../ui/LayoutComponents';
import { TooltipTrigger } from '../ui/Tooltip';
import { AccessibleLiveRegion } from '../ui/AccessibleLiveRegion';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Zap,
  Droplets,
  Save,
  FilePlus,
  Check,
  FileDown,
} from 'lucide-react';
import { translations, Language } from '../../translations';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { usePricingContext } from '../../hooks/usePricingContext';
import { errorTracker } from '../../utils/errorTracking';
import { exportPricingPDF } from '../../utils/pdfExport';
import { findLatestPortfolioSnapshotForDeal } from '../../utils/aiGrounding';
import { calculateFullCreditRisk } from '../../utils/pricing/creditRiskEngine';
import { monitoringService } from '../../utils/supabase/monitoring';
import {
  buildApprovalTaskForPricingDossier,
  buildPricingDossier,
  mergeApprovalTask,
  mergePricingDossier,
  updateDealApprovalTasks,
  upsertApprovalTask,
  upsertPricingDossier,
} from '../../utils/governanceWorkflows';
// Persistence flows through api/* modules and specialized services.

interface Props {
  deal: Transaction;
  setMatchedMethod: (m: string) => void;
  approvalMatrix: ApprovalMatrixConfig;
  language: Language;
  shocks?: PricingShocks;
  onDealSaved?: (deal: Transaction) => void;
}

const VALIDATION_FAILED_RESULT: FTPResult = {
  baseRate: 0, liquiditySpread: 0, _liquidityPremiumDetails: 0, _clcChargeDetails: 0,
  strategicSpread: 0, optionCost: 0, regulatoryCost: 0, operationalCost: 0, capitalCharge: 0,
  esgTransitionCharge: 0, esgPhysicalCharge: 0, esgGreeniumAdj: 0, esgDnshCapitalAdj: 0, esgPillar1Adj: 0,
  floorPrice: 0, technicalPrice: 0, targetPrice: 0,
  totalFTP: 0, finalClientRate: 0, raroc: 0, economicProfit: 0,
  approvalLevel: 'Rejected', matchedMethodology: '', matchReason: '',
  accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 },
};

const PricingReceipt: React.FC<Props> = ({ deal, setMatchedMethod, approvalMatrix, language, shocks, onDealSaved }) => {
  const [showAccounting, setShowAccounting] = useState(false);
  const [showCreditDetail, setShowCreditDetail] = useState(false);
  const [applyShocks, setApplyShocks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dealSaveStatus, setDealSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = translations[language];
  const data = useData();
  const pricingContext = usePricingContext();
  const { currentUser } = useAuth();
  const activeScenarioShocks = applyShocks && shocks ? shocks : DEFAULT_PRICING_SHOCKS;

  // Validate deal before pricing
  const validationErrors: ValidationError[] = useMemo(() => {
    const { errors } = validateDeal(deal);
    return errors;
  }, [deal]);

  const result: FTPResult = useMemo(() => {
    if (validationErrors.length > 0) {
      return VALIDATION_FAILED_RESULT;
    }
    const baseResult = calculatePricing(deal, approvalMatrix, pricingContext, activeScenarioShocks);
    setMatchedMethod(baseResult.matchedMethodology);
    return baseResult;
  }, [deal, setMatchedMethod, approvalMatrix, pricingContext, activeScenarioShocks, validationErrors]);

  // Full credit risk detail from Anejo IX engine
  const creditDetail: CreditRiskResult | null = useMemo(() => {
    if (validationErrors.length > 0) return null;
    try {
      return calculateFullCreditRisk({
        productType: deal.productType,
        clientType: deal.clientType,
        amount: deal.amount,
        ltvPct: deal.haircutPct ? deal.haircutPct / 100 : 0,
        collateralType: deal.collateralType || 'None',
        collateralValue:
          deal.collateralType && deal.collateralType !== 'None' && deal.haircutPct && deal.haircutPct > 0
            ? deal.amount / (deal.haircutPct / 100)
            : 0,
        durationMonths: deal.durationMonths,
        guaranteeType: deal.guaranteeType,
        appraisalAgeMonths: deal.appraisalAgeMonths,
        publicGuaranteePct: deal.publicGuaranteePct,
        undrawnAmount: deal.undrawnAmount,
        ccfType: deal.ccfType,
        utilizationRate: deal.utilizationRate,
        mode: deal.creditRiskMode,
        externalPd12m: deal.externalPd12m,
        externalLgd: deal.externalLgd,
        externalEad: deal.externalEad,
      });
    } catch {
      return null;
    }
  }, [deal, validationErrors]);

  // Auto-save pricing result to Supabase (debounced 3s after calculation stabilizes)
  useEffect(() => {
    if (!deal.id || !currentUser) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      monitoringService
        .savePricingResult(deal.id!, result, deal, currentUser.email)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        })
        .catch(() => {});
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [result, deal, currentUser]);

  // Save as new deal in blotter
  const handleSaveAsDeal = useCallback(async () => {
    if (!currentUser) return;
    if (validationErrors.length > 0) return;
    setDealSaveStatus('saving');
    const newDeal: Transaction = {
      ...deal,
      id: deal.id || `DL-${Date.now().toString(36).toUpperCase()}`,
      status: result.approvalLevel === 'Auto' ? 'Approved' : 'Pending_Approval',
      liquiditySpread: result.liquiditySpread,
      _liquidityPremiumDetails: result._liquidityPremiumDetails,
      _clcChargeDetails: result._clcChargeDetails,
    };
    try {
      const persistedDeal = await dealsApi.upsertDeal(newDeal);
      const resolvedDeal = persistedDeal || newDeal;
      data.setDeals((prev) => {
        const exists = prev.find((d) => d.id === resolvedDeal.id);
        return exists ? prev.map((d) => (d.id === resolvedDeal.id ? resolvedDeal : d)) : [...prev, resolvedDeal];
      });
      await monitoringService.savePricingResult(resolvedDeal.id!, result, resolvedDeal, currentUser.email);

      const existingDossier = data.pricingDossiers.find((dossier) => dossier.dealId === resolvedDeal.id);
      let dossier = mergePricingDossier(
        existingDossier,
        buildPricingDossier({
          deal: resolvedDeal,
          result,
          approvalMatrix,
          shocks: activeScenarioShocks,
          rules: data.rules,
          methodologyVersions: data.methodologyVersions,
          currentUser: {
            email: currentUser.email,
            name: currentUser.name,
          },
          yieldCurveCount: data.yieldCurves.length,
          liquidityCurveCount: data.liquidityCurves.length,
          marketDataSources: data.marketDataSources,
          portfolioSnapshots: data.portfolioSnapshots,
          status: resolvedDeal.status === 'Approved' ? 'Approved' : 'Pending_Approval',
        })
      );

      let nextTasks = data.approvalTasks;
      if (dossier.status === 'Pending_Approval') {
        const existingTask = nextTasks.find(
          (task) => task.scope === 'DEAL_PRICING' && task.subject.id === resolvedDeal.id
        );
        const approvalTask = mergeApprovalTask(existingTask, buildApprovalTaskForPricingDossier(dossier));
        if (approvalTask) {
          dossier = {
            ...dossier,
            approvalTaskId: approvalTask.id,
          };
          nextTasks = upsertApprovalTask(nextTasks, approvalTask);
        }
      } else {
        nextTasks = updateDealApprovalTasks(
          nextTasks,
          resolvedDeal.id!,
          'Approved',
          currentUser.email,
          currentUser.name
        );
      }

      const nextDossiers = upsertPricingDossier(data.pricingDossiers, dossier);
      data.setPricingDossiers(nextDossiers);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        configApi.savePricingDossiers(nextDossiers),
        configApi.saveApprovalTasks(nextTasks),
      ]);

      await auditApi.createAuditEntry({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: 'DEAL_SAVED_FROM_CALCULATOR',
        module: 'CALCULATOR',
        description: `Deal ${newDeal.id} saved with RAROC ${result.raroc.toFixed(2)}% — ${result.approvalLevel}`,
        details: {
          dossierId: dossier.id,
          approvalTaskId: dossier.approvalTaskId,
          methodologyVersionId: dossier.methodologyVersionId,
        },
      });
      setDealSaveStatus('saved');
      onDealSaved?.(resolvedDeal);
      setTimeout(() => setDealSaveStatus('idle'), 3000);
    } catch {
      setDealSaveStatus('idle');
    }
  }, [activeScenarioShocks, approvalMatrix, deal, result, currentUser, data, onDealSaved, validationErrors]);

  // Generate printable pricing receipt (PDF-ready) via dedicated utility
  const handleExportReceipt = useCallback(() => {
    const clientName = data.clients.find((c) => c.id === deal.clientId)?.name || deal.clientId;
    exportPricingPDF(deal, result, clientName);
    if (!deal.id) return;

    const existingDossier = data.pricingDossiers.find((dossier) => dossier.dealId === deal.id);
    if (!existingDossier) return;

    const nextDossiers = data.pricingDossiers.map((dossier) => {
      if (dossier.dealId !== deal.id) return dossier;

      const snapshot = findLatestPortfolioSnapshotForDeal(deal.id, data.portfolioSnapshots);
      const hasExportEvidence = dossier.evidence.some((evidence) => evidence.type === 'EXPORT_PACKAGE');

      return {
        ...dossier,
        updatedAt: new Date().toISOString(),
        evidence: [
          ...dossier.evidence.map((evidence) =>
            evidence.type === 'PRICING_RECEIPT' ? { ...evidence, status: 'Generated' as const } : evidence
          ),
          ...(!hasExportEvidence
            ? [
                {
                  id: `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                  type: 'EXPORT_PACKAGE' as const,
                  label: `Export package for ${dossier.dealId}`,
                  format: 'pdf' as const,
                  createdAt: new Date().toISOString(),
                  createdByEmail: currentUser?.email || 'system',
                  createdByName: currentUser?.name || 'System',
                  status: 'Generated' as const,
                  metadata: {
                    dossierId: dossier.id,
                    methodologyVersionId: dossier.methodologyVersionId,
                    portfolioSnapshotId: snapshot?.id,
                    marketDataSourceIds: dossier.groundedContext?.marketDataSourceIds || [],
                  },
                },
              ]
            : []),
        ],
      };
    });

    data.setPricingDossiers(nextDossiers);
    // Fire-and-forget persistence — failures are captured centrally and
    // surfaced via the error tracker instead of crashing the render path.
    configApi.savePricingDossiers(nextDossiers).catch((error: unknown) => {
      errorTracker.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          module: 'PRICING_RECEIPT',
          dealId: deal.id,
          extra: { operation: 'savePricingDossiers' },
        },
      );
    });
  }, [deal, result, data, currentUser]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency }).format(n);

  const pricingAnnouncement = validationErrors.length > 0
    ? 'Pricing calculation failed: validation errors'
    : `FTP Rate calculated: ${result.totalFTP.toFixed(2)}%, Final Client Rate: ${result.finalClientRate.toFixed(2)}%`;

  return (
    <Panel title={t.pricingResult || 'Profitability & Pricing Construction'} className="h-full">
      <AccessibleLiveRegion message={pricingAnnouncement} />
      <div data-testid="pricing-receipt" className="flex flex-col h-full">
        {/* Shocks Toggle Banner */}
        {shocks && (shocks.interestRate !== 0 || shocks.liquiditySpread !== 0) && (
          <div
            className={`mx-4 mt-4 flex items-center justify-between rounded-lg border p-3 transition-colors ${applyShocks ? 'border-amber-500/25 bg-amber-500/10' : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]'}`}
          >
            <div className="flex items-center gap-2">
              <Zap size={16} className={applyShocks ? 'text-amber-500' : 'text-slate-400'} />
              <div className="text-xs">
                <span
                  className={`font-bold block ${applyShocks ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}
                >
                  {t.shockedScenario || 'Shocked Scenario'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {shocks.interestRate > 0 ? '+' : ''}
                  {shocks.interestRate}bps IR, {shocks.liquiditySpread > 0 ? '+' : ''}
                  {shocks.liquiditySpread}bps Liq.
                </span>
              </div>
            </div>
            <button
              onClick={() => setApplyShocks(!applyShocks)}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${applyShocks ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
            >
              {applyShocks ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mx-4 mt-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Validation Errors</span>
            </div>
            <ul className="space-y-0.5 pl-6">
              {validationErrors.map((err) => (
                <li key={err.field} className="text-[11px] text-red-300">
                  <span className="font-mono text-red-400">{err.field}</span>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RAROC Scorecard */}
        <div data-tour="receipt-raroc" className="border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="nfq-label">Projected RAROC</h4>
              <div
                data-testid="receipt-raroc"
                className={`font-mono-nums text-3xl font-bold tracking-tight ${result.raroc >= approvalMatrix.autoApprovalThreshold ? 'text-emerald-600 dark:text-emerald-400' : result.raroc > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500'}`}
              >
                {result.raroc.toFixed(2)}%
              </div>
              <div className="font-mono text-[10px] text-slate-500">Target {deal.targetROE}%</div>
            </div>

            <div className="text-right">
              <h4 className="nfq-label">{t.customerRate}</h4>
              <div
                data-testid="receipt-final-rate"
                className="font-mono-nums text-2xl font-bold text-slate-900 dark:text-white"
              >
                {result.finalClientRate.toFixed(2)}%
              </div>
              <div className="font-mono text-[10px] text-slate-500">All-in Price</div>
            </div>
          </div>

          {/* Approval Matrix Badge */}
          <div
            data-testid="receipt-approval"
            className={`flex items-center gap-2 p-2 rounded border ${
              result.approvalLevel === 'Auto'
                ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400'
                : result.approvalLevel === 'L1_Manager'
                  ? 'bg-amber-950/30 border-amber-900 text-amber-400'
                  : result.approvalLevel === 'L2_Committee'
                    ? 'bg-orange-950/30 border-orange-900 text-orange-400'
                    : 'bg-red-950/30 border-red-900 text-red-400'
            }`}
          >
            {result.approvalLevel === 'Auto' && <CheckCircle2 size={16} />}
            {result.approvalLevel === 'L1_Manager' && <AlertTriangle size={16} />}
            {result.approvalLevel === 'L2_Committee' && <TrendingUp size={16} />}
            {result.approvalLevel === 'Rejected' && <XCircle size={16} />}

            <div className="flex-1 text-xs font-bold uppercase">
              {result.approvalLevel === 'Auto' && 'Automatic Approval'}
              {result.approvalLevel === 'L1_Manager' && 'Requires L1 Manager Review'}
              {result.approvalLevel === 'L2_Committee' && 'Escalation: Pricing Committee'}
              {result.approvalLevel === 'Rejected' && 'Deal Below Floor - Rejected'}
            </div>
          </div>
        </div>

        {/* Pricing Waterfall V5.0: ALM Hierarchical Rigor */}
        <div className="flex-1 space-y-1 overflow-auto bg-[var(--nfq-bg-surface)] p-4">
          {/* Formula Badge */}
          {result.formulaUsed && (
            <div className="mb-3 p-2 bg-indigo-950/30 border border-indigo-800/50 rounded-lg">
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Applied Formula</div>
              <div className="text-xs text-indigo-300 font-mono">{result.formulaUsed}</div>
              {result.behavioralMaturityUsed != null && result.behavioralMaturityUsed !== deal.durationMonths && (
                <div className="text-[10px] text-indigo-500 mt-1">
                  BM={Math.round(result.behavioralMaturityUsed)}M vs DTM={deal.durationMonths}M
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-widest">
            Pricing Construction Flow
          </div>

          <div data-testid="receipt-base-rate">
            <WaterfallItem label="IRRBB — Base Rate" value={result.baseRate} color="text-slate-300" formula={t.tooltip_formula_baseRate} />
          </div>

          {/* Consolidated Liquidity Module */}
          <div className="mt-3 mb-1 pt-2 border-t border-slate-800/50">
            <WaterfallItem
              label={t.liquidityCost || 'Total Liquidity Spread'}
              value={result.liquiditySpread}
              isAdd
              color="text-amber-400"
              weight="font-mono font-bold"
              icon={<Droplets size={12} className="inline mr-2 text-amber-600" />}
              formula={t.tooltip_formula_liquidityPremium}
            />

            {/* Indented Breakdown: LP + CLC + NSFR + LR */}
            <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-800 pl-3">
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>Liquidity Premium (LP)</span>
                <span className="font-mono">
                  {result._liquidityPremiumDetails >= 0 ? '+' : ''}
                  {result._liquidityPremiumDetails.toFixed(3)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>LCR Buffer Cost (CLC)</span>
                <span className="font-mono">+{result._clcChargeDetails.toFixed(3)}%</span>
              </div>
              {result.nsfrCost != null && result.nsfrCost !== 0 && (
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>NSFR {result.nsfrCost < 0 ? 'Benefit' : 'Charge'}</span>
                  <span className="font-mono">
                    {result.nsfrCost >= 0 ? '+' : ''}
                    {result.nsfrCost.toFixed(3)}%
                  </span>
                </div>
              )}
              {result.liquidityRecharge != null && result.liquidityRecharge !== 0 && (
                <div className="flex justify-between items-center text-[10px] text-purple-400">
                  <span>Liquidity Recharge (LR)</span>
                  <span className="font-mono">+{result.liquidityRecharge.toFixed(3)}%</span>
                </div>
              )}
            </div>
          </div>

          <WaterfallItem
            label="Strategic Spread"
            value={result.strategicSpread}
            isAdd
            color="text-blue-600 dark:text-blue-400"
            formula={t.tooltip_formula_strategicSpread}
          />

          {/* Incentivisation */}
          {result.incentivisationAdj != null && result.incentivisationAdj !== 0 && (
            <WaterfallItem
              label="Incentivisation Adj."
              value={result.incentivisationAdj}
              isAdd
              color={result.incentivisationAdj < 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
          )}

          <div className="my-2 border-t border-slate-200 dark:border-slate-800 border-dotted opacity-60"></div>

          <div data-testid="receipt-total-ftp">
            <WaterfallItem label={t.ftpRate} value={result.totalFTP} highlight />
          </div>

          {/* Business & Regulatory Costs */}
          <div className="pl-2 border-l-2 border-slate-800 ml-1 mt-2 space-y-1">
            <WaterfallItem
              label={`${t.anejo_creditProvision}${result.anejoSegment ? ` · ${result.anejoSegment.replace(/_/g, ' ')}` : ''}`}
              value={result.regulatoryCost}
              isAdd
              color="text-rose-400"
              formula={t.tooltip_formula_anejoCreditCost}
            />

            {/* Collapsible Credit Risk Detail (Anejo IX) */}
            {creditDetail && (
              <div className="ml-2 mt-1">
                <button
                  onClick={() => setShowCreditDetail(!showCreditDetail)}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest font-bold"
                >
                  {showCreditDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {t.creditRiskDetail}
                </button>

                {showCreditDetail && (
                  <div className="mt-1.5 bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                    {/* Segment & Mode */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">{t.anejo_segment}</div>
                        <div className="font-mono text-xs text-slate-300">{creditDetail.anejoSegment.replace(/_/g, ' ')}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditMode}</div>
                        <div className="font-mono text-xs text-slate-300">
                          {creditDetail.mode === 'mirror' ? t.creditModeMirror : t.creditModeNative}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditCoverage}</div>
                        <div className="font-mono text-xs text-slate-300">{creditDetail.coveragePct.toFixed(3)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditScenarioWeighted}</div>
                        <div className="font-mono text-xs text-slate-300">
                          {creditDetail.scenarioWeightedCoveragePct != null
                            ? `${creditDetail.scenarioWeightedCoveragePct.toFixed(3)}%`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Provision & Migration */}
                    <div className="border-t border-slate-800 pt-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditDay1Provision}</span>
                        <span className="font-mono text-xs text-slate-300">
                          {creditDetail.day1Provision != null
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(creditDetail.day1Provision)
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditMigrationCost}</span>
                        <span className="font-mono text-xs text-slate-300">
                          {creditDetail.migrationCostAnnual != null
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(creditDetail.migrationCostAnnual)
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditProbS2}</span>
                        <span className="font-mono text-xs text-slate-300">
                          {creditDetail.pMigrateS2 != null ? `${(creditDetail.pMigrateS2 * 100).toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditProbS3}</span>
                        <span className="font-mono text-xs text-slate-300">
                          {creditDetail.pMigrateS3 != null ? `${(creditDetail.pMigrateS3 * 100).toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{t.creditELLifetime} ({Math.round(deal.durationMonths / 12)}yr)</span>
                        <span className="font-mono text-xs text-slate-300">
                          {creditDetail.elLifetime != null
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(creditDetail.elLifetime)
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Capital Params */}
                    {creditDetail.capitalParams && (
                      <div className="border-t border-slate-800 pt-2">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t.creditCapitalParams}</div>
                        <div className="font-mono text-[11px] text-slate-400 leading-relaxed">
                          <span>PD: {(creditDetail.capitalParams.pd * 100).toFixed(2)}%</span>
                          <span className="mx-2 text-slate-600">|</span>
                          <span>LGD: {(creditDetail.capitalParams.lgd * 100).toFixed(0)}%</span>
                          <span className="mx-2 text-slate-600">|</span>
                          <span>EAD: {new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(creditDetail.capitalParams.ead)}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          <span>Exposure Class: {creditDetail.capitalParams.exposureClass}</span>
                          <span className="mx-2 text-slate-600">|</span>
                          <span>Maturity: {creditDetail.capitalParams.maturityYears.toFixed(1)}yr</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <WaterfallItem label="Operational Cost" value={result.operationalCost} isAdd color="text-rose-400" />
            <WaterfallItem
              label="ESG Transition"
              value={result.esgTransitionCharge}
              isAdd
              color={result.esgTransitionCharge > 0 ? 'text-rose-400' : 'text-emerald-400'}
              formula={t.tooltip_formula_esgTransition}
            />
            <WaterfallItem label="ESG Physical" value={result.esgPhysicalCharge} isAdd color="text-rose-400" formula={t.tooltip_formula_esgPhysical} />
            {result.esgGreeniumAdj != null && result.esgGreeniumAdj !== 0 && (
              <WaterfallItem
                label="Greenium / Movilización"
                value={result.esgGreeniumAdj}
                isAdd
                color="text-emerald-400"
                formula={t.tooltip_formula_esgGreenium}
              />
            )}
          </div>

          <div className="bg-slate-800/50 p-2 rounded border border-slate-700 my-2">
            <WaterfallItem
              label="Floor Price (Break-even)"
              value={result.floorPrice}
              highlight
              color="text-slate-300"
              formula={t.tooltip_formula_floorPrice}
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 pl-2 mt-1">
              <span>+ Cost of Capital (Hurdle)</span>
              <span>+{result.capitalCharge.toFixed(2)}%</span>
            </div>
            {result.capitalIncome != null && result.capitalIncome > 0 && (
              <div className="flex items-center justify-between text-[10px] text-emerald-500 pl-2 mt-0.5">
                <span>- Capital Income (Risk-Free)</span>
                <span className="font-mono">-{result.capitalIncome.toFixed(3)}%</span>
              </div>
            )}
            {result.esgDnshCapitalAdj != null && result.esgDnshCapitalAdj > 0 && (
              <div className="flex items-center justify-between text-[10px] text-emerald-500 pl-2 mt-0.5">
                <span>- DNSH Capital Discount</span>
                <span className="font-mono">-{result.esgDnshCapitalAdj.toFixed(3)}%</span>
              </div>
            )}
            {result.esgPillar1Adj != null && result.esgPillar1Adj > 0 && (
              <div className="flex items-center justify-between text-[10px] text-emerald-500 pl-2 mt-0.5">
                <span>- ISF Pillar I (Art. 501a)</span>
                <span className="font-mono">-{result.esgPillar1Adj.toFixed(3)}%</span>
              </div>
            )}
            <WaterfallItem
              label={`Technical Price (ROE ${deal.targetROE}%)`}
              value={result.technicalPrice}
              highlight
              color="text-cyan-300"
              formula={t.tooltip_formula_technicalPrice}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">Net Economic Profit</div>
            <div className={`font-mono font-bold ${result.economicProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {result.economicProfit >= 0 ? '+' : ''}
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(result.economicProfit)}
            </div>
          </div>
        </div>

        {/* Save as Deal + Auto-save indicator */}
        <div data-tour="save-deal" className="border-t border-slate-700 bg-slate-900 p-3 flex items-center gap-2">
          <button
            data-testid="save-deal-btn"
            onClick={handleSaveAsDeal}
            disabled={dealSaveStatus === 'saving' || validationErrors.length > 0}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              validationErrors.length > 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : dealSaveStatus === 'saved' ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {dealSaveStatus === 'saved' ? (
              <Check size={14} />
            ) : dealSaveStatus === 'saving' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FilePlus size={14} />
            )}
            {dealSaveStatus === 'saved'
              ? 'Deal Saved to Blotter'
              : dealSaveStatus === 'saving'
                ? 'Saving...'
                : 'Save as Deal'}
          </button>
          <button
            onClick={handleExportReceipt}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            title="Print / Save as PDF"
          >
            <FileDown size={14} /> PDF
          </button>
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <Save size={10} /> Auto-saved
            </div>
          )}
        </div>

        {/* Accounting Toggle */}
        <div className="border-t border-slate-700 bg-slate-900 p-2">
          <button
            onClick={() => setShowAccounting(!showAccounting)}
            className="w-full flex items-center justify-between p-2 text-xs text-slate-400 hover:bg-slate-800 rounded transition-colors"
          >
            <span className="flex items-center gap-2 font-mono uppercase font-bold">
              {showAccounting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              GL Posting Preview
            </span>
            <Badge variant="default">GL: 102-393</Badge>
          </button>

          {showAccounting && (
            <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-12 gap-2 text-slate-300">
                <div className="col-span-1 text-slate-500">DR</div>
                <div className="col-span-5">{result.accountingEntry.source}</div>
                <div className="col-span-2 text-right text-slate-500">EXP</div>
                <div className="col-span-4 text-right">{fmtCurrency(result.accountingEntry.amountDebit)}</div>
              </div>
              <div className="grid grid-cols-12 gap-2 text-slate-300">
                <div className="col-span-1 text-slate-500">CR</div>
                <div className="col-span-5">{result.accountingEntry.dest}</div>
                <div className="col-span-2 text-right text-slate-500">INC</div>
                <div className="col-span-4 text-right">{fmtCurrency(result.accountingEntry.amountCredit)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

const WaterfallItem: React.FC<{
  label: string;
  value: number;
  subtext?: string;
  isAdd?: boolean;
  highlight?: boolean;
  color?: string;
  weight?: string;
  compact?: boolean;
  icon?: React.ReactNode;
  formula?: string;
}> = ({ label, value, subtext, isAdd, highlight, color = 'text-slate-200', weight, compact, icon, formula }) => (
  <div className={`flex items-center justify-between ${highlight ? 'py-1' : 'py-0.5'} ${compact ? 'opacity-80' : ''}`}>
    <div>
      <div className={`text-xs ${highlight ? 'font-bold text-white' : 'font-medium text-slate-400'} flex items-center`}>
        {icon && icon}
        {label}
        {formula && <TooltipTrigger content={formula} variant="formula" placement="right" size={11} />}
      </div>
      {subtext && <div className="text-[10px] text-slate-600 font-mono">{subtext}</div>}
    </div>
    <div className={`${weight || 'font-mono'} font-bold ${color} ${highlight ? 'text-sm' : 'text-xs'}`}>
      {isAdd && value > 0 ? '+' : ''}
      {value.toFixed(3)}%
    </div>
  </div>
);

export default PricingReceipt;
