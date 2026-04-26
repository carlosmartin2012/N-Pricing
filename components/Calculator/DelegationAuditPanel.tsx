import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, FTPResult } from '../../types';
import { apiPost } from '../../utils/apiFetch';
import { resolveDelegation } from '../../utils/pricing/delegationEngine';
import { Shield, Check, X, ChevronDown, ChevronRight, RefreshCw, Info } from 'lucide-react';

interface DelegationAuditPanelProps {
  deal: Transaction;
  result: FTPResult;
}

interface EvaluatedRule {
  ruleId: string;
  matched: boolean;
  failedConstraints: string[];
}

interface DelegationCheckResponse {
  tier: string;
  matchedRuleId: string | null;
  matchedRuleLabel: string;
  evaluatedRules: EvaluatedRule[];
}

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  AUTO: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Auto' },
  MANAGER_L1: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Director L1' },
  MANAGER_L2: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Director L2' },
  RISK_COMMITTEE: {
    bg: 'bg-[var(--nfq-coral)]/10',
    text: 'text-[var(--nfq-coral)]',
    label: 'Comité riesgos',
  },
  EXECUTIVE_COMMITTEE: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Comité ejecutivo',
  },
};

const CONSTRAINT_LABELS: Record<string, string> = {
  minAmount: 'Importe mínimo',
  maxAmount: 'Importe máximo',
  segment: 'Segmento',
  minRating: 'Rating mínimo',
  maxLtvPct: 'LTV máximo',
  minRaroc: 'RAROC mínimo',
  maxDiscountPct: 'Descuento máximo',
  businessUnit: 'Unidad de negocio',
  managerRole: 'Rol gestor',
};

const formatConstraintLabel = (key: string): string =>
  CONSTRAINT_LABELS[key] ?? key;

