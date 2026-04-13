import React, { useMemo, useState, useEffect } from 'react';
import { Target, TrendingDown, TrendingUp, Clock, X as XIcon } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { TextInput } from '../ui/LayoutComponents';
import type { Transaction } from '../../types';
import {
  WON_LOST_OPTIONS,
  LOSS_REASON_OPTIONS,
  buildOutcomePatch,
  getOutcomeStyle,
  type WonLost,
  type LossReason,
} from '../../utils/dealOutcome';

interface Props {
  isOpen: boolean;
  deal?: Transaction;
  onClose: () => void;
  onSave: (patch: Partial<Transaction>) => void | Promise<void>;
}

const OUTCOME_ICON: Record<WonLost, React.ReactNode> = {
  WON: <TrendingUp size={14} />,
  LOST: <TrendingDown size={14} />,
  PENDING: <Clock size={14} />,
  WITHDRAWN: <XIcon size={14} />,
};

/**
 * Drawer UI to capture deal outcome for elasticity calibration.
 *
 * Required: wonLost.
 * Required when LOST: lossReason.
 * Optional: competitorRate (when client discloses best competitor offer).
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque A
 */
const DealOutcomeDrawer: React.FC<Props> = ({ isOpen, deal, onClose, onSave }) => {
  const [wonLost, setWonLost] = useState<WonLost | undefined>(deal?.wonLost);
  const [lossReason, setLossReason] = useState<LossReason | undefined>(deal?.lossReason);
  const [competitorRate, setCompetitorRate] = useState<string>(
    deal?.competitorRate != null ? String(deal.competitorRate) : '',
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when a different deal is loaded into the drawer.
  useEffect(() => {
    setWonLost(deal?.wonLost);
    setLossReason(deal?.lossReason);
    setCompetitorRate(deal?.competitorRate != null ? String(deal.competitorRate) : '');
  }, [deal?.id, deal?.wonLost, deal?.lossReason, deal?.competitorRate]);

  const canSave = useMemo(() => {
    if (!wonLost) return false;
    if (wonLost === 'LOST' && !lossReason) return false;
    return true;
  }, [wonLost, lossReason]);

  const handleSave = async () => {
    if (!wonLost || !canSave) return;
    const parsedCompetitor = competitorRate.trim() === '' ? undefined : Number(competitorRate);
    const patch = buildOutcomePatch({
      wonLost,
      lossReason,
      competitorRate: Number.isFinite(parsedCompetitor as number) ? (parsedCompetitor as number) : undefined,
    });
    setIsSaving(true);
    try {
      await onSave(patch);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!deal) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Capture Deal Outcome"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
            Fuels elasticity calibration
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="rounded bg-[var(--nfq-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? 'Saving…' : 'Save outcome'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 p-4">
        {/* Deal context header */}
        <div className="rounded-[10px] bg-[var(--nfq-bg-surface)] p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
            Deal
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <span className="font-mono text-xs text-[color:var(--nfq-text-primary)]">
              {deal.id ?? '—'}
            </span>
            <span className="text-[11px] text-[color:var(--nfq-text-secondary)]">
              {deal.productType} · {deal.clientType} · {deal.currency}{' '}
              {deal.amount.toLocaleString('es-ES')}
            </span>
          </div>
        </div>

        {/* Outcome radio group */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
            Outcome
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {WON_LOST_OPTIONS.map((opt) => {
              const isActive = wonLost === opt.value;
              const style = getOutcomeStyle(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => setWonLost(opt.value)}
                  className={`flex flex-col items-start gap-1 rounded-[10px] p-3 text-left transition-colors ${
                    isActive
                      ? 'bg-[var(--nfq-bg-highest)] ring-1 ring-[var(--nfq-accent)]'
                      : 'bg-[var(--nfq-bg-surface)] hover:bg-[var(--nfq-bg-bright)]'
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${style.text}`}>
                    {OUTCOME_ICON[opt.value]}
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-[color:var(--nfq-text-muted)]">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loss reason — only when LOST */}
        {wonLost === 'LOST' && (
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
              Loss reason (required)
            </label>
            <div className="mt-2 space-y-1">
              {LOSS_REASON_OPTIONS.map((opt) => {
                const isActive = lossReason === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setLossReason(opt.value)}
                    className={`flex w-full items-start justify-between gap-3 rounded-[10px] p-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-[var(--nfq-bg-highest)] ring-1 ring-[var(--nfq-accent)]'
                        : 'bg-[var(--nfq-bg-surface)] hover:bg-[var(--nfq-bg-bright)]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-[color:var(--nfq-text-muted)]">
                        {opt.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Competitor rate — optional, prompts on LOST */}
        {(wonLost === 'LOST' || wonLost === 'WON') && (
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
              <Target size={10} />
              Competitor rate (optional)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                type="number"
                step="0.01"
                value={competitorRate}
                onChange={(e) => setCompetitorRate(e.target.value)}
                placeholder="e.g. 4.18"
                className="h-8 w-28 text-right text-xs font-mono"
              />
              <span className="text-[11px] text-[color:var(--nfq-text-muted)]">%</span>
              <span className="ml-2 text-[11px] text-[color:var(--nfq-text-muted)]">
                ¿Viste precio competidor durante la negociación?
              </span>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default DealOutcomeDrawer;
