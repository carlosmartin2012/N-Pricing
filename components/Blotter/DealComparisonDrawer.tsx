import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Equal, GitCompare } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import type { FTPResult, Transaction } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { usePricingContext } from '../../hooks/usePricingContext';
import { useData } from '../../contexts/DataContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dealA: Transaction | null;
  dealB: Transaction | null;
}

interface DiffRow {
  label: string;
  valueA: string;
  valueB: string;
  delta: number;
  higherIsBetter?: boolean;
}

function fmt(v: number | undefined, digits = 4): string {
  return Number.isFinite(v) ? (v as number).toFixed(digits) + '%' : '—';
}

function buildDiffRows(a: FTPResult, b: FTPResult): DiffRow[] {
  const rows: { label: string; key: keyof FTPResult; digits?: number; higherIsBetter?: boolean }[] = [
    { label: 'Base Rate', key: 'baseRate' },
    { label: 'Liquidity Premium', key: 'liquiditySpread' },
    { label: 'LCR Charge', key: 'lcrCost' },
    { label: 'NSFR Charge', key: 'nsfrCost' },
    { label: 'Capital Charge', key: 'capitalCharge' },
    { label: 'Total FTP', key: 'totalFTP' },
    { label: 'Final Client Rate', key: 'finalClientRate' },
    { label: 'RAROC', key: 'raroc', digits: 2, higherIsBetter: true },
  ];

  return rows.map((r) => {
    const va = (a[r.key] as number) ?? 0;
    const vb = (b[r.key] as number) ?? 0;
    return {
      label: r.label,
      valueA: fmt(va, r.digits ?? 4),
      valueB: fmt(vb, r.digits ?? 4),
      delta: vb - va,
      higherIsBetter: r.higherIsBetter,
    };
  });
}

const DeltaIndicator: React.FC<{ delta: number; higherIsBetter?: boolean }> = ({ delta, higherIsBetter }) => {
  if (Math.abs(delta) < 0.0001) return <Equal size={12} className="text-slate-500" />;
  const isPositive = delta > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-0.5 font-mono text-[11px] ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon size={10} />
      {Math.abs(delta).toFixed(2)}bp
    </span>
  );
};

export const DealComparisonDrawer: React.FC<Props> = ({ isOpen, onClose, dealA, dealB }) => {
  const pricingContext = usePricingContext();
  const { approvalMatrix } = useData();

  const results = useMemo(() => {
    if (!dealA || !dealB) return null;
    const resA = calculatePricing(dealA, approvalMatrix, pricingContext);
    const resB = calculatePricing(dealB, approvalMatrix, pricingContext);
    return { a: resA, b: resB, diff: buildDiffRows(resA, resB) };
  }, [dealA, dealB, approvalMatrix, pricingContext]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Deal Comparison"
      size="xl"
    >
      {!dealA || !dealB || !results ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <GitCompare size={32} className="text-[var(--nfq-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--nfq-text-muted)]">Select two deals to compare</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deal headers */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-xs font-semibold tracking-normal text-[var(--nfq-text-muted)]">Metric</div>
            <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-3 text-center">
              <div className="font-mono text-xs font-bold text-[var(--nfq-accent)]">{dealA.id || 'Deal A'}</div>
              <div className="mt-0.5 text-[10px] text-[var(--nfq-text-muted)]">{dealA.clientId} · {dealA.productType}</div>
            </div>
            <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-3 text-center">
              <div className="font-mono text-xs font-bold text-violet-400">{dealB.id || 'Deal B'}</div>
              <div className="mt-0.5 text-[10px] text-[var(--nfq-text-muted)]">{dealB.clientId} · {dealB.productType}</div>
            </div>
          </div>

          {/* Deal parameters diff */}
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-normal text-[var(--nfq-text-faint)]">Parameters</h3>
            <div className="rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {[
                    { label: 'Amount', a: `${dealA.currency} ${(dealA.amount || 0).toLocaleString()}`, b: `${dealB.currency} ${(dealB.amount || 0).toLocaleString()}` },
                    { label: 'Tenor', a: `${dealA.durationMonths}m`, b: `${dealB.durationMonths}m` },
                    { label: 'Risk Weight', a: `${dealA.riskWeight}%`, b: `${dealB.riskWeight}%` },
                    { label: 'Margin', a: `${dealA.marginTarget?.toFixed(2)}%`, b: `${dealB.marginTarget?.toFixed(2)}%` },
                    { label: 'ESG Transition', a: dealA.transitionRisk, b: dealB.transitionRisk },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-[var(--nfq-border-ghost)] last:border-0">
                      <td className="px-3 py-2 text-[var(--nfq-text-muted)] w-1/3">{row.label}</td>
                      <td className="px-3 py-2 text-center font-mono text-[var(--nfq-text-primary)]">{row.a}</td>
                      <td className={`px-3 py-2 text-center font-mono ${row.a !== row.b ? 'text-amber-400 font-semibold' : 'text-[var(--nfq-text-primary)]'}`}>
                        {row.b}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FTP Results diff */}
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-normal text-[var(--nfq-text-faint)]">FTP Decomposition</h3>
            <div className="rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {results.diff.map((row) => (
                    <tr
                      key={row.label}
                      className={`border-b border-[var(--nfq-border-ghost)] last:border-0 ${
                        row.label === 'Total FTP' || row.label === 'Final Client Rate' || row.label === 'RAROC'
                          ? 'bg-[rgba(6,182,212,0.04)]'
                          : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-[var(--nfq-text-muted)] w-1/4">{row.label}</td>
                      <td className="px-3 py-2 text-center font-mono text-[var(--nfq-text-primary)]">{row.valueA}</td>
                      <td className="px-3 py-2 text-center font-mono text-[var(--nfq-text-primary)]">{row.valueB}</td>
                      <td className="px-3 py-2 text-right w-24">
                        <DeltaIndicator delta={row.delta * 100} higherIsBetter={row.higherIsBetter} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};
