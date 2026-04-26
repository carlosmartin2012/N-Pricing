import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { DealVariance } from '../../types';

interface Props {
  variances: DealVariance[];
  toleranceBps?: number;
}

const BUCKET_WIDTH = 5; // 5 bps per bucket
const MIN_BUCKET = -50;
const MAX_BUCKET = 50;

interface Bucket {
  label: string;
  from: number;
  to: number;
  count: number;
  outOfBand: boolean;
}

const VarianceDistributionChart: React.FC<Props> = ({ variances, toleranceBps = 20 }) => {
  const buckets = useMemo(() => {
    const result: Bucket[] = [];
    for (let start = MIN_BUCKET; start < MAX_BUCKET; start += BUCKET_WIDTH) {
      const end = start + BUCKET_WIDTH;
      const outOfBand = Math.abs(start + BUCKET_WIDTH / 2) > toleranceBps;
      result.push({
        label: `${start >= 0 ? '+' : ''}${start}`,
        from: start,
        to: end,
        count: 0,
        outOfBand,
      });
    }

    // Overflow buckets
    let belowCount = 0;
    let aboveCount = 0;

    for (const v of variances) {
      const bps = v.ftpVarianceBps ?? 0;
      if (bps < MIN_BUCKET) {
        belowCount++;
        continue;
      }
      if (bps >= MAX_BUCKET) {
        aboveCount++;
        continue;
      }
      const idx = Math.floor((bps - MIN_BUCKET) / BUCKET_WIDTH);
      if (idx >= 0 && idx < result.length) {
        result[idx].count++;
      }
    }

    // Prepend/append overflow if any
    if (belowCount > 0) {
      result.unshift({
        label: `<${MIN_BUCKET}`,
        from: MIN_BUCKET - BUCKET_WIDTH,
        to: MIN_BUCKET,
        count: belowCount,
        outOfBand: true,
      });
    }
    if (aboveCount > 0) {
      result.push({
        label: `>${MAX_BUCKET}`,
        from: MAX_BUCKET,
        to: MAX_BUCKET + BUCKET_WIDTH,
        count: aboveCount,
        outOfBand: true,
      });
    }

    return result;
  }, [variances, toleranceBps]);

  const maxCount = useMemo(() => Math.max(...buckets.map((b) => b.count), 1), [buckets]);

  return (
    <div className="nfq-kpi-card">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-violet-400" />
        <span className="nfq-kpi-label">FTP Variance Distribution</span>
        <span className="ml-auto text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
          Tolerance: +/-{toleranceBps} bps
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={buckets} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--nfq-border-ghost)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--nfq-text-muted)', fontSize: 9, fontFamily: 'var(--nfq-font-mono)' }}
            interval={1}
            axisLine={{ stroke: 'var(--nfq-border-ghost)' }}
          />
          <YAxis
            tick={{ fill: 'var(--nfq-text-muted)', fontSize: 10, fontFamily: 'var(--nfq-font-mono)' }}
            allowDecimals={false}
            domain={[0, Math.ceil(maxCount * 1.1)]}
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
            formatter={(value: number | string | undefined) => `${Number(value ?? 0)} deals`}
            labelFormatter={(label: unknown) => `${String(label)} bps`}
          />
          <ReferenceLine
            x={`-${toleranceBps}`}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <ReferenceLine
            x={`+${toleranceBps}`}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={20}>
            {buckets.map((bucket, idx) => (
              <Cell
                key={idx}
                fill={bucket.outOfBand ? '#f87171' : '#22d3ee'}
                fillOpacity={bucket.outOfBand ? 0.75 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] font-mono text-[color:var(--nfq-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan-400 opacity-65" />
          In-band
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400 opacity-75" />
          Out-of-band
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-px border-l-2 border-dashed border-amber-400" />
          Tolerance
        </span>
      </div>
    </div>
  );
};

export default VarianceDistributionChart;
