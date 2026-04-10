import React, { useState, useCallback } from 'react';
import { Target, Loader2, Check, AlertTriangle } from 'lucide-react';
import type { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import { apiPost } from '../../utils/apiFetch';

interface InverseOptimizationResult {
  converged: boolean;
  iterations: number;
  optimalMargin: number;
  achievedRaroc: number;
  finalResult: FTPResult;
  infeasible: boolean;
}

interface InverseOptimizerRequest {
  deal: Transaction;
  targetRaroc: number;
  approvalMatrix: ApprovalMatrixConfig;
}

interface InverseOptimizerPanelProps {
  deal: Transaction;
  currentRaroc: number;
  targetRoe: number;
  onApplyMargin?: (newMargin: number) => void;
}

const DEFAULT_APPROVAL_MATRIX: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

const formatPct = (value: number): string =>
  `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;

export const InverseOptimizerPanel: React.FC<InverseOptimizerPanelProps> = ({
  deal,
  currentRaroc,
  targetRoe,
  onApplyMargin,
}) => {
  const initialTarget = Number.isFinite(targetRoe) && targetRoe > 0 ? targetRoe : 15;
  const [targetRaroc, setTargetRaroc] = useState<number>(initialTarget);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<InverseOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: InverseOptimizerRequest = {
        deal,
        targetRaroc,
        approvalMatrix: DEFAULT_APPROVAL_MATRIX,
      };
      const response = await apiPost<InverseOptimizationResult>(
        '/pricing/inverse-optimize',
        payload,
      );
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de cálculo');
    } finally {
      setIsLoading(false);
    }
  }, [deal, targetRaroc]);

  const handleApply = useCallback(() => {
    if (result && !result.infeasible && onApplyMargin) {
      onApplyMargin(result.optimalMargin);
    }
  }, [result, onApplyMargin]);

  const handleTargetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(event.target.value);
      setTargetRaroc(Number.isFinite(parsed) ? parsed : 0);
    },
    [],
  );

  return (
    <div
      data-testid="inverse-optimizer-panel"
      className="rounded-[14px] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-accent)]">
          <Target size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
            Optimización inversa
          </h3>
          <p className="mt-0.5 text-xs text-[color:var(--nfq-text-muted)]">
            Calcula el margen mínimo para alcanzar un RAROC objetivo
          </p>
        </div>
      </div>

      {/* Current RAROC reference */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 py-2">
        <span className="nfq-label text-[10px] text-[color:var(--nfq-text-muted)]">
          RAROC actual
        </span>
        <span className="font-mono text-xs font-semibold text-[color:var(--nfq-text-secondary)]">
          {formatPct(currentRaroc)}
        </span>
      </div>

      {/* Target input */}
      <div className="mb-4">
        <label
          htmlFor="inverse-opt-target"
          className="nfq-label mb-1.5 block text-[10px]"
        >
          RAROC objetivo
        </label>
        <div className="relative">
          <input
            id="inverse-opt-target"
            type="number"
            step="0.25"
            min={0}
            max={100}
            value={Number.isFinite(targetRaroc) ? targetRaroc : ''}
            onChange={handleTargetChange}
            disabled={isLoading}
            aria-label="RAROC objetivo (%)"
            className="h-10 w-full rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 pr-8 text-right font-mono text-sm text-[color:var(--nfq-text-primary)] outline-none transition-colors focus:border-[color:var(--nfq-accent)] disabled:opacity-60"
            placeholder="15.00"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[color:var(--nfq-text-muted)]">
            %
          </span>
        </div>
      </div>

      {/* Calculate button */}
      <button
        type="button"
        onClick={handleCalculate}
        disabled={isLoading || targetRaroc <= 0}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#F48B4A] via-[#E04870] to-[#9B59B6] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            <span>Calculando…</span>
          </>
        ) : (
          <>
            <Target size={14} aria-hidden="true" />
            <span>Calcular margen mínimo</span>
          </>
        )}
      </button>

      {/* Error state */}
      {error && !isLoading && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[color:rgba(244,63,94,0.08)] p-3"
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 flex-shrink-0 text-[#f43f5e]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="nfq-label text-[10px] text-[#f43f5e]">Error de cálculo</p>
            <p className="mt-1 break-words text-xs text-[color:var(--nfq-text-secondary)]">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Result panel */}
      {result && !isLoading && (
        <div className="mt-4 space-y-3">
          {result.infeasible ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[color:rgba(245,158,11,0.3)] bg-[color:rgba(245,158,11,0.08)] p-3"
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 flex-shrink-0 text-[#f59e0b]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="nfq-label text-[10px] text-[#f59e0b]">
                  Objetivo inalcanzable
                </p>
                <p className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">
                  RAROC objetivo inalcanzable en el rango [0%, 10%] — considera
                  ajustar plazo, garantía o capital
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
                <p className="nfq-label text-[10px] text-[color:var(--nfq-text-muted)]">
                  Margen óptimo
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-[color:var(--nfq-text-primary)]">
                  {formatPct(result.optimalMargin)}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--nfq-border-ghost)] pt-3">
                  <span className="text-[11px] text-[color:var(--nfq-text-muted)]">
                    RAROC alcanzado
                  </span>
                  <span className="font-mono text-xs font-semibold text-[color:var(--nfq-text-secondary)]">
                    {formatPct(result.achievedRaroc)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-[color:var(--nfq-text-muted)]">
                    Iteraciones
                  </span>
                  <span className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
                    {result.iterations}
                    {result.converged ? ' · convergió' : ' · no convergió'}
                  </span>
                </div>
              </div>

              {onApplyMargin && (
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Aplicar margen</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InverseOptimizerPanel;
