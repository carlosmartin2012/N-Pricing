import React, { useMemo } from 'react';
import { TrendingUp, RefreshCw, Gauge, BarChart3 } from 'lucide-react';
import { useClientLtvHistoryQuery, useRecomputeLtv } from '../../hooks/queries/useClvQueries';
import { useUI } from '../../contexts/UIContext';
import { clvTranslations } from '../../translations/index';

interface Props {
  clientId: string;
}

const fmtEur = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};
const fmtPct = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

const LtvProjectionCard: React.FC<Props> = ({ clientId }) => {
  const { language } = useUI();
  const t = clvTranslations(language);
  const { data: history = [], isLoading: loading } = useClientLtvHistoryQuery(clientId);
  const recomputeMutation = useRecomputeLtv(clientId);
  const recomputing = recomputeMutation.isPending;
  const latest = history[0] ?? null;

  const recompute = () => {
    recomputeMutation.mutate({});
  };

  const bandRange = useMemo(() => {
    if (!latest) return null;
    const p5 = latest.clvP5Eur ?? latest.clvPointEur;
    const p95 = latest.clvP95Eur ?? latest.clvPointEur;
    return { p5, p95, span: Math.max(1, p95 - p5) };
  }, [latest]);

  if (!latest && !loading) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="nfq-label text-[10px] text-slate-300">{t.clvProjectionTitle}</span>
          </div>
          <button
            type="button"
            onClick={recompute}
            disabled={recomputing}
            className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-[11px] disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${recomputing ? 'animate-spin' : ''}`} />
            {recomputing ? t.clvComputing : t.clvCompute}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          No CLV snapshot yet — trigger a compute to project value for the next horizon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="nfq-label text-[10px] text-slate-300">Customer Lifetime Value</span>
          {latest && (
            <span className="text-[10px] text-slate-500 font-mono">
              as of {latest.asOfDate} · {latest.horizonYears}y · r={(latest.discountRate * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={recompute}
          disabled={recomputing}
          className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-[11px] disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${recomputing ? 'animate-spin' : ''}`} />
          {t.clvRecompute}
        </button>
      </header>

      {latest && bandRange && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Metric label={t.clvPoint}             value={fmtEur(latest.clvPointEur)} accent="emerald" />
            <Metric label={t.clvBand}              value={`${fmtEur(bandRange.p5)} – ${fmtEur(bandRange.p95)}`} accent="sky" />
            <Metric label={t.clvShareOfWalletGap}  value={fmtPct(latest.shareOfWalletGap)} accent="amber" />
          </section>

          <section className="space-y-2">
            <div className="nfq-label text-[9px] text-slate-400">Projection band</div>
            <div className="relative h-3 rounded bg-white/[0.04]">
              <div
                className="absolute inset-y-0 rounded bg-emerald-500/20"
                style={{ left: 0, right: 0 }}
              />
              <div
                className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 bg-emerald-400"
                style={{
                  left: `${((latest.clvPointEur - bandRange.p5) / bandRange.span) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-slate-500">
              <span>{fmtEur(bandRange.p5)}</span>
              <span>{fmtEur(bandRange.p95)}</span>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Breakdown label="NII"        value={latest.breakdown.niiEur}         icon={BarChart3} tone="emerald" />
            <Breakdown label="Crosssell"  value={latest.breakdown.crosssellEur}   icon={BarChart3} tone="sky" />
            <Breakdown label="Fees"       value={latest.breakdown.feesEur}        icon={BarChart3} tone="violet" />
            <Breakdown label="Churn cost" value={-latest.breakdown.churnCostEur}  icon={BarChart3} tone="rose" />
          </section>

          <section className="rounded border border-white/5 bg-white/[0.02] p-3">
            <div className="nfq-label text-[9px] text-slate-400 mb-2 flex items-center gap-2">
              <Gauge className="h-3 w-3" /> {t.clvHazardRenewal}
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-200 sm:grid-cols-4">
              <span>Churn λ {fmtPct(latest.churnHazardAnnual ?? undefined)}</span>
              <span>Renewal {fmtPct(latest.renewalProb ?? undefined)}</span>
              <span>SoW est. {fmtPct(latest.shareOfWalletEst ?? undefined)}</span>
              <span className="text-slate-500 text-[9px] truncate">
                engine {latest.engineVersion} · #{latest.assumptionsHash}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

interface MetricProps {
  label: string;
  value: string;
  accent: 'emerald' | 'sky' | 'amber';
}
const accentClass: Record<MetricProps['accent'], string> = {
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
  amber: 'text-amber-300',
};

const Metric: React.FC<MetricProps> = ({ label, value, accent }) => (
  <div className="rounded border border-white/5 bg-white/[0.02] p-3">
    <div className="nfq-label text-[9px] text-slate-400">{label}</div>
    <div className={`mt-1 font-mono text-sm font-bold ${accentClass[accent]}`}>{value}</div>
  </div>
);

interface BreakdownProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'sky' | 'violet' | 'rose';
}
const toneClass: Record<BreakdownProps['tone'], string> = {
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
  violet: 'text-violet-300',
  rose: 'text-rose-300',
};
const Breakdown: React.FC<BreakdownProps> = ({ label, value, icon: Icon, tone }) => (
  <div className="rounded border border-white/5 bg-white/[0.02] p-2">
    <div className="nfq-label flex items-center gap-1 text-[9px] text-slate-400">
      <Icon className="h-3 w-3" />
      {label}
    </div>
    <div className={`mt-1 font-mono text-xs font-bold ${toneClass[tone]}`}>{fmtEur(value)}</div>
  </div>
);

export default LtvProjectionCard;
