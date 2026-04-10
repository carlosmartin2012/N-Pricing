import React, { Suspense, useCallback, useMemo } from 'react';
import type {
  ApprovalMatrixConfig,
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';
import type { Language } from '../../translations';
import DealInputPanel from './DealInputPanel';
import MethodologyVisualizer from './MethodologyVisualizer';
import PricingReceipt from './PricingReceipt';
import InverseOptimizerPanel from './InverseOptimizerPanel';
import DelegationAuditPanel from './DelegationAuditPanel';
import { WaterfallExplainerCard } from '../RAROC/WaterfallExplainerCard';
import { calculatePricing } from '../../utils/pricingEngine';

const PricingComparison = React.lazy(() => import('./PricingComparison'));

interface Props {
  dealParams: Transaction;
  setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
  matchedMethod: string;
  setMatchedMethod: React.Dispatch<React.SetStateAction<string>>;
  deals: Transaction[];
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  behaviouralModels: BehaviouralModel[];
  approvalMatrix: ApprovalMatrixConfig;
  language: Language;
}

export const CalculatorWorkspace: React.FC<Props> = ({
  dealParams,
  setDealParams,
  matchedMethod,
  setMatchedMethod,
  deals,
  clients,
  products,
  businessUnits,
  behaviouralModels,
  approvalMatrix,
  language,
}) => {
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

  return (
    <div className="relative z-0 flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-12">
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
          <MethodologyVisualizer deal={dealParams} matchedMethod={matchedMethod} />
        </div>

        <div data-tour="pricing-receipt" className="flex h-full w-full min-h-0 flex-col lg:col-span-4">
          <PricingReceipt
            deal={dealParams}
            setMatchedMethod={setMatchedMethod}
            approvalMatrix={approvalMatrix}
            language={language}
            onDealSaved={(savedDeal) => {
              setDealParams(savedDeal);
            }}
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
              language={language}
            />
          )}
        </div>

        <div className="w-full lg:col-span-12">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-[24px] bg-[var(--nfq-bg-surface)]" />}>
            <PricingComparison baseDeal={dealParams} approvalMatrix={approvalMatrix} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