const DelegationAuditPanel: React.FC<DelegationAuditPanelProps> = ({ deal, result }) => {
  const [evaluatedRules, setEvaluatedRules] = useState<EvaluatedRule[] | null>(null);
  const [reevaluating, setReevaluating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentTier, setCurrentTier] = useState<string | undefined>(result.delegationTier);
  const [currentRuleLabel, setCurrentRuleLabel] = useState<string | undefined>(
    result.delegationRuleLabel,
  );
  const [error, setError] = useState<string | null>(null);

  const runDelegationCheck = useCallback(async () => {
    setReevaluating(true);
    setError(null);
    const input = {
      amount: deal.amount,
      segment: deal.clientType,
      rating: deal.clientRating,
      ltvPct: deal.ltvPct,
      raroc: result.raroc,
      hurdleRate: deal.targetROE,
      businessUnit: deal.businessUnit,
      managerRole: deal.submittedByRole,
    };
    try {
      const response = await apiPost<DelegationCheckResponse>('/pricing/delegation-check', { input });
      setEvaluatedRules(response.evaluatedRules);
      setCurrentTier(response.tier);
      setCurrentRuleLabel(response.matchedRuleLabel);
    } catch {
      // Graceful fallback: run the delegation engine locally (same code as server)
      // so the panel still shows a meaningful result when the backend is unreachable.
      const local = resolveDelegation(input);
      setEvaluatedRules(local.evaluatedRules);
      setCurrentTier(local.tier);
      setCurrentRuleLabel(local.matchedRuleLabel);
    } finally {
      setReevaluating(false);
    }
  }, [
    deal.amount,
    deal.clientType,
    deal.clientRating,
    deal.ltvPct,
    deal.targetROE,
    deal.businessUnit,
    deal.submittedByRole,
    result.raroc,
  ]);

  useEffect(() => {
    if (result.delegationTier) {
      void runDelegationCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Placeholder state when delegation data is not configured
  if (!result.delegationTier && !currentTier) {
    return (
      <section
        aria-labelledby="delegation-audit-heading"
        className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-4"
      >
        <header className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--nfq-bg-elevated)]">
            <Shield className="h-5 w-5 text-[var(--nfq-text-muted)]" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="delegation-audit-heading"
              className="text-sm font-semibold text-[var(--nfq-text-primary)]"
            >
              Delegación de precio
            </h3>
            <p className="mt-0.5 text-xs text-[var(--nfq-text-muted)]">
              Auditoría multi-dimensional de la aprobación
            </p>
          </div>
        </header>
        <div className="flex items-start gap-3 rounded-[10px] bg-[var(--nfq-bg-elevated)] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nfq-text-muted)]" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-[var(--nfq-text-muted)]">
            Configura clientRating, LTV y rating para activar la delegación multi-dimensional
          </p>
        </div>
      </section>
    );
  }

  const tier = currentTier ?? 'EXECUTIVE_COMMITTEE';
  const tierConfig = TIER_COLORS[tier] ?? TIER_COLORS.EXECUTIVE_COMMITTEE;

  return (
    <section
      aria-labelledby="delegation-audit-heading"
      className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-4"
    >
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--nfq-bg-elevated)]">
            <Shield className="h-5 w-5 text-[var(--nfq-accent)]" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="delegation-audit-heading"
              className="text-sm font-semibold text-[var(--nfq-text-primary)]"
            >
              Delegación de precio
            </h3>
            <p className="mt-0.5 text-xs text-[var(--nfq-text-muted)]">
              Auditoría multi-dimensional de la aprobación
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void runDelegationCheck()}
          disabled={reevaluating}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--nfq-bg-elevated)] px-3 py-1.5 text-[11px] font-semibold tracking-normal text-[var(--nfq-text-primary)] transition-colors hover:bg-[var(--nfq-bg-surface-hover,_var(--nfq-bg-elevated))] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Reevaluar delegación"
        >
          <RefreshCw
            className={`h-3 w-3 ${reevaluating ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Reevaluar
        </button>
      </header>

      {/* Matched tier + rule */}
      <div className="mb-5 rounded-[10px] bg-[var(--nfq-bg-elevated)] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-normal ${tierConfig.bg} ${tierConfig.text}`}
          >
            <Shield className="h-3 w-3" aria-hidden="true" />
            {tierConfig.label}
          </span>
          {result.delegationRuleId || currentRuleLabel ? (
            <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--nfq-text-muted)]">
              {result.delegationRuleId ?? '—'}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[var(--nfq-text-primary)]">
          {currentRuleLabel ?? result.delegationRuleLabel ?? 'Fallback — ninguna regla aplica'}
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-[8px] bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      ) : null}

      {/* Audit trail */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mb-3 flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={expanded}
          aria-controls="delegation-audit-trail"
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--nfq-text-muted)]">
            Traza de evaluación
            {evaluatedRules ? ` · ${evaluatedRules.length}` : ''}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--nfq-text-muted)]" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--nfq-text-muted)]" aria-hidden="true" />
          )}
        </button>

        {expanded ? (
          <div id="delegation-audit-trail" className="space-y-2">
            {evaluatedRules === null && !reevaluating ? (
              <p className="text-xs text-[var(--nfq-text-muted)]">
                Pulsa "Reevaluar" para obtener la traza completa.
              </p>
            ) : null}
            {reevaluating && evaluatedRules === null ? (
              <p className="text-xs text-[var(--nfq-text-muted)]">Evaluando reglas…</p>
            ) : null}
            {evaluatedRules?.map((rule) => (
              <div
                key={rule.ruleId}
                className="rounded-[8px] bg-[var(--nfq-bg-elevated)] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {rule.matched ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                        <X className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="truncate font-mono text-[11px] uppercase tracking-wide text-[var(--nfq-text-primary)]">
                      {rule.ruleId}
                    </span>
                  </div>
                  {!rule.matched && rule.failedConstraints.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1 pl-6">
                      {rule.failedConstraints.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 uppercase tracking-wide"
                        >
                          {formatConstraintLabel(c)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default DelegationAuditPanel;
