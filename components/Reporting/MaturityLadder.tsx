import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  deals: Transaction[];
}

const BUCKETS = [
  { label: 'ON', maxMonths: 0.25 },
  { label: '1M', maxMonths: 1 },
  { label: '3M', maxMonths: 3 },
  { label: '6M', maxMonths: 6 },
  { label: '1Y', maxMonths: 12 },
  { label: '2Y', maxMonths: 24 },
  { label: '3Y', maxMonths: 36 },
  { label: '5Y', maxMonths: 60 },
  { label: '7Y', maxMonths: 84 },
  { label: '10Y', maxMonths: 120 },
  { label: '>10Y', maxMonths: Infinity },
];

function getBucket(months: number): string {
  for (const b of BUCKETS) {
    if (months <= b.maxMonths) return b.label;
  }
  return '>10Y';
}

const MaturityLadder: React.FC<Props> = React.memo(({ deals }) => {
  const data = useMemo(() => {
    const bucketMap: Record<string, { assets: number; liabilities: number }> = {};
    BUCKETS.forEach(b => { bucketMap[b.label] = { assets: 0, liabilities: 0 }; });

    deals.forEach(deal => {
      if (!deal.durationMonths || !deal.amount) return;
      const bucket = getBucket(deal.durationMonths);
      const amtM = deal.amount / 1e6;
      if (deal.category === 'Asset') {
        bucketMap[bucket].assets += amtM;
      } else if (deal.category === 'Liability') {
        bucketMap[bucket].liabilities += amtM;
      }
    });

    let cumGap = 0;
    return BUCKETS.map(b => {
      const d = bucketMap[b.label];
      const gap = d.assets - d.liabilities;
      cumGap += gap;
      return {
        bucket: b.label,
        assets: +d.assets.toFixed(2),
        liabilities: +(-d.liabilities).toFixed(2),
        netGap: +gap.toFixed(2),
        cumGap: +cumGap.toFixed(2),
      };
    });
  }, [deals]);

  const fmtM = (v: number) => `${v >= 0 ? '' : '-'}$${Math.abs(v).toFixed(1)}M`;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--nfq-bg-elevated)', border: '1px solid var(--nfq-border-ghost)', borderRadius: 'var(--nfq-radius-lg)', padding: '8px 12px', fontFamily: 'var(--nfq-font-mono)', fontSize: 12 }}
              formatter={(val: number | string | undefined) => fmtM(Number(val ?? 0))}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="assets" fill="#06b6d4" name="Assets" radius={[4, 4, 0, 0]} />
            <Bar dataKey="liabilities" fill="#f43f5e" name="Liabilities" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-left font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Bucket</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Assets</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Liabilities</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Net Gap</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.bucket} className="transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-mono font-bold text-[color:var(--nfq-text-secondary)]">{row.bucket}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[var(--nfq-info)] [font-variant-numeric:tabular-nums]">{row.assets > 0 ? fmtM(row.assets) : '-'}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[var(--nfq-danger)] [font-variant-numeric:tabular-nums]">{row.liabilities < 0 ? fmtM(row.liabilities) : '-'}</td>
                <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono font-bold [font-variant-numeric:tabular-nums] ${row.netGap >= 0 ? 'text-[var(--nfq-success)]' : 'text-[var(--nfq-warning)]'}`}>
                  {fmtM(row.netGap)}
                </td>
                <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums] ${row.cumGap >= 0 ? 'text-[var(--nfq-success)]' : 'text-[var(--nfq-danger)]'}`}>
                  {fmtM(row.cumGap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default MaturityLadder;
