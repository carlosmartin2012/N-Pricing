import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../ui/charts/lazyRecharts';
import type {
  FundingCollateralType,
  FundingCurveDatum,
} from './reportingTypes';
import { useChartTokens } from '../../hooks/useChartTokens';

interface Props {
  selectedCurrency: string;
  collateralType: FundingCollateralType;
  fundingCurveData: FundingCurveDatum[];
}

const FundingCurvesDashboard: React.FC<Props> = ({
  selectedCurrency,
  collateralType,
  fundingCurveData,
}) => {
  const tokens = useChartTokens();
  const summaryItems = useMemo(() => {
    if (fundingCurveData.length <= 4) {
      return [{ label: 'No curve data', base: 0, sim: 0 }];
    }

    const fiveYearPoint = fundingCurveData.find(item => item.tenor === '5Y');

    return [
      {
        label: 'Spread at 1Y',
        base: fundingCurveData[4]?.lp ?? 0,
        sim: fundingCurveData[4]?.simLP ?? 0,
      },
      {
        label: 'Spread at 5Y',
        base: fiveYearPoint?.lp ?? 0,
        sim: fiveYearPoint?.simLP ?? 0,
      },
      {
        label: 'Current Slope (ON-5Y)',
        base: (fiveYearPoint?.lp ?? 0) - (fundingCurveData[0]?.lp ?? 0),
        sim: (fiveYearPoint?.simLP ?? 0) - (fundingCurveData[0]?.simLP ?? 0),
      },
    ];
  }, [fundingCurveData]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="relative rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/30 p-4 lg:col-span-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h4 className="flex items-center gap-3 text-lg font-bold uppercase tracking-tight text-[color:var(--nfq-text-primary)]">
              <TrendingUp className="text-[color:var(--nfq-accent)]" /> {selectedCurrency} Term Liquidity Structure
            </h4>
            <p className="font-mono text-xs text-[color:var(--nfq-text-faint)]">
              Reference Structure: {collateralType} Collateralization
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-3 bg-[var(--nfq-accent)]" /> LP (Base)
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 border-t-2 border-dashed border-[color:var(--nfq-accent)]" /> LP (Sim)
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-3 bg-[var(--nfq-bg-bright)]" /> Whl. (Base)
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fundingCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis
                dataKey="tenor"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.axis, fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.axis, fontSize: 10 }}
                orientation="right"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--nfq-bg-elevated)',
                  border: '1px solid var(--nfq-border-ghost)',
                  borderRadius: 'var(--nfq-radius-lg)',
                  padding: '8px 12px',
                  fontFamily: 'var(--nfq-font-mono)',
                  fontSize: '12px',
                }}
                itemStyle={{ fontSize: '11px', textTransform: 'uppercase' }}
              />
              <Line type="monotone" dataKey="wholesale" stroke="#475569" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="lp" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4' }} />
              <Line type="monotone" dataKey="simLP" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 6" dot={false} />
              <Area type="monotone" dataKey="basis" fill="#06b6d4" fillOpacity={0.05} stroke="none" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 p-4">
          <h5 className="nfq-label mb-4">Summary Yield/Spread</h5>
          <div className="space-y-4">
            {summaryItems.map(item => (
              <div key={item.label} className="flex flex-col gap-1">
                <div className="nfq-label text-[10px]">{item.label}</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono-nums text-lg font-bold text-[color:var(--nfq-text-primary)]">
                    {item.base.toFixed(1)} <span className="text-[10px] text-[color:var(--nfq-text-faint)]">bps</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono text-xs font-bold ${item.sim >= item.base ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}`}>
                      {item.sim.toFixed(1)}
                    </span>
                    {item.sim > item.base ? (
                      <ArrowUpRight size={14} className="text-[color:var(--nfq-success)]" />
                    ) : (
                      <ArrowDownRight size={14} className="text-[color:var(--nfq-danger)]" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-accent)]/20 bg-[var(--nfq-accent)]/10 p-5">
          <h5 className="mb-3 text-[10px] font-bold uppercase text-[color:var(--nfq-accent)]">Portfolio Alignment</h5>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-[color:var(--nfq-text-muted)]">Wtd. LP Gap</span>
              <span className="font-mono text-[11px] font-bold">+4.2 bps</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--nfq-bg-elevated)]/40">
              <div className="h-full w-[72%] bg-[var(--nfq-accent)] shadow-[0_0_10px_#06b6d4]" />
            </div>
            <p className="mt-2 text-[9px] text-[color:var(--nfq-text-faint)]">
              * Analysis relative to 100% of the active portfolio notional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundingCurvesDashboard;
