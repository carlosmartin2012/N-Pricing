import React from 'react';
import { Panel } from '../ui/LayoutComponents';
import type { FTPResult } from '../../types';
import type { Language } from '../../translations';
import { getTranslations } from '../../translations';
import { buildShockImpactRows, getDeltaTone } from './shockUtils';

/** Format a number with toFixed, falling back to '0.00' if NaN/Infinity */
function safeFixed(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : (0).toFixed(decimals);
}

interface Props {
  language: Language;
  baseResult: FTPResult;
  shockedResult: FTPResult;
}

const KpiCard: React.FC<{
  label: string;
  base: number;
  shocked: number;
  delta: number;
  inverse?: boolean;
}> = ({ label, base, shocked, delta, inverse }) => {
  const tone = getDeltaTone(delta, inverse);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-black">
      <div className="nfq-label mb-1">{label}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono-nums text-2xl font-bold text-slate-900 dark:text-white">
            {safeFixed(shocked, 2)}%
          </div>
          <div className="font-mono text-xs text-slate-400">Base: {safeFixed(base, 2)}%</div>
        </div>
        <div
          className={`font-mono-nums flex items-center text-sm font-bold ${
            tone === 'negative'
              ? 'text-red-500'
              : tone === 'positive'
                ? 'text-emerald-500'
                : 'text-slate-500'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {safeFixed(delta, 2)}%
        </div>
      </div>
    </div>
  );
};

const ImpactRow: React.FC<{
  label: string;
  base: number;
  shocked: number;
}> = ({ label, base, shocked }) => {
  const delta = shocked - base;
  const tone = getDeltaTone(delta);

  return (
    <tr className="group transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
      <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-tertiary)]">{label}</td>
      <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums]">{safeFixed(base, 3)}%</td>
      <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[color:var(--nfq-text-secondary)] [font-variant-numeric:tabular-nums]">
        {safeFixed(shocked, 3)}%
      </td>
      <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs [font-variant-numeric:tabular-nums]">
        {Number.isFinite(delta) && Math.abs(delta) > 0.001 && (
          <span
            className={
              tone === 'positive'
                ? 'text-[var(--nfq-warning)]'
                : tone === 'negative'
                  ? 'text-[var(--nfq-info)]'
                  : 'text-[color:var(--nfq-text-muted)]'
            }
          >
            {delta > 0 ? '+' : ''}
            {safeFixed(delta, 3)}%
          </span>
        )}
      </td>
    </tr>
  );
};

export const ShockImpactPanel: React.FC<Props> = React.memo(({
  language,
  baseResult,
  shockedResult,
}) => {
  const t = getTranslations(language);
  const impactRows = buildShockImpactRows(baseResult, shockedResult);
  const deltaFTP = shockedResult.totalFTP - baseResult.totalFTP;
  const deltaRAROC = shockedResult.raroc - baseResult.raroc;
  const deltaClientRate = shockedResult.finalClientRate - baseResult.finalClientRate;

  return (
    <Panel title={t.impactAnalysis || 'Impact Analysis'} className="h-full bg-white dark:bg-[#0a0a0a]">
      <div className="grid grid-cols-1 gap-4 border-b border-slate-200 p-4 md:grid-cols-3 dark:border-slate-800">
        <KpiCard
          label="Total FTP"
          base={baseResult.totalFTP}
          shocked={shockedResult.totalFTP}
          delta={deltaFTP}
          inverse
        />
        <KpiCard
          label="Client Rate"
          base={baseResult.finalClientRate}
          shocked={shockedResult.finalClientRate}
          delta={deltaClientRate}
          inverse
        />
        <KpiCard
          label="RAROC"
          base={baseResult.raroc}
          shocked={shockedResult.raroc}
          delta={deltaRAROC}
        />
      </div>

      <div className="overflow-auto p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">{t.component}</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">{t.base}</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">{t.shocked}</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">{t.impact}</th>
            </tr>
          </thead>
          <tbody>
            {impactRows.map((row) => (
              <ImpactRow key={row.label} label={row.label} base={row.base} shocked={row.shocked} />
            ))}

            <tr className="bg-[var(--nfq-bg-elevated)] font-bold">
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-secondary)]">Total FTP</td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums]">{safeFixed(baseResult.totalFTP, 2)}%</td>
              <td
                className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums] ${
                  deltaFTP > 0 ? 'text-[var(--nfq-danger)]' : 'text-[var(--nfq-success)]'
                }`}
              >
                {safeFixed(shockedResult.totalFTP, 2)}%
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs [font-variant-numeric:tabular-nums]">
                {Number.isFinite(deltaFTP) && deltaFTP !== 0 && (
                  <span className={deltaFTP > 0 ? 'text-[var(--nfq-danger)]' : 'text-[var(--nfq-success)]'}>
                    {deltaFTP > 0 ? '+' : ''}
                    {safeFixed(deltaFTP, 2)}%
                  </span>
                )}
              </td>
            </tr>

            <tr className="bg-[var(--nfq-bg-highest)] font-bold">
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-primary)]">RAROC</td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums]">{safeFixed(baseResult.raroc, 2)}%</td>
              <td
                className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums] ${
                  deltaRAROC < 0 ? 'text-[var(--nfq-danger)]' : 'text-[var(--nfq-success)]'
                }`}
              >
                {safeFixed(shockedResult.raroc, 2)}%
              </td>
              <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-xs [font-variant-numeric:tabular-nums]">
                {Number.isFinite(deltaRAROC) && deltaRAROC !== 0 && (
                  <span className={deltaRAROC < 0 ? 'text-[var(--nfq-danger)]' : 'text-[var(--nfq-success)]'}>
                    {deltaRAROC > 0 ? '+' : ''}
                    {safeFixed(deltaRAROC, 2)}%
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
});
