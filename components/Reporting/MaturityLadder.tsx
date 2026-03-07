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

const MaturityLadder: React.FC<Props> = ({ deals }) => {
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
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(val: any) => fmtM(Number(val))}
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
            <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800">
              <th className="py-2 text-left pl-2">Bucket</th>
              <th className="py-2 text-right">Assets</th>
              <th className="py-2 text-right">Liabilities</th>
              <th className="py-2 text-right">Net Gap</th>
              <th className="py-2 text-right pr-2">Cumulative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map(row => (
              <tr key={row.bucket} className="hover:bg-slate-900/30">
                <td className="py-1.5 pl-2 font-mono font-bold text-slate-300">{row.bucket}</td>
                <td className="py-1.5 text-right font-mono text-cyan-400">{row.assets > 0 ? fmtM(row.assets) : '-'}</td>
                <td className="py-1.5 text-right font-mono text-red-400">{row.liabilities < 0 ? fmtM(row.liabilities) : '-'}</td>
                <td className={`py-1.5 text-right font-mono font-bold ${row.netGap >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {fmtM(row.netGap)}
                </td>
                <td className={`py-1.5 text-right pr-2 font-mono ${row.cumGap >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtM(row.cumGap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MaturityLadder;
