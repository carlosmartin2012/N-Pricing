import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/LayoutComponents';
import type { FtpRateCard } from '../../../types';

interface Props {
  card: FtpRateCard;
  onEdit: (card: FtpRateCard) => void;
  onDelete: (id: string) => void;
}

const RateCardCard: React.FC<Props> = ({
  card,
  onEdit,
  onDelete,
}) => (
  <div className="group relative rounded border border-slate-800 bg-[var(--nfq-bg-root)] p-4 transition-colors hover:border-slate-600">
    <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => onEdit(card)} className="text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-accent)]">
        <Edit size={14} />
      </button>
      <button onClick={() => onDelete(card.id)} className="text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-danger)]">
        <Trash2 size={14} />
      </button>
    </div>

    <div className="mb-2 flex items-center gap-2">
      <Badge variant={card.type === 'Liquidity' ? 'warning' : card.type === 'Commercial' ? 'success' : 'default'}>
        {card.type}
      </Badge>
      <Badge variant="default">{card.currency}</Badge>
    </div>
    <h4 className="mb-1 text-sm font-bold text-[color:var(--nfq-text-secondary)]">{card.name}</h4>
    <div className="mb-4 font-mono text-[10px] text-[color:var(--nfq-text-faint)]">{card.id}</div>

    <div className="rounded border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/50 p-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(card.points || []).map((point, index) => (
          <div key={`${card.id}-${index}`} className="min-w-[50px] flex-shrink-0 rounded bg-[var(--nfq-bg-highest)] px-2 py-1 text-center">
            <div className="text-[9px] font-bold text-[color:var(--nfq-text-muted)]">{point.tenor}</div>
            <div className={`font-mono text-xs font-bold ${point.rate >= 0 ? 'text-[color:var(--nfq-accent)]' : 'text-[color:var(--nfq-success)]'}`}>
              {point.rate}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default RateCardCard;
