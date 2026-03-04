import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface Props {
  deals: Transaction[];
}

const SHOCK_SCENARIOS = [-200, -100, -50, 0, 50, 100, 200];

/**
 * Calculate Net Interest Income sensitivity under parallel rate shocks.
 * Fixed-rate deals: NII unchanged by shock.
 * Floating-rate deals: NII moves 1:1 with rate shock on the margin.
 */
const NIISensitivity: React.FC<Props> = ({ deals }) => {
  const data = useMemo(() => {
    // Base NII calculation
    const calcNII = (shockBps: number) => {
      let totalNII = 0;
      deals.forEach(deal => {
        const notional = deal.amount || 0;
        if (notional === 0) return;

        const baseMargin = deal.marginTarget || 0;
        const isFixed = deal.repricingFreq === 'Fixed';
        const isAsset = deal.category === 'Asset';
        const isLiability = deal.category === 'Liability';

        // For assets: NII = notional * (margin + shock for floating) / 100
        // For liabilities: negative NII (cost of funding)
        let effectiveMargin = baseMargin;
        if (!isFixed) {
          // Floating rate: shock applies to both asset yield and funding cost
          // Net effect: for assets, higher rates increase NII if spread is maintained
          effectiveMargin += shockBps / 100;
        }

        const annualNII = notional * (effectiveMargin / 100);

        if (isAsset) totalNII += annualNII;
        else if (isLiability) totalNII -= Math.abs(annualNII);
      });
      return totalNII;
    };

    const baseNII = calcNII(0);

    return SHOCK_SCENARIOS.map(shock => {
      const nii = calcNII(shock);
      const delta = nii - baseNII;
      const deltaPct = baseNII !== 0 ? (delta / Math.abs(baseNII)) * 100 : 0;
      return {
        scenario: `${shock >= 0 ? '+' : ''}${shock}bp`,
        shockBps: shock,
        nii: nii / 1e6, // in millions
        delta: delta / 1e6,
        deltaPct,
        isBase: shock === 0,
      };
    });
  }, [deals]);

  const fmtM = (v: number) => `$${v.toFixed(2)}M`;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        {data.filter(d => d.shockBps === -200 || d.shockBps === 0 || d.shockBps === 200).map(d => (
          <div key={d.shockBps} className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
              {d.isBase ? 'Base NII' : `NII @ ${d.scenario}`}
            </div>
            <div className="text-xl font-mono font-bold text-white">{fmtM(d.nii)}</div>
            {!d.isBase && (
              <div className={`text-xs font-mono ${d.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.delta >= 0 ? '+' : ''}{fmtM(d.delta)} ({d.deltaPct >= 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%)
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="scenario" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(val: number) => fmtM(val)}
            />
            <ReferenceLine y={data.find(d => d.isBase)?.nii || 0} stroke="#475569" strokeDasharray="3 3" />
            <Bar dataKey="nii" name="Net Interest Income" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isBase ? '#06b6d4' : entry.delta >= 0 ? '#10b981' : '#f43f5e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800">
              <th className="py-2 text-left pl-2">Scenario</th>
              <th className="py-2 text-right">NII ($M)</th>
              <th className="py-2 text-right">Delta ($M)</th>
              <th className="py-2 text-right pr-2">Delta %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map(row => (
              <tr key={row.shockBps} className={`hover:bg-slate-900/30 ${row.isBase ? 'bg-slate-800/30 font-bold' : ''}`}>
                <td className="py-1.5 pl-2 font-mono text-slate-300">{row.scenario}</td>
                <td className="py-1.5 text-right font-mono text-white">{fmtM(row.nii)}</td>
                <td className={`py-1.5 text-right font-mono ${row.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.isBase ? '-' : `${row.delta >= 0 ? '+' : ''}${fmtM(row.delta)}`}
                </td>
                <td className={`py-1.5 text-right pr-2 font-mono ${row.deltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.isBase ? '-' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NIISensitivity;
