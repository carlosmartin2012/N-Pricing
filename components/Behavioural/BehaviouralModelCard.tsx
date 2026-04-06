import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import type { BehaviouralModel } from '../../types';

interface Props {
  model: BehaviouralModel;
  onEdit: (model: BehaviouralModel) => void;
  onDelete: (id: string) => void;
}

const BehaviouralModelCard: React.FC<Props> = React.memo(({
  model,
  onEdit,
  onDelete,
}) => (
  <div className="group relative flex flex-col rounded border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-slate-600">
    <div className="absolute right-4 top-4 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => onEdit(model)} className="text-slate-400 hover:text-cyan-400">
        <Edit size={14} />
      </button>
      <button onClick={() => onDelete(model.id)} className="text-slate-400 hover:text-red-400">
        <Trash2 size={14} />
      </button>
    </div>

    <div className="mb-2 flex items-center gap-2">
      <div className={`h-8 w-2 rounded-sm ${model.type === 'Prepayment_CPR' ? 'bg-amber-500' : 'bg-purple-500'}`} />
      <div>
        <h4 className="text-sm font-bold text-slate-200">{model.name}</h4>
        <span className="font-mono text-[10px] text-cyan-500">{model.id}</span>
      </div>
    </div>

    <p className="mb-4 line-clamp-2 text-xs text-slate-500">{model.description}</p>

    <div className="grid flex-1 grid-cols-2 gap-x-2 gap-y-3 rounded border border-slate-800 bg-slate-900 p-3">
      {model.type === 'NMD_Replication' ? (
        <>
          <div className="col-span-2 mb-1 border-b border-slate-800 pb-2">
            <div className="nfq-label mb-2 text-[9px]">Core & Sensitivity</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] text-slate-500">Core Ratio</div>
                <div className="font-mono text-sm text-emerald-400">{model.coreRatio}%</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-slate-500">Beta</div>
                <div className="font-mono text-sm text-cyan-400">{model.betaFactor}</div>
              </div>
            </div>
          </div>

          <div className="col-span-2 mt-1">
            <div className="mb-1 flex items-end justify-between">
              <span className="nfq-label text-[9px]">Replication Profile</span>
              <span className="text-[9px] text-slate-500">{model.replicationProfile?.length || 0} Tranches</span>
            </div>
            <div className="space-y-1">
              {model.replicationProfile?.slice(0, 2).map((tranche, index) => (
                <div key={`${model.id}-${index}`} className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-300">{tranche.term}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-purple-500" style={{ width: `${tranche.weight}%` }} />
                    </div>
                    <span className="w-6 text-right text-purple-400">{tranche.weight}%</span>
                  </div>
                </div>
              ))}
              {(model.replicationProfile?.length || 0) > 2 && (
                <div className="pt-1 text-center text-[9px] text-slate-600">
                  + {model.replicationProfile!.length - 2} more tranches
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="nfq-label text-[9px]">CPR (Speed)</div>
            <div className="font-mono text-sm text-amber-400">{model.cpr}%</div>
          </div>
          <div>
            <div className="nfq-label text-[9px]">Penalty Free</div>
            <div className="font-mono text-sm text-white">{model.penaltyExempt}%</div>
          </div>
          <div className="col-span-2">
            <div className="nfq-label text-[9px]">Prepayment Curve</div>
            <div className="mt-1 flex h-6 items-end gap-0.5">
              {[2, 3, 4, 5, 5, 5, 5, 4, 3, 2].map((height, index) => (
                <div
                  key={`${model.id}-curve-${index}`}
                  className="flex-1 border-t border-amber-500 bg-amber-500/30"
                  style={{ height: `${height * 20}%` }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
));

export default BehaviouralModelCard;
