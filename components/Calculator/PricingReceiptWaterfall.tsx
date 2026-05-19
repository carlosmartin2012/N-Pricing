import React from 'react';
import type { CreditRiskResult, FTPResult, Transaction } from '../../types';
import type { PricingShocks } from '@npricing/pricing-core';
import type { ValidationError } from '../../utils/validation';
import { TooltipTrigger } from '../ui/Tooltip';
import { ChevronDown, ChevronUp, Droplets, XCircle, Zap } from 'lucide-react';
import { PricingReceiptCreditDetail } from './PricingReceiptCreditDetail';

interface PricingReceiptWaterfallProps {
  applyShocks: boolean;
  creditDetail: CreditRiskResult | null;
  deal: Transaction;
  onToggleCreditDetail: () => void;
  onToggleShocks: () => void;
  result: FTPResult;
  shocks?: PricingShocks;
  showCreditDetail: boolean;
  t: Record<string, string | undefined>;
  validationErrors: ValidationError[];
}

export function PricingReceiptWaterfall({
  applyShocks,
  creditDetail,
  deal,
  onToggleCreditDetail,
  onToggleShocks,
  result,
  shocks,
  showCreditDetail,
  t,
  validationErrors,
}: PricingReceiptWaterfallProps) {
  return (
    <>
      {shocks && (shocks.interestRate !== 0 || shocks.liquiditySpread !== 0) && (
        <div
          className={`mx-4 mt-4 flex items-center justify-between rounded-lg border p-3 transition-colors ${
            applyShocks
              ? 'border-[color:var(--nfq-warning)]/25 bg-[var(--nfq-warning)]/10'
              : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap size={16} className={applyShocks ? 'text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-text-muted)]'} />
            <div className="text-xs">
              <span
                className={`block font-bold ${applyShocks ? 'text-amber-700 dark:text-[color:var(--nfq-warning)]' : 'text-[color:var(--nfq-text-faint)]'}`}
              >
                {t.shockedScenario || 'Shocked Scenario'}
              </span>
              <span className="text-[10px] text-[color:var(--nfq-text-muted)]">
                {shocks.interestRate > 0 ? '+' : ''}
                {shocks.interestRate}bps IR, {shocks.liquiditySpread > 0 ? '+' : ''}
                {shocks.liquiditySpread}bps Liq.
              </span>
            </div>
          </div>
          <button
            onClick={onToggleShocks}
            className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${
              applyShocks ? 'bg-[var(--nfq-warning)] text-[color:var(--nfq-text-primary)] shadow-md' : 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-faint)] dark:bg-[var(--nfq-bg-highest)]'
            }`}
          >
            {applyShocks ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-[color:var(--nfq-danger)]/25 bg-[var(--nfq-danger)]/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <XCircle size={14} className="shrink-0 text-[color:var(--nfq-danger)]" />
            <span className="text-xs font-medium text-[color:var(--nfq-danger)]">Validation Errors</span>
          </div>
          <ul className="space-y-0.5 pl-6">
            {validationErrors.map((error) => (
              <li key={error.field} className="text-[11px] text-[color:var(--nfq-danger)]">
                <span className="font-mono text-[color:var(--nfq-danger)]">{error.field}</span>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-auto bg-[var(--nfq-bg-surface)] p-4">
        {result.formulaUsed && (
          <div className="mb-3 rounded-lg border border-[color:var(--nfq-cat-d)]/50 bg-indigo-950/30 p-2">
            <div className="mb-1 text-[11px] font-medium text-[color:var(--nfq-cat-d)]">Applied Formula</div>
            <div className="font-mono text-xs text-[color:var(--nfq-cat-d)]">{result.formulaUsed}</div>
            {result.behavioralMaturityUsed != null &&
              deal.durationMonths != null &&
              result.behavioralMaturityUsed !== deal.durationMonths && (
                <div className="mt-1 text-[10px] text-[color:var(--nfq-cat-d)]">
                  BM={Math.round(result.behavioralMaturityUsed)}M vs DTM={deal.durationMonths}M
                </div>
              )}
          </div>
        )}

        <div className="mb-2 text-[11px] font-medium text-[color:var(--nfq-text-faint)]">Pricing Construction Flow</div>

        <div data-testid="receipt-base-rate">
          <WaterfallItem
            label="IRRBB — Base Rate"
            value={result.baseRate}
            color="text-[color:var(--nfq-text-secondary)]"
            formula={t.tooltip_formula_baseRate}
          />
        </div>

        <div className="mb-1 mt-3 border-t border-[color:var(--nfq-border-ghost)] pt-2">
          <WaterfallItem
            label={t.liquidityCost || 'Total Liquidity Spread'}
            value={result.liquiditySpread}
            isAdd
            color="text-[color:var(--nfq-warning)]"
            weight="font-mono font-bold"
            icon={<Droplets size={12} className="mr-2 inline text-amber-600" />}
            formula={t.tooltip_formula_liquidityPremium}
          />

          <div className="ml-5 mt-1 space-y-0.5 border-l border-[color:var(--nfq-border-ghost)] pl-3">
            <MiniMetric label="Liquidity Premium (LP)">
              {result._liquidityPremiumDetails >= 0 ? '+' : ''}
              {result._liquidityPremiumDetails.toFixed(3)}%
            </MiniMetric>
            <MiniMetric label="LCR Buffer Cost (CLC)">+{result._clcChargeDetails.toFixed(3)}%</MiniMetric>
            {result.nsfrCost != null && result.nsfrCost !== 0 && (
              <MiniMetric label={`NSFR ${result.nsfrCost < 0 ? 'Benefit' : 'Charge'}`}>
                {result.nsfrCost >= 0 ? '+' : ''}
                {result.nsfrCost.toFixed(3)}%
              </MiniMetric>
            )}
            {result.liquidityRecharge != null && result.liquidityRecharge !== 0 && (
              <MiniMetric label="Liquidity Recharge (LR)" tone="text-[color:var(--nfq-cat-d)]">
                +{result.liquidityRecharge.toFixed(3)}%
              </MiniMetric>
            )}
          </div>
        </div>

        <WaterfallItem
          label="Strategic Spread"
          value={result.strategicSpread}
          isAdd
          color="text-blue-600 dark:text-[color:var(--nfq-info)]"
          formula={t.tooltip_formula_strategicSpread}
        />

        {result.incentivisationAdj != null && result.incentivisationAdj !== 0 && (
          <WaterfallItem
            label="Incentivisation Adj."
            value={result.incentivisationAdj}
            isAdd
            color={result.incentivisationAdj < 0 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}
          />
        )}

        <div className="my-2 border-t border-dotted border-[color:var(--nfq-border)] opacity-60 dark:border-[color:var(--nfq-border-ghost)]" />

        <div data-testid="receipt-total-ftp">
          <WaterfallItem label={t.ftpRate || 'FTP Rate'} value={result.totalFTP} highlight />
        </div>

        <div className="ml-1 mt-2 space-y-1 border-l-2 border-[color:var(--nfq-border-ghost)] pl-2">
          <WaterfallItem
            label={`${t.anejo_creditProvision || 'Credit Provision'}${
              result.anejoSegment ? ` · ${result.anejoSegment.replace(/_/g, ' ')}` : ''
            }`}
            value={result.regulatoryCost}
            isAdd
            color="text-[color:var(--nfq-danger)]"
            formula={t.tooltip_formula_anejoCreditCost}
          />

          {creditDetail && (
            <div className="ml-2 mt-1">
              <button
                onClick={onToggleCreditDetail}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--nfq-text-faint)] transition-colors hover:text-[color:var(--nfq-text-secondary)]"
              >
                {showCreditDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {t.creditRiskDetail || 'Credit Risk Detail'}
              </button>

              {showCreditDetail && (
                <PricingReceiptCreditDetail
                  creditDetail={creditDetail}
                  currency={deal.currency}
                  durationMonths={deal.durationMonths}
                  t={t}
                />
              )}
            </div>
          )}

          <WaterfallItem label="Operational Cost" value={result.operationalCost} isAdd color="text-[color:var(--nfq-danger)]" />
          <WaterfallItem
            label="ESG Transition"
            value={result.esgTransitionCharge}
            isAdd
            color={result.esgTransitionCharge > 0 ? 'text-[color:var(--nfq-danger)]' : 'text-[color:var(--nfq-success)]'}
            formula={t.tooltip_formula_esgTransition}
          />
          <WaterfallItem
            label="ESG Physical"
            value={result.esgPhysicalCharge}
            isAdd
            color="text-[color:var(--nfq-danger)]"
            formula={t.tooltip_formula_esgPhysical}
          />
          {result.esgGreeniumAdj != null && result.esgGreeniumAdj !== 0 && (
            <WaterfallItem
              label="Greenium / Movilización"
              value={result.esgGreeniumAdj}
              isAdd
              color="text-[color:var(--nfq-success)]"
              formula={t.tooltip_formula_esgGreenium}
            />
          )}
        </div>

        <div className="my-2 rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]/50 p-2">
          <WaterfallItem
            label="Floor Price (Break-even)"
            value={result.floorPrice}
            highlight
            color="text-[color:var(--nfq-text-secondary)]"
            formula={t.tooltip_formula_floorPrice}
          />
          <BottomMetric label="+ Cost of Capital (Hurdle)">+{result.capitalCharge.toFixed(2)}%</BottomMetric>
          {result.capitalIncome != null && result.capitalIncome > 0 && (
            <BottomMetric label="- Capital Income (Risk-Free)" valueClassName="font-mono text-[color:var(--nfq-success)]">
              -{result.capitalIncome.toFixed(3)}%
            </BottomMetric>
          )}
          {result.esgDnshCapitalAdj != null && result.esgDnshCapitalAdj > 0 && (
            <BottomMetric label="- DNSH Capital Discount" valueClassName="font-mono text-[color:var(--nfq-success)]">
              -{result.esgDnshCapitalAdj.toFixed(3)}%
            </BottomMetric>
          )}
          {result.esgPillar1Adj != null && result.esgPillar1Adj > 0 && (
            <BottomMetric label="- ISF Pillar I (Art. 501a)" valueClassName="font-mono text-[color:var(--nfq-success)]">
              -{result.esgPillar1Adj.toFixed(3)}%
            </BottomMetric>
          )}
          <WaterfallItem
            label={`Technical Price (ROE ${deal.targetROE}%)`}
            value={result.technicalPrice}
            highlight
            color="text-[color:var(--nfq-accent)]"
            formula={t.tooltip_formula_technicalPrice}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-[color:var(--nfq-text-muted)]">Net Economic Profit</div>
          <div className={`font-mono font-bold ${result.economicProfit >= 0 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}`}>
            {result.economicProfit >= 0 ? '+' : ''}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: deal.currency,
              maximumFractionDigits: 0,
            }).format(result.economicProfit)}
          </div>
        </div>
      </div>
    </>
  );
}

function WaterfallItem({
  label,
  value,
  subtext,
  isAdd,
  highlight,
  color = 'text-[color:var(--nfq-text-secondary)]',
  weight,
  compact,
  icon,
  formula,
}: {
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
}) {
  return (
    <div
      className={`flex items-center justify-between ${highlight ? 'py-1' : 'py-0.5'} ${compact ? 'opacity-80' : ''}`}
    >
      <div>
        <div
          className={`flex items-center text-xs ${highlight ? 'font-bold text-[color:var(--nfq-text-primary)]' : 'font-medium text-[color:var(--nfq-text-muted)]'}`}
        >
          {icon && icon}
          {label}
          {formula && <TooltipTrigger content={formula} variant="formula" placement="right" size={11} />}
        </div>
        {subtext && <div className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">{subtext}</div>}
      </div>
      <div className={`${weight || 'font-mono'} ${color} font-bold ${highlight ? 'text-sm' : 'text-xs'}`}>
        {isAdd && value > 0 ? '+' : ''}
        {value.toFixed(3)}%
      </div>
    </div>
  );
}

function MiniMetric({
  children,
  label,
  tone = 'text-[color:var(--nfq-text-faint)]',
}: {
  children: React.ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className={`flex items-center justify-between text-[10px] ${tone}`}>
      <span>{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  );
}

function BottomMetric({
  children,
  label,
  valueClassName,
}: {
  children: React.ReactNode;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between pl-2 text-[10px]">
      <span className="text-[color:var(--nfq-text-faint)]">{label}</span>
      <span className={valueClassName || 'text-[color:var(--nfq-text-faint)]'}>{children}</span>
    </div>
  );
}
