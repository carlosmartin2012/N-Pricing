import React, { Suspense, useCallback, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
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
import { ScenarioLibraryPanel } from './ScenarioLibraryPanel';
import { DEFAULT_PRICING_SCENARIOS, type PricingScenario } from './pricingComparisonUtils';

interface Props {
  dealParams: Transaction;
  setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
}

export const CalculatorWorkspace: React.FC<Props> = ({
  dealParams,
  setDealParams,
}) => {
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
          <div data-tour="customer-360-panel" className="w-full lg:col-span-12">
            <Suspense fallback={<div className="h-40 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
              <CustomerRelationshipPanel clientId={dealParams.clientId} />
            </Suspense>
          </div>
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
