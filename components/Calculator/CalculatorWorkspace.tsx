import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { calculatePricing } from '@npricing/pricing-core';
import type { Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useToast } from '../ui/Toast';
import { useOptionalPricingState } from '../../contexts/PricingStateContext';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import DealInputPanel from './DealInputPanel';
import InverseOptimizerPanel from './InverseOptimizerPanel';
import DelegationAuditPanel from './DelegationAuditPanel';
import CrossBonusesPicker from './CrossBonusesPicker';
import IFRS9StagePanel from './IFRS9StagePanel';
import LineagePanel from './LineagePanel';
import { WaterfallExplainerCard } from '../RAROC/WaterfallExplainerCard';
import { DealFlowRail } from './DealFlowRail';
import { PricingDriversSummary } from './PricingDriversSummary';

const MethodologyVisualizer = React.lazy(() => import('./MethodologyVisualizer'));
const PricingReceipt = React.lazy(() => import('./PricingReceipt'));
const PricingComparison = React.lazy(() => import('./PricingComparison'));
const CalculatorRecommendationPanel = React.lazy(() => import('./CalculatorRecommendationPanel'));
const PricingInsightsWidget = React.lazy(() => import('./PricingInsightsWidget'));
const CustomerRelationshipPanel = React.lazy(() => import('../Customer360/CustomerRelationshipPanel'));
const LtvImpactPanel = React.lazy(() => import('../Customer360/LtvImpactPanel'));
const AttributionSimulator = React.lazy(() => import('../Attributions/AttributionSimulator'));
import { ScenarioLibraryPanel } from './ScenarioLibraryPanel';
import { DEFAULT_PRICING_SCENARIOS, type PricingScenario } from './pricingComparisonUtils';
import LiveCursorOverlay from '../ui/LiveCursorOverlay';
import { useLiveCursors } from '../../hooks/useLiveCursors';
import { quoteFromFtpResult } from '../../utils/attributions';
import * as dealsApi from '../../api/deals';
import * as attributionsApi from '../../api/attributions';
import { canPersistRemotely } from '../../utils/dataModeUtils';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import type { AttributionScope, SimulationInput } from '../../types/attributions';

interface Props {
  /** Optional — if omitted, reads from PricingStateContext. Required for
   *  callers not wrapped by <PricingStateProvider>. */
  dealParams?: Transaction;
  setDealParams?: React.Dispatch<React.SetStateAction<Transaction>>;
}

