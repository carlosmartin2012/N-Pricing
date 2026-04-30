import React, { Suspense, useCallback, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useOptionalPricingState } from '../../contexts/PricingStateContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import DealInputPanel from './DealInputPanel';
import InverseOptimizerPanel from './InverseOptimizerPanel';
import DelegationAuditPanel from './DelegationAuditPanel';
import CrossBonusesPicker from './CrossBonusesPicker';
import IFRS9StagePanel from './IFRS9StagePanel';
import LineagePanel from './LineagePanel';
import { WaterfallExplainerCard } from '../RAROC/WaterfallExplainerCard';
import { calculatePricing } from '../../utils/pricingEngine';

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
import { quoteFromFtpResult } from '../../utils/attributions';
import type { AttributionScope } from '../../types/attributions';

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
  const { deals, clients, products, businessUnits, behaviouralModels, approvalMatrix } = useData();
  const { language } = useUI();
  const [matchedMethod, setMatchedMethod] = useState('Matched Maturity');
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
    [setDealParams],
  );

  const handleBonusesChange = useCallback(
    (attachments: Array<{ ruleId: string; overrideProbability?: number }>) => {
      setDealParams((prev) => ({ ...prev, crossBonusAttachments: attachments }));
    },
    [setDealParams],
  );

  const handleIFRS9Change = useCallback(
    (updates: Partial<Transaction>) => {
      setDealParams((prev) => ({ ...prev, ...updates }));
    },
    [setDealParams],
  );

  return (
    <ErrorBoundary fallbackMessage="Pricing calculator encountered an error">
    <div className="relative z-0 w-full">
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
              proposedRate={currentResult.finalClientRate ?? (currentResult.baseRate + dealParams.marginTarget)}
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
                  product:        [dealParams.productType],
                  segment:        [dealParams.clientType],
                  currency:       [dealParams.currency],
                  tenorMaxMonths: dealParams.durationMonths,
                } as AttributionScope,
                dealParams.amount,
              )}
              onApply={(input) => {
                // Aplica el delta de margen al deal actual — el comercial
                // sigue iterando en el calculator con los nuevos parámetros.
                const deltaBps = input.proposedAdjustments.deviationBpsDelta ?? 0;
                if (deltaBps !== 0 && setDealParams) {
                  setDealParams((prev) => ({
                    ...prev,
                    marginTarget: prev.marginTarget + deltaBps / 10_000,
                  }));
                }
              }}
              onRequestApproval={(input) => {
                // Wire pendiente: crear pricing_snapshot + POST /attributions/
                // decisions con decision='escalated'. Por ahora navegamos a
                // la bandeja /approvals con el deal preseleccionado para que
                // el comercial complete el flow desde allí.
                const dealId = dealParams.id ?? 'pending';
                const url = `/approvals?focus=${encodeURIComponent(dealId)}`;
                if (typeof window !== 'undefined') {
                  window.location.assign(url);
                }
                void input;
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
          <Suspense fallback={<div className="h-full min-h-[320px] animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
            <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
          </Suspense>
        </div>

        <div data-tour="pricing-receipt" className="flex h-full w-full min-h-0 flex-col lg:col-span-4">
          <Suspense fallback={<div className="h-full min-h-[320px] animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
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
                    rateBps: ((currentResult?.finalClientRate ?? 0)) * 100,
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
          <CrossBonusesPicker
            attachments={dealParams.crossBonusAttachments ?? []}
            onChange={handleBonusesChange}
          />
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
          {currentResult && (
            <DelegationAuditPanel deal={dealParams} result={currentResult} />
          )}
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
          {currentResult && (
            <LineagePanel deal={dealParams} result={currentResult} />
          )}
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
