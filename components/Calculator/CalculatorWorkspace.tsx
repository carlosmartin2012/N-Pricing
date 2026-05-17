import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { calculatePricing } from '@npricing/pricing-core';
import type { Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
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

  const canWriteRemotely = canPersistRemotely({
    dataMode: data.dataMode,
    isSupabaseConfigured,
  });
  const [matchedMethod, setMatchedMethod] = useState('Matched Maturity');

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
        if (typeof window !== 'undefined') {
          window.alert(err instanceof Error ? err.message : t.attributionApprovalRequestFailed);
        }
      }
    },
    [approvalMatrix, canWriteRemotely, currentResult, data, dealParams, navigate, setDealParams, t]
  );

  return (
    <ErrorBoundary fallbackMessage="Pricing calculator encountered an error">
      <div className="relative z-0 w-full">
        {/* Live cursors (Ola 7 B) — global mousemove broadcast filtered by viewport='CALCULATOR'.
           Overlay is pointer-events-none. Only rendered when the channel is active. */}
        {cursorsActive && <LiveCursorOverlay cursors={cursors} />}

        {/* Landing insights — pivot §Bloque G */}
        <Suspense fallback={null}>
          <div className="mb-4">
            <PricingInsightsWidget deals={deals} />
          </div>
        </Suspense>

        {/* Recommendation panel — pivot §Bloque E (EV-optimal, floor, commercial) */}
        {currentResult && (
          <Suspense fallback={null}>
            <div className="mb-4">
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
            </div>
          </Suspense>
        )}

        {/* Attribution Simulator — Ola 8 Bloque B. Widget contextual: el comercial
          ve quién tiene atribución sobre el quote actual + simula bajadas/subidas
          para encontrar el sweet-spot de aprobación. Recálculo cliente-side; el
          motor puro de utils/attributions/ corre el mismo código que el server.
          Handlers cableados (Ola 10 Bloque C cierre): onApply genera un
          pricing_snapshot y pre-llena el calculator; onRequestApproval crea una
          decision 'escalated' que dispara push notif al approver. */}
        {currentResult && (
          <Suspense fallback={null}>
            <div className="mb-4">
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
                  // Aplica el delta de margen al deal actual — el comercial
                  // sigue iterando en el calculator con los nuevos parámetros.
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
            </div>
          </Suspense>
        )}

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="flex h-full w-full min-h-0 flex-col lg:col-span-4">
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

          <div data-tour="methodology-panel" className="flex h-full w-full min-h-0 flex-col lg:col-span-4">
            <Suspense
              fallback={
                <div className="h-full min-h-[320px] animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />
              }
            >
              <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
            </Suspense>
          </div>

          <div data-tour="pricing-receipt" className="flex h-full w-full min-h-0 flex-col lg:col-span-4">
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

          {/* Customer 360 — relationship context for the approval/analysis flow */}
          {dealParams.clientId && (
            <>
              <div data-tour="customer-360-panel" className="w-full lg:col-span-8">
                <Suspense fallback={<div className="h-40 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
                  <CustomerRelationshipPanel clientId={dealParams.clientId} />
                </Suspense>
              </div>
              <div data-tour="ltv-impact-panel" className="w-full lg:col-span-4">
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
            </>
          )}

          {/* Phase 1: IFRS 9 Stage/SICR + Cross-bonuses inputs */}
          <div className="w-full lg:col-span-6">
            <IFRS9StagePanel deal={dealParams} onChange={handleIFRS9Change} />
          </div>
          <div className="w-full lg:col-span-6">
            <CrossBonusesPicker attachments={dealParams.crossBonusAttachments ?? []} onChange={handleBonusesChange} />
          </div>

          {/* Phase 1: Inverse Optimizer + Delegation Audit side-by-side */}
          <div className="w-full lg:col-span-6">
            <InverseOptimizerPanel
              deal={dealParams}
              currentRaroc={currentResult?.raroc ?? 0}
              targetRoe={dealParams.targetROE}
              onApplyMargin={handleApplyMargin}
            />
          </div>
          <div className="w-full lg:col-span-6">
            {currentResult && <DelegationAuditPanel deal={dealParams} result={currentResult} />}
          </div>

          {/* Phase 1: Waterfall Explainer (full width) */}
          <div className="w-full lg:col-span-12">
            {currentResult && (
              <WaterfallExplainerCard
                deal={dealParams}
                result={currentResult}
                language={language === 'es' ? 'es' : 'en'}
              />
            )}
          </div>

          {/* Phase 2: Bitemporal Lineage Panel (full width) */}
          <div className="w-full lg:col-span-12">
            {currentResult && <LineagePanel deal={dealParams} result={currentResult} />}
          </div>

          <div className="w-full lg:col-span-9">
            <Suspense fallback={<div className="h-24 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
              <PricingComparison baseDeal={dealParams} approvalMatrix={approvalMatrix} />
            </Suspense>
          </div>
          <div className="w-full lg:col-span-3">
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
      </div>
    </ErrorBoundary>
  );
};
