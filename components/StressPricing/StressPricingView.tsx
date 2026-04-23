import React, { useMemo, useState } from 'react';
import { Download, Info, LineChart as LineChartIcon } from 'lucide-react';
import type { FTPResult, Transaction } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import {
  BASE_SHOCK_SCENARIO,
  type ShockScenario,
} from '../../types/pricingShocks';
import { EBA_STRESS_PRESETS } from '../../utils/pricing/shockPresets';
import { useData } from '../../contexts/DataContext';
import { useEntity } from '../../contexts/EntityContext';
import { usePricingContext } from '../../hooks/usePricingContext';
import { buildStressPricingCsv, type StressRow } from './stressPricingCsv';

const SCENARIOS: ShockScenario[] = [BASE_SHOCK_SCENARIO, ...EBA_STRESS_PRESETS];

const fmtPct = (v: number) => `${v.toFixed(3)}%`;
const fmtBps = (v: number) => {
  const bps = v * 100;
  const sign = bps > 0 ? '+' : '';
  return `${sign}${bps.toFixed(1)} bp`;
};
const fmtPp = (v: number) => {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} pp`;
};

const deltaColor = (delta: number) => {
  if (Math.abs(delta) < 1e-9) return 'text-slate-400';
  return delta > 0 ? 'text-rose-300' : 'text-emerald-300';
};

const curveShiftFlagOn = (): boolean =>
  String(import.meta.env?.VITE_PRICING_APPLY_CURVE_SHIFT ?? '').toLowerCase() === 'true';

interface ComputedRow {
  scenario: ShockScenario;
  result: FTPResult;
  margin: number;
  deltaFtpPct: number;
  deltaMarginPct: number;
  deltaRarocPp: number;
}

function isPriceable(deal: Transaction): deal is Transaction & { id: string } {
  return Boolean(deal.id) && Boolean(deal.productType) && Number.isFinite(deal.amount) && deal.amount > 0;
}

const StressPricingView: React.FC = () => {
  const { deals, approvalMatrix } = useData();
  const { activeEntity } = useEntity();
  const pricingContext = usePricingContext();

  const priceable = useMemo(() => deals.filter(isPriceable), [deals]);
  const [selectedId, setSelectedId] = useState<string | null>(priceable[0]?.id ?? null);

  const selectedDeal = useMemo(
    () => priceable.find((d) => d.id === selectedId) ?? priceable[0] ?? null,
    [priceable, selectedId],
  );

  const rows: ComputedRow[] = useMemo(() => {
    if (!selectedDeal) return [];
    const base = calculatePricing(selectedDeal, approvalMatrix, pricingContext, BASE_SHOCK_SCENARIO);
    const baseMargin = base.finalClientRate - base.totalFTP;
    return SCENARIOS.map((scenario) => {
      const result = scenario.id === 'base'
        ? base
        : calculatePricing(selectedDeal, approvalMatrix, pricingContext, scenario);
      const margin = result.finalClientRate - result.totalFTP;
      return {
        scenario,
        result,
        margin,
        deltaFtpPct: result.totalFTP - base.totalFTP,
        deltaMarginPct: margin - baseMargin,
        deltaRarocPp: result.raroc - base.raroc,
      };
    });
  }, [selectedDeal, approvalMatrix, pricingContext]);

  const handleExport = () => {
    if (!selectedDeal || rows.length === 0) return;
    const dealId = selectedDeal.id ?? 'unsaved';
    const payload: StressRow[] = rows.map((r) => ({
      scenarioId: r.scenario.id,
      scenarioLabel: r.scenario.label,
      ftpPct: r.result.totalFTP,
      deltaFtpBps: r.deltaFtpPct * 100,
      marginPct: r.margin,
      deltaMarginBps: r.deltaMarginPct * 100,
      rarocPct: r.result.raroc,
      deltaRarocPp: r.deltaRarocPp,
    }));
    const csv = buildStressPricingCsv(dealId, payload);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stress-pricing-${dealId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const flagOn = curveShiftFlagOn();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <LineChartIcon className="h-5 w-5 text-cyan-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
            Stress Pricing
          </h2>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-slate-400">{activeEntity.shortCode}</span>
          )}
          <span
            className={`nfq-label text-[10px] ${flagOn ? 'text-emerald-300' : 'text-amber-300'}`}
            title="VITE_PRICING_APPLY_CURVE_SHIFT"
          >
            {flagOn ? 'CURVE SHIFT · ON' : 'CURVE SHIFT · OFF (uniform)'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!selectedDeal || rows.length === 0}
          className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </header>

      <section className="flex flex-col gap-2">
        <label className="nfq-label text-[10px] text-slate-400" htmlFor="stress-deal-select">
          Deal
        </label>
        {priceable.length === 0 ? (
          <p className="text-xs text-slate-400">
            No priceable deals in the current blotter. Create one in Calculator first.
          </p>
        ) : (
          <select
            id="stress-deal-select"
            className="w-full max-w-md rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            value={selectedDeal?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {priceable.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.id} · {deal.productType} · {deal.currency} {deal.amount.toLocaleString('es-ES')}
              </option>
            ))}
          </select>
        )}
      </section>

      {selectedDeal && rows.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-slate-700/40 bg-slate-900/40">
          <table className="w-full min-w-[780px] text-xs">
            <thead>
              <tr className="border-b border-slate-700/40 text-left">
                <th className="nfq-label px-4 py-3 text-[10px] text-slate-400">Scenario</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">FTP</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">Δ FTP</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">Margin</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">Δ Margin</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">RAROC</th>
                <th className="nfq-label px-4 py-3 text-right text-[10px] text-slate-400">Δ RAROC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isBase = row.scenario.id === 'base';
                return (
                  <tr
                    key={row.scenario.id}
                    className={`border-b border-slate-800/40 ${isBase ? 'bg-slate-800/30' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-200">
                      {row.scenario.label}
                      {isBase && <span className="ml-2 text-[10px] uppercase text-slate-500">base</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtPct(row.result.totalFTP)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${isBase ? 'text-slate-500' : deltaColor(row.deltaFtpPct)}`}>
                      {isBase ? '—' : fmtBps(row.deltaFtpPct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtPct(row.margin)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${isBase ? 'text-slate-500' : deltaColor(-row.deltaMarginPct)}`}>
                      {isBase ? '—' : fmtBps(row.deltaMarginPct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-100">{fmtPct(row.result.raroc)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${isBase ? 'text-slate-500' : deltaColor(-row.deltaRarocPp)}`}>
                      {isBase ? '—' : fmtPp(row.deltaRarocPp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/80">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <p>
          Stress Pricing shows how FTP, margin and RAROC move under EBA GL 2018/02 curve shocks
          for price-testing purposes. It does <strong>not</strong> replace the regulatory IRRBB
          calculation (ΔEVE, SOT, ΔNII runoff) — that lives in the bank&apos;s ALM engine.
        </p>
      </footer>
    </div>
  );
};

export default StressPricingView;
