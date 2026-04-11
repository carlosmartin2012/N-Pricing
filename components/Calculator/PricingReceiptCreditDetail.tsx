import React from 'react';
import type { CreditRiskResult, Transaction } from '../../types';

interface PricingReceiptCreditDetailProps {
  creditDetail: CreditRiskResult;
  currency: Transaction['currency'];
  durationMonths: number;
  t: Record<string, string | undefined>;
}

export function PricingReceiptCreditDetail({
  creditDetail,
  currency,
  durationMonths,
  t,
}: PricingReceiptCreditDetailProps) {
  return (
    <div className="animate-in slide-in-from-top-2 mt-1.5 space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 fade-in">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Metric label={t.anejo_segment || 'Segment'}>
          {creditDetail.anejoSegment.replace(/_/g, ' ')}
        </Metric>
        <Metric label={t.creditMode || 'Credit Mode'}>
          {creditDetail.mode === 'mirror'
            ? t.creditModeMirror || 'Mirror'
            : t.creditModeNative || 'Native'}
        </Metric>
        <Metric label={t.creditCoverage || 'Coverage'}>
          {creditDetail.coveragePct.toFixed(3)}%
        </Metric>
        <Metric label={t.creditScenarioWeighted || 'Scenario Weighted'}>
          {creditDetail.scenarioWeightedCoveragePct != null
            ? `${creditDetail.scenarioWeightedCoveragePct.toFixed(3)}%`
            : '—'}
        </Metric>
      </div>

      <div className="space-y-1 border-t border-slate-800 pt-2">
        <MoneyMetric
          currency={currency}
          label={t.creditDay1Provision || 'Day 1 Provision'}
          value={creditDetail.day1Provision}
        />
        <MoneyMetric
          currency={currency}
          label={t.creditMigrationCost || 'Migration Cost'}
          value={creditDetail.migrationCostAnnual}
        />
        <PlainMetric label={t.creditProbS2 || 'Prob. S2'}>
          {creditDetail.pMigrateS2 != null ? `${(creditDetail.pMigrateS2 * 100).toFixed(2)}%` : '—'}
        </PlainMetric>
        <PlainMetric label={t.creditProbS3 || 'Prob. S3'}>
          {creditDetail.pMigrateS3 != null ? `${(creditDetail.pMigrateS3 * 100).toFixed(2)}%` : '—'}
        </PlainMetric>
        <MoneyMetric
          currency={currency}
          label={`${t.creditELLifetime || 'EL Lifetime'} (${Math.round(durationMonths / 12)}yr)`}
          value={creditDetail.elLifetime}
        />
      </div>

      {creditDetail.capitalParams && (
        <div className="border-t border-slate-800 pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
            {t.creditCapitalParams || 'Capital Params'}
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-slate-400">
            <span>PD: {(creditDetail.capitalParams.pd * 100).toFixed(2)}%</span>
            <span className="mx-2 text-slate-600">|</span>
            <span>LGD: {(creditDetail.capitalParams.lgd * 100).toFixed(0)}%</span>
            <span className="mx-2 text-slate-600">|</span>
            <span>
              EAD:{' '}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
              }).format(creditDetail.capitalParams.ead)}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-400">
            <span>Exposure Class: {creditDetail.capitalParams.exposureClass}</span>
            <span className="mx-2 text-slate-600">|</span>
            <span>Maturity: {creditDetail.capitalParams.maturityYears.toFixed(1)}yr</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-xs text-slate-300">{children}</div>
    </div>
  );
}

function MoneyMetric({
  currency,
  label,
  value,
}: {
  currency: string;
  label: string;
  value: number | null | undefined;
}) {
  return (
    <PlainMetric label={label}>
      {value != null
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          }).format(value)
        : '—'}
    </PlainMetric>
  );
}

function PlainMetric({
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
      <span className="uppercase tracking-widest text-slate-500">{label}</span>
      <span className={valueClassName || 'font-mono text-xs text-slate-300'}>{children}</span>
    </div>
  );
}
