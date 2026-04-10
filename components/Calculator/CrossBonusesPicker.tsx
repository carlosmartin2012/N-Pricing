import React, { useCallback } from 'react';
import { Check, Plus, Minus } from 'lucide-react';
import { DEFAULT_CROSS_BONUS_CATALOGUE } from '../../utils/pricing/crossBonuses';

export interface CrossBonusesPickerProps {
  attachments: Array<{ ruleId: string; overrideProbability?: number }>;
  onChange: (
    attachments: Array<{ ruleId: string; overrideProbability?: number }>,
  ) => void;
}

/**
 * CrossBonusesPicker — selector de bonificaciones cruzadas.
 *
 * Permite asociar productos vinculados (nómina, seguros, plan pensiones…)
 * del catálogo `DEFAULT_CROSS_BONUS_CATALOGUE` a un deal, con posibilidad
 * de ajustar la probabilidad de cumplimiento por regla.
 */
export const CrossBonusesPicker: React.FC<CrossBonusesPickerProps> = ({
  attachments,
  onChange,
}) => {
  const attachmentByRuleId = new Map(
    attachments.map((att) => [att.ruleId, att] as const),
  );

  const toggleRule = useCallback(
    (ruleId: string) => {
      if (attachmentByRuleId.has(ruleId)) {
        onChange(attachments.filter((att) => att.ruleId !== ruleId));
      } else {
        onChange([...attachments, { ruleId }]);
      }
    },
    [attachments, attachmentByRuleId, onChange],
  );

  const updateProbability = useCallback(
    (ruleId: string, probabilityPct: number) => {
      const clamped = Math.min(100, Math.max(0, probabilityPct));
      const next = attachments.map((att) =>
        att.ruleId === ruleId
          ? { ...att, overrideProbability: clamped / 100 }
          : att,
      );
      onChange(next);
    },
    [attachments, onChange],
  );

  const resetProbability = useCallback(
    (ruleId: string) => {
      const next = attachments.map((att) => {
        if (att.ruleId !== ruleId) return att;
        const { overrideProbability: _omit, ...rest } = att;
        return rest;
      });
      onChange(next);
    },
    [attachments, onChange],
  );

  // Summary: total expected bps across attached rules weighted by probability
  const totalExpectedBps = attachments.reduce((sum, att) => {
    const rule = DEFAULT_CROSS_BONUS_CATALOGUE.find((r) => r.id === att.ruleId);
    if (!rule) return sum;
    const prob = att.overrideProbability ?? rule.fulfillmentProbability;
    return sum + rule.rateDiscountBps * prob;
  }, 0);

  const attachedCount = attachments.length;

  return (
    <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-6">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-200">
          Bonificaciones cruzadas
        </h3>
        <p className="mt-1 text-[11px] text-[var(--nfq-text-muted)]">
          Productos vinculados que reducen la tasa al cliente
        </p>
      </div>

      {/* Rule list */}
      <div className="flex flex-col gap-2">
        {DEFAULT_CROSS_BONUS_CATALOGUE.map((rule) => {
          const attachment = attachmentByRuleId.get(rule.id);
          const isAttached = attachment !== undefined;
          const effectiveProb =
            attachment?.overrideProbability ?? rule.fulfillmentProbability;
          const hasOverride = attachment?.overrideProbability !== undefined;

          return (
            <div
              key={rule.id}
              className={`flex items-center gap-3 rounded-[8px] bg-[var(--nfq-bg-elevated)] p-3 transition-all ${
                isAttached ? 'ring-1 ring-[var(--nfq-accent)]/40' : ''
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleRule(rule.id)}
                aria-pressed={isAttached}
                aria-label={
                  isAttached
                    ? `Desvincular ${rule.label}`
                    : `Vincular ${rule.label}`
                }
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  isAttached
                    ? 'border-[var(--nfq-accent)] bg-[var(--nfq-accent)]/20 text-[var(--nfq-accent)]'
                    : 'border-slate-600 bg-slate-800/60 text-transparent hover:border-slate-400'
                }`}
              >
                {isAttached && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>

              {/* Label */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-200">
                  {rule.label}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--nfq-text-muted)] font-mono">
                  <span>{`€${rule.annualMarginEur}/año`}</span>
                  <span className="text-slate-600">·</span>
                  <span>
                    {`${Math.round(effectiveProb * 100)}%`}
                    {hasOverride && (
                      <span className="ml-1 text-[var(--nfq-accent)]">
                        (ajustada)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Rate discount badge */}
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--nfq-coral)]/10 text-[var(--nfq-coral)] shrink-0">
                {`-${rule.rateDiscountBps}bp`}
              </span>

              {/* Probability override input (only when attached) */}
              {isAttached && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      updateProbability(
                        rule.id,
                        Math.round(effectiveProb * 100) - 5,
                      )
                    }
                    aria-label="Reducir probabilidad"
                    className="flex h-6 w-6 items-center justify-center rounded border border-[var(--nfq-border-ghost)] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(effectiveProb * 100)}
                    onChange={(event) => {
                      const next = parseInt(event.target.value, 10);
                      if (!Number.isNaN(next)) {
                        updateProbability(rule.id, next);
                      }
                    }}
                    onDoubleClick={() => resetProbability(rule.id)}
                    title="Doble click para restablecer"
                    className="h-6 w-12 rounded border border-[var(--nfq-border-ghost)] bg-slate-900/60 px-1 text-center font-mono text-[11px] text-slate-200 focus:border-[var(--nfq-accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateProbability(
                        rule.id,
                        Math.round(effectiveProb * 100) + 5,
                      )
                    }
                    aria-label="Aumentar probabilidad"
                    className="flex h-6 w-6 items-center justify-center rounded border border-[var(--nfq-border-ghost)] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-5 flex items-center justify-between rounded-[8px] bg-[var(--nfq-bg-elevated)] px-4 py-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--nfq-text-muted)]">
          Total esperado
        </span>
        <span className="font-mono text-xs font-bold text-slate-100">
          {`${attachedCount} ${
            attachedCount === 1 ? 'bonificación' : 'bonificaciones'
          } · −${totalExpectedBps.toFixed(1)} bps total esperado`}
        </span>
      </div>
    </div>
  );
};

export default CrossBonusesPicker;
