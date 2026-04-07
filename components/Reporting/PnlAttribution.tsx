import React, { useMemo } from 'react';
import type {
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';
import type { DataContextType } from '../../contexts/DataContext';
import { calculatePricing } from '../../utils/pricingEngine';
import { buildPricingContext } from '../../utils/pricingContext';

type PricingContextData = Pick<
  DataContextType,
  | 'approvalMatrix'
  | 'behaviouralModels'
  | 'ftpRateCards'
  | 'liquidityCurves'
  | 'physicalGrid'
  | 'greeniumGrid'
  | 'rules'
  | 'transitionGrid'
  | 'yieldCurves'
>;

interface Props {
  deals: Transaction[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  clients: ClientEntity[];
  contextData: PricingContextData;
}

const PnlAttribution: React.FC<Props> = React.memo(({ deals, products, businessUnits, clients, contextData }) => {
  const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
  const pricingContext = useMemo(
    () => buildPricingContext({
      yieldCurves: contextData.yieldCurves,
      liquidityCurves: contextData.liquidityCurves,
      rules: contextData.rules,
      ftpRateCards: contextData.ftpRateCards,
      transitionGrid: contextData.transitionGrid,
      physicalGrid: contextData.physicalGrid,
      greeniumGrid: contextData.greeniumGrid,
      behaviouralModels: contextData.behaviouralModels,
    }, { clients, products, businessUnits }),
    [
      contextData.yieldCurves,
      contextData.liquidityCurves,
      contextData.rules,
      contextData.ftpRateCards,
      contextData.transitionGrid,
      contextData.physicalGrid,
      contextData.behaviouralModels,
      clients,
      products,
      businessUnits,
    ]
  );

  const attribution = useMemo(() => {
    return bookedDeals.map(deal => {
      const result = calculatePricing(deal, contextData.approvalMatrix, pricingContext);
      const nii = deal.amount * (result.finalClientRate / 100);
      const ftpCost = deal.amount * (result.totalFTP / 100);
      const creditCost = deal.amount * (result.regulatoryCost / 100);
      const opCost = deal.amount * (result.operationalCost / 100);
      const capitalCost = deal.amount * (result.capitalCharge / 100);
      const netMargin = nii - ftpCost;
      const buName = businessUnits.find(bu => bu.id === deal.businessUnit)?.name || deal.businessUnit;

      return {
        id: deal.id,
        buName,
        product: deal.productType,
        amount: deal.amount,
        currency: deal.currency,
        nii,
        ftpCost,
        creditCost,
        opCost,
        capitalCost,
        netMargin,
        raroc: result.raroc,
        approvalLevel: result.approvalLevel,
      };
    });
  }, [bookedDeals, contextData.approvalMatrix, pricingContext, businessUnits]);

  const totals = useMemo(() => ({
    nii: attribution.reduce((sum, item) => sum + item.nii, 0),
    ftpCost: attribution.reduce((sum, item) => sum + item.ftpCost, 0),
    creditCost: attribution.reduce((sum, item) => sum + item.creditCost, 0),
    opCost: attribution.reduce((sum, item) => sum + item.opCost, 0),
    capitalCost: attribution.reduce((sum, item) => sum + item.capitalCost, 0),
    netMargin: attribution.reduce((sum, item) => sum + item.netMargin, 0),
  }), [attribution]);

  const fmtM = (value: number) => `$${(value / 1e6).toFixed(2)}M`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
        {[
          { label: 'Gross NII', value: totals.nii, color: 'text-emerald-400' },
          { label: 'FTP Cost', value: -totals.ftpCost, color: 'text-amber-400' },
          { label: 'Credit Cost', value: -totals.creditCost, color: 'text-red-400' },
          { label: 'Op. Cost', value: -totals.opCost, color: 'text-red-400' },
          { label: 'Capital Cost', value: -totals.capitalCost, color: 'text-red-400' },
          { label: 'Net Margin', value: totals.netMargin, color: totals.netMargin >= 0 ? 'text-cyan-400' : 'text-red-400' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-white/10 bg-[#0f172a]/40 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">{kpi.label}</div>
            <div className={`text-lg font-mono font-bold ${kpi.color}`}>{fmtM(kpi.value)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-left font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Deal</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-left font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">BU</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">NII</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">FTP Cost</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Net Margin</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">RAROC</th>
              <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Approval</th>
            </tr>
          </thead>
          <tbody>
            {attribution.map(item => (
              <tr key={item.id} className="transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-mono text-[var(--nfq-accent)] [font-variant-numeric:tabular-nums]">{item.id}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-tertiary)]">{item.buName}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[var(--nfq-success)] [font-variant-numeric:tabular-nums]">{fmtM(item.nii)}</td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[var(--nfq-warning)] [font-variant-numeric:tabular-nums]">{fmtM(item.ftpCost)}</td>
                <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono font-bold [font-variant-numeric:tabular-nums] ${item.netMargin >= 0 ? 'text-[var(--nfq-accent)]' : 'text-[var(--nfq-danger)]'}`}>
                  {fmtM(item.netMargin)}
                </td>
                <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono [font-variant-numeric:tabular-nums] ${item.raroc >= 15 ? 'text-[var(--nfq-success)]' : item.raroc > 0 ? 'text-[var(--nfq-warning)]' : 'text-[var(--nfq-danger)]'}`}>
                  {item.raroc.toFixed(1)}%
                </td>
                <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-mono text-[10px] font-bold uppercase">{item.approvalLevel}</td>
              </tr>
            ))}
            {attribution.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[color:var(--nfq-text-muted)]">No booked deals</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default PnlAttribution;
