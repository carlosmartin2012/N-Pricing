import React, { useEffect, useMemo, useState } from 'react';
import type {
  ApprovalMatrixConfig,
  CreditRiskResult,
  FTPResult,
  Transaction,
} from '../../types';
import { calculateFullCreditRisk } from '../../utils/pricing/creditRiskEngine';
import {
  calculatePricing,
  DEFAULT_PRICING_SHOCKS,
  type PricingShocks,
} from '../../utils/pricingEngine';
import { validateDeal, type ValidationError } from '../../utils/validation';
import { Panel } from '../ui/LayoutComponents';
import { AccessibleLiveRegion } from '../ui/AccessibleLiveRegion';
import { translations, type Language } from '../../translations';
import { usePricingContext } from '../../hooks/usePricingContext';
import {
  PricingReceiptAccountingPanel,
  PricingReceiptFooter,
  PricingReceiptSummary,
} from './PricingReceiptChrome';
import { PricingReceiptWaterfall } from './PricingReceiptWaterfall';
import { usePricingReceiptActions } from './hooks/usePricingReceiptActions';

interface Props {
  deal: Transaction;
  setMatchedMethod: (methodology: string) => void;
  approvalMatrix: ApprovalMatrixConfig;
  language: Language;
  shocks?: PricingShocks;
  onDealSaved?: (deal: Transaction) => void;
}

const VALIDATION_FAILED_RESULT: FTPResult = {
  baseRate: 0,
  liquiditySpread: 0,
  _liquidityPremiumDetails: 0,
  _clcChargeDetails: 0,
  strategicSpread: 0,
  optionCost: 0,
  regulatoryCost: 0,
  operationalCost: 0,
  capitalCharge: 0,
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  esgGreeniumAdj: 0,
  esgDnshCapitalAdj: 0,
  esgPillar1Adj: 0,
  floorPrice: 0,
  technicalPrice: 0,
  targetPrice: 0,
  totalFTP: 0,
  finalClientRate: 0,
  raroc: 0,
  economicProfit: 0,
  approvalLevel: 'Rejected',
  matchedMethodology: '',
  matchReason: '',
  accountingEntry: { source: '-', dest: '-', amountDebit: 0, amountCredit: 0 },
};

const PricingReceipt: React.FC<Props> = ({
  deal,
  setMatchedMethod,
  approvalMatrix,
  language,
  shocks,
  onDealSaved,
}) => {
  const [showAccounting, setShowAccounting] = useState(false);
  const [showCreditDetail, setShowCreditDetail] = useState(false);
  const [applyShocks, setApplyShocks] = useState(false);
  const t = translations[language];
  const pricingContext = usePricingContext();
  const activeScenarioShocks = applyShocks && shocks ? shocks : DEFAULT_PRICING_SHOCKS;

  const validationErrors: ValidationError[] = useMemo(() => {
    const { errors } = validateDeal(deal);
    return errors;
  }, [deal]);

  const result: FTPResult = useMemo(() => {
    if (validationErrors.length > 0) {
      return VALIDATION_FAILED_RESULT;
    }
    return calculatePricing(
      deal,
      approvalMatrix,
      pricingContext,
      activeScenarioShocks
    );
  }, [
    activeScenarioShocks,
    approvalMatrix,
    deal,
    pricingContext,
    validationErrors,
  ]);

  // Sync matched methodology to parent — kept outside useMemo to avoid
  // side effects during render (React anti-pattern).
  useEffect(() => {
    if (result.matchedMethodology) {
      setMatchedMethod(result.matchedMethodology);
    }
  }, [result.matchedMethodology, setMatchedMethod]);

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
          deal.collateralType &&
          deal.collateralType !== 'None' &&
          deal.haircutPct &&
          deal.haircutPct > 0
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

  const { dealSaveStatus, handleExportReceipt, handleSaveAsDeal, saveStatus } =
    usePricingReceiptActions({
      deal,
      result,
      approvalMatrix,
      activeScenarioShocks,
      validationErrors,
      onDealSaved,
    });

  const pricingAnnouncement =
    validationErrors.length > 0
      ? 'Pricing calculation failed: validation errors'
      : `FTP Rate calculated: ${result.totalFTP.toFixed(2)}%, Final Client Rate: ${result.finalClientRate.toFixed(2)}%`;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: deal.currency,
    }).format(value);

  return (
    <Panel
      title={t.pricingResult || 'Profitability & Pricing Construction'}
      className="h-full"
    >
      <AccessibleLiveRegion message={pricingAnnouncement} />
      <div data-testid="pricing-receipt" className="flex h-full flex-col">
        <PricingReceiptSummary
          approvalMatrix={approvalMatrix}
          customerRateLabel={t.customerRate}
          deal={deal}
          result={result}
        />

        <PricingReceiptWaterfall
          applyShocks={applyShocks}
          creditDetail={creditDetail}
          deal={deal}
          onToggleCreditDetail={() => setShowCreditDetail((previous) => !previous)}
          onToggleShocks={() => setApplyShocks((previous) => !previous)}
          result={result}
          shocks={shocks}
          showCreditDetail={showCreditDetail}
          t={t}
          validationErrors={validationErrors}
        />

        <PricingReceiptFooter
          dealSaveStatus={dealSaveStatus}
          onExportReceipt={handleExportReceipt}
          onSaveAsDeal={() => {
            void handleSaveAsDeal();
          }}
          saveStatus={saveStatus}
          validationErrorCount={validationErrors.length}
        />

        <PricingReceiptAccountingPanel
          accountingEntry={result.accountingEntry}
          currencyFormatter={formatCurrency}
          onToggle={() => setShowAccounting((previous) => !previous)}
          showAccounting={showAccounting}
        />
      </div>
    </Panel>
  );
};

export default PricingReceipt;
