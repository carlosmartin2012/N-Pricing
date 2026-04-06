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
  <div className="group relative rounded border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-slate-600">
    <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => onEdit(card)} className="text-slate-400 hover:text-cyan-400">
        <Edit size={14} />
      </button>
      <button onClick={() => onDelete(card.id)} className="text-slate-400 hover:text-red-400">
        <Trash2 size={14} />
      </button>
    </div>

    <div className="mb-2 flex items-center gap-2">
      <Badge variant={card.type === 'Liquidity' ? 'warning' : card.type === 'Commercial' ? 'success' : 'default'}>
        {card.type}
      </Badge>
      <Badge variant="default">{card.currency}</Badge>
    </div>
    <h4 className="mb-1 text-sm font-bold text-slate-200">{card.name}</h4>
    <div className="mb-4 font-mono text-[10px] text-slate-500">{card.id}</div>

    <div className="rounded border border-slate-800/50 bg-slate-900/50 p-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(card.points || []).map((point, index) => (
          <div key={`${card.id}-${index}`} className="min-w-[50px] flex-shrink-0 rounded bg-slate-800 px-2 py-1 text-center">
            <div className="text-[9px] font-bold text-slate-400">{point.tenor}</div>
            <div className={`font-mono text-xs font-bold ${point.rate >= 0 ? 'text-cyan-400' : 'text-emerald-400'}`}>
              {point.rate}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default RateCardCard;
