import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  deals: Transaction[];
}

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

const CurrencyGap: React.FC<Props> = ({ deals }) => {
  const data = useMemo(() => {
    const byCurrency: Record<string, { assets: number; liabilities: number; offBalance: number; count: number }> = {};

    deals.forEach(deal => {
      const ccy = deal.currency || 'USD';
      if (!byCurrency[ccy]) byCurrency[ccy] = { assets: 0, liabilities: 0, offBalance: 0, count: 0 };
      byCurrency[ccy].count++;
      const amt = deal.amount || 0;
      if (deal.category === 'Asset') byCurrency[ccy].assets += amt;
      else if (deal.category === 'Liability') byCurrency[ccy].liabilities += amt;
      else byCurrency[ccy].offBalance += amt;
    });

    const totalVolume = Object.values(byCurrency).reduce((s, v) => s + v.assets + v.liabilities + v.offBalance, 0);

    return Object.entries(byCurrency)
      .map(([ccy, v]) => ({
        currency: ccy,
        assets: v.assets,
        liabilities: v.liabilities,
        offBalance: v.offBalance,
        netPosition: v.assets - v.liabilities,
        totalVolume: v.assets + v.liabilities + v.offBalance,
        pctOfTotal: totalVolume > 0 ? ((v.assets + v.liabilities + v.offBalance) / totalVolume) * 100 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [deals]);

  const pieData = data.map(d => ({ name: d.currency, value: d.totalVolume }));

  const fmtM = (v: number) => {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }: any) => `${name || ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#475569' }}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(val: any) => fmtM(Number(val))}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="space-y-2">
          {data.map((row, idx) => (
            <div key={row.currency} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded border border-slate-800/50">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{row.currency}</div>
                <div className="text-[10px] text-slate-500">{row.count} deals</div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-mono font-bold ${row.netPosition >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.netPosition >= 0 ? '+' : ''}{fmtM(row.netPosition)}
                </div>
                <div className="text-[10px] text-slate-500">{row.pctOfTotal.toFixed(1)}% vol</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800">
              <th className="py-2 text-left pl-2">Currency</th>
              <th className="py-2 text-right">Assets</th>
              <th className="py-2 text-right">Liabilities</th>
              <th className="py-2 text-right">Off-Balance</th>
              <th className="py-2 text-right">Net Position</th>
              <th className="py-2 text-right pr-2">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map(row => (
              <tr key={row.currency} className="hover:bg-slate-900/30">
                <td className="py-1.5 pl-2 font-mono font-bold text-slate-300">{row.currency}</td>
                <td className="py-1.5 text-right font-mono text-cyan-400">{fmtM(row.assets)}</td>
                <td className="py-1.5 text-right font-mono text-red-400">{fmtM(row.liabilities)}</td>
                <td className="py-1.5 text-right font-mono text-slate-400">{fmtM(row.offBalance)}</td>
                <td className={`py-1.5 text-right font-mono font-bold ${row.netPosition >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {row.netPosition >= 0 ? '+' : ''}{fmtM(row.netPosition)}
                </td>
                <td className="py-1.5 text-right pr-2 font-mono text-slate-400">{row.pctOfTotal.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CurrencyGap;
