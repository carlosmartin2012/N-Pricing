import React from 'react';
import { Edit } from 'lucide-react';
import { Badge } from '../../ui/LayoutComponents';
import type {
  GreeniumRateCard,
  PhysicalRateCard,
  TransitionRateCard,
} from '../../../types';
import type { EsgSubTab } from './esgGridUtils';

interface Props {
  esgSubTab: EsgSubTab;
  items: TransitionRateCard[] | PhysicalRateCard[] | GreeniumRateCard[];
  onEdit: (item: TransitionRateCard | PhysicalRateCard | GreeniumRateCard) => void;
}

const ESGGridTable: React.FC<Props> = ({
  esgSubTab,
  items,
  onEdit,
}) => (
  <div className="flex-1 overflow-auto">
    <table className="w-full text-left">
      <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
        <tr>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">
            {esgSubTab === 'TRANSITION' ? 'Classification' : esgSubTab === 'GREENIUM' ? 'Green Format' : 'Risk Level'}
          </th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">
            {esgSubTab === 'TRANSITION' ? 'Sector' : esgSubTab === 'GREENIUM' ? 'Sector' : 'Location / Asset Type'}
          </th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Description</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 text-right font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Spread (bps)</th>
          <th className="w-16 border-b border-[color:var(--nfq-border)] px-4 py-2" />
        </tr>
      </thead>
      <tbody className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
        {items.map((item) => (
          <tr key={item.id} className="group transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              {esgSubTab === 'TRANSITION' ? (
                <Badge variant={(item as TransitionRateCard).classification === 'Green' ? 'success' : (item as TransitionRateCard).classification === 'Brown' ? 'danger' : 'default'}>
                  {(item as TransitionRateCard).classification}
                </Badge>
              ) : esgSubTab === 'GREENIUM' ? (
                <Badge variant="success">
                  {(item as GreeniumRateCard).greenFormat.replace(/_/g, ' ')}
                </Badge>
              ) : (
                <Badge variant={(item as PhysicalRateCard).riskLevel === 'Low' ? 'success' : (item as PhysicalRateCard).riskLevel === 'High' ? 'danger' : 'warning'}>
                  {(item as PhysicalRateCard).riskLevel}
                </Badge>
              )}
            </td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              {esgSubTab === 'TRANSITION'
                ? (item as TransitionRateCard).sector
                : esgSubTab === 'GREENIUM'
                ? (item as GreeniumRateCard).sector
                : (item as PhysicalRateCard).locationType}
            </td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-tertiary)]">{item.description}</td>
            <td className={`border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right font-bold [font-variant-numeric:tabular-nums] ${item.adjustmentBps < 0 ? 'text-[var(--nfq-success)]' : item.adjustmentBps > 0 ? 'text-[var(--nfq-danger)]' : 'text-[color:var(--nfq-text-muted)]'}`}>
              {item.adjustmentBps > 0 ? '+' : ''}{item.adjustmentBps}
            </td>
            <td className="flex gap-2 border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right opacity-0 transition-opacity group-hover:opacity-100">
              <button onClick={() => onEdit(item)} className="text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-accent)]">
                <Edit size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ESGGridTable;
