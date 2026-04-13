import React from 'react';
import { X } from 'lucide-react';
import type { TargetGridCell } from '../../types';
import { useUI } from '../../contexts/UIContext';

interface Props {
  cell: TargetGridCell | null;
  onClose: () => void;
}

function fmt(value: number | null | undefined, mode: 'pct' | 'bps' | 'abs' = 'bps'): string {
  if (value == null) return '--';
  if (mode === 'pct') return `${(value * 100).toFixed(2)}%`;
  if (mode === 'bps') return `${Math.round(value * 10000)}bp`;
  return value.toFixed(2);
}

const MetricRow: React.FC<{ label: string; value: string; accent?: boolean; color?: string }> = ({
  label,
  value,
  accent,
  color,
}) => (
  <div className="flex items-center justify-between py-2 border-b border-[color:var(--nfq-border-ghost)]">
    <span className="text-[11px] text-[color:var(--nfq-text-muted)]">{label}</span>
    <span
      className={`font-mono text-xs font-bold [font-variant-numeric:tabular-nums] ${
        color ? '' : accent ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-primary)]'
      }`}
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  </div>
);

const GridCellDetailPanel: React.FC<Props> = ({ cell, onClose }) => {
  const { t } = useUI();

  if (!cell) return null;

  const rarocPct = cell.targetRaroc * 100;
  const rarocColor =
    rarocPct >= 12
      ? 'var(--nfq-success)'
      : rarocPct >= 8
        ? 'var(--nfq-warning)'
        : 'var(--nfq-danger)';

  const components = cell.components;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-md transition-opacity duration-300 opacity-100"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cell detail"
        className="fixed top-0 right-0 z-50 flex h-full w-full transform flex-col bg-[var(--nfq-bg-surface)] shadow-[var(--nfq-shadow-dialog)] transition-transform duration-300 ease-out translate-x-0 md:w-[28rem]"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[var(--nfq-bg-elevated)] px-6 py-5">
          <div>
            <div className="nfq-eyebrow">Target Cell Detail</div>
            <h2 className="mt-3 text-lg font-semibold tracking-[var(--nfq-tracking-snug)] text-[color:var(--nfq-text-primary)]">
              {cell.product} &middot; {cell.segment}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
              {cell.tenorBucket} &middot; {cell.currency}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close ?? 'Close'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Key metrics */}
          <section className="mb-6">
            <h3 className="nfq-eyebrow mb-3">Key Metrics</h3>
            <div className="rounded-[16px] bg-[var(--nfq-bg-elevated)] p-4">
              <MetricRow label="FTP (all-in)" value={fmt(cell.ftp, 'bps')} />
              <MetricRow label={t.marginTargetPct ?? 'Margin'} value={fmt(cell.targetMargin, 'pct')} accent />
              <MetricRow label="Client Rate" value={fmt(cell.targetClientRate, 'pct')} accent />
              <MetricRow label="RAROC" value={`${rarocPct.toFixed(1)}%`} color={rarocColor} />
              <MetricRow
                label="Economic Profit"
                value={
                  components?.economicProfit != null
                    ? `${components.economicProfit >= 0 ? '+' : ''}${components.economicProfit.toFixed(0)}`
                    : '--'
                }
              />
            </div>
          </section>

          {/* Component breakdown */}
          <section className="mb-6">
            <h3 className="nfq-eyebrow mb-3">FTP Component Breakdown</h3>
            <div className="rounded-[16px] bg-[var(--nfq-bg-elevated)] p-4">
              <MetricRow label="Base Rate" value={fmt(components?.baseRate, 'bps')} />
              <MetricRow label="Liquidity Premium" value={fmt(cell.liquidityPremium, 'bps')} />
              <MetricRow label="Capital Charge" value={fmt(cell.capitalCharge, 'bps')} />
              <MetricRow label="ESG Adjustment" value={fmt(cell.esgAdjustment, 'bps')} />
              <MetricRow label="CLC / LCR Charge" value={fmt(components?.lcrCost, 'bps')} />
              <MetricRow label="NSFR Charge" value={fmt(components?.nsfrCost, 'bps')} />
              <MetricRow label="Capital Income" value={fmt(components?.capitalIncome, 'bps')} />
              <MetricRow label="Regulatory Cost" value={fmt(components?.regulatoryCost, 'bps')} />
              <MetricRow label="Operational Cost" value={fmt(components?.operationalCost, 'bps')} />
              <MetricRow label="Incentivisation" value={fmt(components?.incentivisationAdj, 'bps')} />
            </div>
          </section>

          {/* Canonical deal inputs */}
          <section>
            <h3 className="nfq-eyebrow mb-3">Canonical Deal Inputs</h3>
            <div className="rounded-[16px] bg-[var(--nfq-bg-elevated)] p-4">
              {cell.canonicalDealInput &&
                Object.entries(cell.canonicalDealInput).map(([key, value]) => {
                  if (value == null) return null;
                  return (
                    <MetricRow
                      key={key}
                      label={key}
                      value={typeof value === 'number' ? value.toLocaleString() : String(value)}
                    />
                  );
                })}
              {(!cell.canonicalDealInput ||
                Object.keys(cell.canonicalDealInput).length === 0) && (
                <p className="text-xs text-[color:var(--nfq-text-muted)]">
                  No canonical deal inputs defined.
                </p>
              )}
            </div>
          </section>

          {/* Computed timestamp */}
          <p className="mt-6 text-center text-[10px] font-mono uppercase tracking-widest text-[color:var(--nfq-text-faint)]">
            Computed {new Date(cell.computedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </>
  );
};

export default GridCellDetailPanel;
