import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Layers } from 'lucide-react';
import type { DealVariance } from '../../types';

type Dimension = 'product' | 'segment' | 'originator';

interface Props {
  variances: DealVariance[];
  isLoading: boolean;
}

function fmtEur(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'segment', label: 'Segment' },
];

const LeakageByDimensionChart: React.FC<Props> = ({ variances, isLoading }) => {
  const [dimension, setDimension] = useState<Dimension>('product');

  const chartData = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const v of variances) {
      const key = dimension === 'product' ? v.cohort.product : v.cohort.segment;
      agg[key] = (agg[key] || 0) + (v.leakageEur ?? 0);
    }
    return Object.entries(agg)
      .map(([name, leakage]) => ({ name, leakage: Math.round(leakage * 100) / 100 }))
      .sort((a, b) => Math.abs(b.leakage) - Math.abs(a.leakage));
  }, [variances, dimension]);

  if (isLoading) {
    return (
      <div className="nfq-kpi-card animate-pulse">
        <div className="mb-4 h-4 w-48 rounded bg-[var(--nfq-bg-elevated)]" />
        <div className="h-64 rounded bg-[var(--nfq-bg-elevated)]" />
      </div>
    );
  }

  return (
    <div className="nfq-kpi-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" />
          <span className="nfq-kpi-label">Leakage by Dimension</span>
        </div>
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value as Dimension)}
          className="nfq-select-field w-auto text-xs"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-[color:var(--nfq-text-muted)]">
          No leakage data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 36, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--nfq-border-ghost)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
              tickFormatter={(v: number) => fmtEur(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'var(--nfq-text-secondary)', fontSize: 11, fontFamily: 'var(--nfq-font-mono)' }}
              width={76}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--nfq-bg-elevated)',
                border: '1px solid var(--nfq-border-ghost)',
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'var(--nfq-font-mono)',
                color: 'var(--nfq-text-primary)',
              }}
              formatter={(value: number | string | undefined) => `EUR ${fmtEur(Number(value ?? 0))}`}
            />
            <Bar dataKey="leakage" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.leakage >= 0 ? '#34d399' : '#f87171'}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default LeakageByDimensionChart;
