import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Users } from 'lucide-react';
import type { Transaction, ClientEntity } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { useCoreData, useMarketData } from '../../contexts/DataContext';
import { buildPricingContext } from '../../utils/pricingContext';

interface ClientMetrics {
  clientId: string;
  clientName: string;
  clientType: string;
  dealCount: number;
  totalExposure: number;
  weightedAvgRaroc: number;
  totalFtpIncome: number;
  avgMargin: number;
  esgProfile: string;
}

type SortKey = 'totalExposure' | 'dealCount' | 'weightedAvgRaroc' | 'totalFtpIncome' | 'avgMargin';

interface Props {
  deals: Transaction[];
  clients: ClientEntity[];
}

function fmtAmount(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

const ClientProfitabilityDashboard: React.FC<Props> = ({ deals, clients }) => {
  const coreData = useCoreData();
  const marketData = useMarketData();
  const [sortKey, setSortKey] = useState<SortKey>('totalExposure');
  const [sortAsc, setSortAsc] = useState(false);

  const pricingContext = useMemo(
    () => buildPricingContext(
      { yieldCurves: marketData.yieldCurves, liquidityCurves: marketData.liquidityCurves, rules: coreData.rules, ftpRateCards: marketData.ftpRateCards, transitionGrid: marketData.transitionGrid, physicalGrid: marketData.physicalGrid, greeniumGrid: marketData.greeniumGrid, behaviouralModels: marketData.behaviouralModels },
      { clients, products: coreData.products, businessUnits: coreData.businessUnits },
    ),
    [coreData, marketData, clients],
  );

  const clientMetrics = useMemo<ClientMetrics[]>(() => {
    const booked = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
    const byClient = new Map<string, Transaction[]>();
    for (const d of booked) {
      const arr = byClient.get(d.clientId) || [];
      arr.push(d);
      byClient.set(d.clientId, arr);
    }

    return Array.from(byClient.entries()).map(([clientId, clientDeals]) => {
      const client = clients.find((c) => c.id === clientId);
      const totalExposure = clientDeals.reduce((s, d) => s + (d.amount || 0), 0);
      const avgMargin = clientDeals.reduce((s, d) => s + (d.marginTarget || 0), 0) / clientDeals.length;

      let totalRarocWeighted = 0;
      let totalFtpIncome = 0;
      for (const d of clientDeals) {
        try {
          const result = calculatePricing(d, coreData.approvalMatrix, pricingContext);
          totalRarocWeighted += (result.raroc || 0) * (d.amount || 0);
          totalFtpIncome += (result.totalFTP || 0) / 100 * (d.amount || 0);
        } catch { /* skip failed pricing */ }
      }

      const esgCounts = { Green: 0, Neutral: 0, Brown: 0 };
      for (const d of clientDeals) {
        const risk = d.transitionRisk || 'Neutral';
        if (risk === 'Green') esgCounts.Green++;
        else if (risk === 'Brown' || risk === 'Amber') esgCounts.Brown++;
        else esgCounts.Neutral++;
      }
      const esgProfile = esgCounts.Green >= esgCounts.Brown ? (esgCounts.Green > 0 ? 'Green' : 'Neutral') : 'Brown';

      return {
        clientId,
        clientName: client?.name || clientId,
        clientType: client?.type || 'Unknown',
        dealCount: clientDeals.length,
        totalExposure,
        weightedAvgRaroc: totalExposure > 0 ? totalRarocWeighted / totalExposure : 0,
        totalFtpIncome,
        avgMargin,
        esgProfile,
      };
    });
  }, [deals, clients, coreData.approvalMatrix, pricingContext]);

  const sorted = useMemo(() => {
    return [...clientMetrics].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [clientMetrics, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(false); }
  };

  const totalPortfolio = clientMetrics.reduce((s, c) => s + c.totalExposure, 0);

  if (clientMetrics.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
        <Users size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
        <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">No client data</h3>
        <p className="text-sm text-[var(--nfq-text-muted)]">Book deals to see client profitability analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-4">
          <div className="nfq-label">Clients</div>
          <div className="font-mono text-2xl font-bold text-[var(--nfq-text-primary)] mt-2">{clientMetrics.length}</div>
        </div>
        <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-4">
          <div className="nfq-label">Total Exposure</div>
          <div className="font-mono text-2xl font-bold text-[var(--nfq-accent)] mt-2">{fmtAmount(totalPortfolio)}</div>
        </div>
        <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-4">
          <div className="nfq-label">Avg RAROC</div>
          <div className="font-mono text-2xl font-bold text-emerald-400 mt-2">
            {(clientMetrics.reduce((s, c) => s + c.weightedAvgRaroc, 0) / clientMetrics.length).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] p-4">
          <div className="nfq-label">FTP Income</div>
          <div className="font-mono text-2xl font-bold text-violet-400 mt-2">
            {fmtAmount(clientMetrics.reduce((s, c) => s + c.totalFtpIncome, 0))}
          </div>
        </div>
      </div>

      {/* Client Table */}
      <div className="rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--nfq-bg-surface)] text-[10px] tracking-normal text-[var(--nfq-text-muted)]">
              <th className="px-4 py-3 text-left font-medium">Client</th>
              <th className="px-3 py-3 text-center font-medium cursor-pointer" onClick={() => handleSort('dealCount')}>
                Deals <ArrowUpDown size={10} className="inline ml-0.5" />
              </th>
              <th className="px-3 py-3 text-right font-medium cursor-pointer" onClick={() => handleSort('totalExposure')}>
                Exposure <ArrowUpDown size={10} className="inline ml-0.5" />
              </th>
              <th className="px-3 py-3 text-right font-medium cursor-pointer" onClick={() => handleSort('avgMargin')}>
                Avg Margin <ArrowUpDown size={10} className="inline ml-0.5" />
              </th>
              <th className="px-3 py-3 text-right font-medium cursor-pointer" onClick={() => handleSort('weightedAvgRaroc')}>
                RAROC <ArrowUpDown size={10} className="inline ml-0.5" />
              </th>
              <th className="px-3 py-3 text-right font-medium cursor-pointer" onClick={() => handleSort('totalFtpIncome')}>
                FTP Income <ArrowUpDown size={10} className="inline ml-0.5" />
              </th>
              <th className="px-3 py-3 text-center font-medium">ESG</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.clientId} className="border-t border-[var(--nfq-border-ghost)] hover:bg-[var(--nfq-bg-elevated)] transition-colors">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[var(--nfq-text-primary)]">{c.clientName}</div>
                  <div className="text-[10px] text-[var(--nfq-text-faint)]">{c.clientId} · {c.clientType}</div>
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-[var(--nfq-text-secondary)]">{c.dealCount}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[var(--nfq-text-primary)]">{fmtAmount(c.totalExposure)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[var(--nfq-text-secondary)]">{c.avgMargin.toFixed(2)}%</td>
                <td className={`px-3 py-2.5 text-right font-mono font-semibold ${c.weightedAvgRaroc >= 12 ? 'text-emerald-400' : c.weightedAvgRaroc >= 8 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {c.weightedAvgRaroc.toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-violet-400">{fmtAmount(c.totalFtpIncome)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    c.esgProfile === 'Green' ? 'bg-emerald-500/20 text-emerald-400' :
                    c.esgProfile === 'Brown' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>{c.esgProfile}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientProfitabilityDashboard;