export const CalculatorWorkspace: React.FC<Props> = ({
  dealParams: dealParamsProp,
  setDealParams: setDealParamsProp,
}) => {
  // Props win over context — preserves behaviour for tests that pass props
  // without a provider. When both are absent, fall back to throwing via the
  // strict hook so the regression is visible.
  const ctx = useOptionalPricingState();
  const dealParams = dealParamsProp ?? ctx?.dealParams;
  const setDealParams = setDealParamsProp ?? ctx?.setDealParams;
  if (!dealParams || !setDealParams) {
    throw new Error('CalculatorWorkspace: no dealParams available (pass as prop or wrap in <PricingStateProvider>)');
  }
  const data = useData();
  const navigate = useNavigate();
  const { deals, clients, products, businessUnits, behaviouralModels, approvalMatrix } = data;
  const { language, t } = useUI();
  const { currentUser } = useAuth();
  const { addToast } = useToast();

  const canWriteRemotely = canPersistRemotely({
    dataMode: data.dataMode,
    isSupabaseConfigured,
  });
  const [matchedMethod, setMatchedMethod] = useState('Matched Maturity');

  // Progressive disclosure: collapse non-primary panels behind two toggles
  // persisted in localStorage. Primary (Quote) is always rendered — secondary
  // (Context, default open) and tertiary (Optimization, default closed) cut
  // the page from ~5000px to ~1300px in the default Quote+Context state.
  type CalcDisclosure = { context: boolean; optimization: boolean };
  const DISCLOSURE_KEY = 'n_pricing_calc_disclosure';
  const [disclosure, setDisclosure] = useState<CalcDisclosure>(() => {
    if (typeof window === 'undefined') return { context: true, optimization: false };
    try {
      const raw = window.localStorage.getItem(DISCLOSURE_KEY);
      if (!raw) return { context: true, optimization: false };
      const parsed = JSON.parse(raw) as Partial<CalcDisclosure>;
      return {
        context: typeof parsed.context === 'boolean' ? parsed.context : true,
        optimization: typeof parsed.optimization === 'boolean' ? parsed.optimization : false,
      };
    } catch {
      return { context: true, optimization: false };
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DISCLOSURE_KEY, JSON.stringify(disclosure));
    } catch {
      // Silent ignore — preference persistence is best-effort.
    }
  }, [disclosure]);

  // Live cursors (Ola 7 B) — viewport 'CALCULATOR'
  const { cursors, active: cursorsActive } = useLiveCursors({
    enabled: isSupabaseConfigured && data.dataMode !== 'demo' && !!currentUser,
    userId: currentUser?.id ?? 'anonymous',
    name: currentUser?.name ?? currentUser?.email ?? 'Usuario',
    viewport: 'CALCULATOR',
  });

  const handleParamChange = useCallback(
    (key: keyof Transaction, value: Transaction[keyof Transaction] | undefined) => {
      setDealParams((previousDeal) => ({ ...previousDeal, [key]: value }));
    },
    [setDealParams]
  );

  // Live pricing for the new Phase 1 panels (inverse optimizer + delegation)
  const currentResult = useMemo(() => {
    try {
      return calculatePricing(dealParams, approvalMatrix);
    } catch {
      return null;
    }
  }, [dealParams, approvalMatrix]);

  const handleApplyMargin = useCallback(
    (newMargin: number) => {
      setDealParams((prev) => ({ ...prev, marginTarget: newMargin }));
    },
    [setDealParams]
  );

  const handleBonusesChange = useCallback(
    (attachments: Array<{ ruleId: string; overrideProbability?: number }>) => {
      setDealParams((prev) => ({ ...prev, crossBonusAttachments: attachments }));
    },
    [setDealParams]
  );

  const handleIFRS9Change = useCallback(
    (updates: Partial<Transaction>) => {
      setDealParams((prev) => ({ ...prev, ...updates }));
    },
    [setDealParams]
  );

  const handleRequestAttributionApproval = useCallback(
    async (input: SimulationInput) => {
      if (!currentResult) return;
      try {
        const dealId = dealParams.id || `DL-${Date.now().toString(36).toUpperCase()}`;
        const deltaBps = input.proposedAdjustments.deviationBpsDelta ?? 0;
        const adjustedDeal: Transaction = {
          ...dealParams,
          id: dealId,
          status: 'Pending_Approval',
          marginTarget: dealParams.marginTarget + deltaBps / 100,
          liquiditySpread: currentResult.liquiditySpread,
          _liquidityPremiumDetails: currentResult._liquidityPremiumDetails,
          _clcChargeDetails: currentResult._clcChargeDetails,
        };
        const adjustedResult = {
          ...currentResult,
          finalClientRate: input.quote.finalClientRateBps / 100,
          targetPrice: input.quote.standardRateBps / 100,
          floorPrice: input.quote.hardFloorRateBps / 100,
          raroc: input.quote.rarocPp,
        };

        const persistedDeal = canWriteRemotely ? await dealsApi.upsertDeal(adjustedDeal) : null;
        const resolvedDeal = persistedDeal || adjustedDeal;
        data.setDeals((previous) => {
          const exists = previous.some((item) => item.id === resolvedDeal.id);
          return exists
            ? previous.map((item) => (item.id === resolvedDeal.id ? resolvedDeal : item))
            : [...previous, resolvedDeal];
        });
        setDealParams(resolvedDeal);

        if (canWriteRemotely && resolvedDeal.id) {
          await attributionsApi.requestEscalation(resolvedDeal.id, {
            quote: input.quote,
            proposedAdjustments: input.proposedAdjustments,
            deal: resolvedDeal,
            pricingResult: adjustedResult,
            approvalMatrix,
            reason: 'Requested from Calculator Attribution Simulator',
          });
        }

        if (resolvedDeal.id) {
          navigate(`/approvals?focus=${encodeURIComponent(resolvedDeal.id)}`);
        }
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : t.attributionApprovalRequestFailed);
      }
    },
    [addToast, approvalMatrix, canWriteRemotely, currentResult, data, dealParams, navigate, setDealParams, t]
  );

  return (
    <ErrorBoundary fallbackMessage="Pricing calculator encountered an error">
      <div className="relative z-0 w-full">
        {/* Live cursors (Ola 7 B) — global mousemove broadcast filtered by viewport='CALCULATOR' */}
        {cursorsActive && <LiveCursorOverlay cursors={cursors} />}

        {/* Small floating indicator when other users have active cursors */}
        {cursorsActive && cursors.length > 0 && (
          <div className="pointer-events-none absolute right-3 top-3 z-[70] rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-mono text-white shadow">
            {cursors.length} live
          </div>
        )}

        {/* QUOTE — always visible primary work surface. The DealFlowRail
            shows the deal lifecycle indicator; the pricing drivers summary
            surfaces the headline contributors as soon as the engine has a
            result; and the 3-column input → methodology → receipt row is the
            core action area. PricingReceipt is sticky on desktop so the
            RAROC + CTA stay visible while the user scrolls Context and
            Optimization sections. */}
        <section aria-labelledby="calc-group-quote" className="space-y-4">
          <h2 id="calc-group-quote" className="sr-only">{t.calcGroupQuote}</h2>

          <DealFlowRail
            deal={dealParams}
            result={currentResult}
            labels={{
              title: t.dealFlowTitle,
              quote: t.dealFlowQuote,
              dossier: t.dealFlowDossier,
              approval: t.dealFlowApproval,
              timeline: t.dealFlowTimeline,
              savedRequired: t.dealFlowSavedRequired,
            }}
          />

          {currentResult && (
            <PricingDriversSummary
              result={currentResult}
              labels={{
                title: t.pricingDriversTitle,
                subtitle: t.pricingDriversSubtitle,
                baseRate: t.pricingDriverBaseRate,
                liquidity: t.pricingDriverLiquidity,
                capital: t.pricingDriverCapital,
                credit: t.pricingDriverCredit,
                operational: t.pricingDriverOperational,
                esg: t.pricingDriverEsg,
              }}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
            <div className="flex h-full w-full min-w-0 min-h-0 flex-col lg:col-span-4">
              <DealInputPanel
                values={dealParams}
                onChange={handleParamChange}
                setDealParams={setDealParams}
                deals={deals}
                clients={clients}
                products={products}
                businessUnits={businessUnits}
                language={language}
                behaviouralModels={behaviouralModels}
              />
            </div>

            <div data-tour="methodology-panel" className="flex h-full w-full min-w-0 min-h-0 flex-col lg:col-span-4">
              <Suspense
                fallback={
                  <div className="h-full min-h-[320px] animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />
                }
              >
                <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
              </Suspense>
            </div>

            <div
              data-tour="pricing-receipt"
              className="flex h-full w-full min-w-0 min-h-0 flex-col lg:col-span-4 lg:sticky lg:top-2 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
            >
              <Suspense
                fallback={
                  <div className="h-full min-h-[320px] animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />
                }
              >
                <PricingReceipt
                  deal={dealParams}
                  setMatchedMethod={setMatchedMethod}
                  approvalMatrix={approvalMatrix}
                  language={language}
                  onDealSaved={(savedDeal) => {
                    setDealParams(savedDeal);
                  }}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Disclosure toggle — controls the two secondary groups so the
            user can hide everything below the quote surface in 1 click. */}
        <div className="my-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="nfq-label mr-1 text-[10px] text-[color:var(--nfq-text-muted)]">
            {t.calcGroupHint}
          </span>
          <button
            type="button"
            onClick={() => setDisclosure((prev) => ({ ...prev, context: !prev.context }))}
            aria-pressed={disclosure.context}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              disclosure.context
                ? 'bg-[var(--nfq-accent)]/10 text-[color:var(--nfq-accent)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.35)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {disclosure.context ? '✓ ' : '+ '}
            {t.calcGroupContext}
          </button>
          <button
            type="button"
            onClick={() => setDisclosure((prev) => ({ ...prev, optimization: !prev.optimization }))}
            aria-pressed={disclosure.optimization}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              disclosure.optimization
                ? 'bg-[var(--nfq-accent)]/10 text-[color:var(--nfq-accent)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.35)]'
                : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {disclosure.optimization ? '✓ ' : '+ '}
            {t.calcGroupOptimization}
          </button>
        </div>

        {/* CONTEXT — secondary surface: recommendation, customer relationship,
            credit/cross-bonus inputs. Default open. */}
        {disclosure.context && (
          <section aria-labelledby="calc-group-context" className="space-y-4">
            <h2 id="calc-group-context" className="sr-only">{t.calcGroupContext}</h2>

            {currentResult && (
              <Suspense fallback={null}>
                <CalculatorRecommendationPanel
                  deal={dealParams}
                  deals={deals}
                  ftp={currentResult.baseRate + (currentResult.liquiditySpread ?? 0)}
                  capitalCharge={currentResult.capitalCharge ?? 0}
                  regulatoryCost={currentResult.regulatoryCost ?? 0}
                  raroc={currentResult.raroc ?? 0}
                  hurdleRate={dealParams.targetROE}
                  proposedRate={currentResult.finalClientRate ?? currentResult.baseRate + dealParams.marginTarget}
                />
              </Suspense>
            )}

            {dealParams.clientId && (
              <div className="grid gap-4 lg:grid-cols-12">
                <div data-tour="customer-360-panel" className="w-full min-w-0 lg:col-span-8">
                  <Suspense fallback={<div className="h-40 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
                    <CustomerRelationshipPanel clientId={dealParams.clientId} />
                  </Suspense>
                </div>
                <div data-tour="ltv-impact-panel" className="w-full min-w-0 lg:col-span-4">
                  <Suspense fallback={<div className="h-40 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
                    <LtvImpactPanel
                      clientId={dealParams.clientId}
                      candidate={{
                        productType: dealParams.productType,
                        currency: dealParams.currency,
                        amountEur: dealParams.amount,
                        tenorYears: (dealParams.durationMonths ?? 0) / 12,
                        rateBps: (currentResult?.finalClientRate ?? 0) * 100,
                        marginBps: (dealParams.marginTarget ?? 0) * 100,
                        capitalEur: dealParams.amount * (dealParams.capitalRatio ?? 0.08),
                        rarocAnnual: currentResult?.raroc ?? undefined,
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="w-full min-w-0 lg:col-span-6">
                <IFRS9StagePanel deal={dealParams} onChange={handleIFRS9Change} />
              </div>
              <div className="w-full min-w-0 lg:col-span-6">
                <CrossBonusesPicker attachments={dealParams.crossBonusAttachments ?? []} onChange={handleBonusesChange} />
              </div>
            </div>
          </section>
        )}

        {/* OPTIMIZATION — tertiary surface: attribution simulator, inverse
            margin, delegation audit, lineage, comparison, scenarios, landing
            insights. Default closed to cut page height in normal use. */}
        {disclosure.optimization && (
          <section aria-labelledby="calc-group-optimization" className="mt-5 space-y-4">
            <h2 id="calc-group-optimization" className="sr-only">{t.calcGroupOptimization}</h2>

            {currentResult && (
              <Suspense fallback={null}>
                <AttributionSimulator
                  compact
                  quote={quoteFromFtpResult(
                    currentResult,
                    {
                      product: [dealParams.productType],
                      segment: [dealParams.clientType],
                      currency: [dealParams.currency],
                      tenorMaxMonths: dealParams.durationMonths,
                    } as AttributionScope,
                    dealParams.amount
                  )}
                  onApply={(input) => {
                    const deltaBps = input.proposedAdjustments.deviationBpsDelta ?? 0;
                    if (deltaBps !== 0 && setDealParams) {
                      setDealParams((prev) => ({
                        ...prev,
                        marginTarget: prev.marginTarget + deltaBps / 100,
                      }));
                    }
                  }}
                  onRequestApproval={(input) => {
                    void handleRequestAttributionApproval(input);
                  }}
                />
              </Suspense>
            )}

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="w-full min-w-0 lg:col-span-6">
                <InverseOptimizerPanel
                  deal={dealParams}
                  currentRaroc={currentResult?.raroc ?? 0}
                  targetRoe={dealParams.targetROE}
                  onApplyMargin={handleApplyMargin}
                />
              </div>
              <div className="w-full min-w-0 lg:col-span-6">
                {currentResult && <DelegationAuditPanel deal={dealParams} result={currentResult} />}
              </div>
            </div>

            {currentResult && (
              <WaterfallExplainerCard
                deal={dealParams}
                result={currentResult}
                language={language === 'es' ? 'es' : 'en'}
              />
            )}

            {currentResult && <LineagePanel deal={dealParams} result={currentResult} />}

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="w-full min-w-0 lg:col-span-9">
                <Suspense fallback={<div className="h-24 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
                  <PricingComparison baseDeal={dealParams} approvalMatrix={approvalMatrix} />
                </Suspense>
              </div>
              <div className="w-full min-w-0 lg:col-span-3">
                <ScenarioLibraryPanel
                  currentScenarios={DEFAULT_PRICING_SCENARIOS}
                  onLoadScenario={(scenario: PricingScenario) => {
                    if (scenario.overrides.marginTarget != null) {
                      setDealParams((prev) => ({ ...prev, marginTarget: scenario.overrides.marginTarget! }));
                    }
                  }}
                />
              </div>
            </div>

            <Suspense fallback={null}>
              <PricingInsightsWidget deals={deals} />
            </Suspense>
          </section>
        )}
      </div>
    </ErrorBoundary>
  );
};
