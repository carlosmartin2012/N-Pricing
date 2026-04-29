import React, { useCallback, useState } from 'react';
import { ArrowUp, BookOpen, Info, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCopilotAsk } from '../../hooks/queries/useCopilotAsk';
import type { CopilotContextSummary, CopilotSuggestedAction } from '../../types/copilot';

/**
 * CopilotAskPanel — Ola 7 Bloque C.3.
 *
 * Tab "Ask" inside the CommandPalette. Renders a textarea, a chip
 * showing the current snapshot context (if any), and the answer +
 * citations once the mutation resolves. Defensive about errors:
 * 429 → friendly "you're going too fast" copy, 503 → "AI not
 * available right now", anything else → generic.
 */

interface Props {
  /** Provided by CommandPalette — comes from the surrounding page
   *  (active deal, active view, etc). */
  context: CopilotContextSummary;
  language: 'es' | 'en';
  /** Called when the user accepts the answer and wants to close
   *  the palette. */
  onClose: () => void;
}

const COPY = {
  en: {
    placeholder: 'Ask anything about this pricing context…',
    contextLabel: 'Context',
    contextNone: 'general',
    submit: 'Ask',
    asking: 'Thinking…',
    rateLimit: 'You are asking too fast. Wait a few seconds and retry.',
    serviceUnavailable: 'Copilot is not available right now (no API key configured).',
    genericError: 'Something went wrong. Please retry.',
    citations: 'Sources',
    redactedNote: 'Client name and id were redacted before sending to the model.',
    close: 'Close',
    suggestedActions: 'Suggested next steps',
  },
  es: {
    placeholder: 'Pregunta lo que quieras sobre este pricing…',
    contextLabel: 'Contexto',
    contextNone: 'general',
    submit: 'Preguntar',
    asking: 'Pensando…',
    rateLimit: 'Estás preguntando demasiado rápido. Espera unos segundos.',
    serviceUnavailable: 'Copilot no está disponible ahora (falta API key).',
    genericError: 'Algo salió mal. Reintenta.',
    citations: 'Fuentes',
    redactedNote: 'Nombre y id de cliente redactados antes de enviar al modelo.',
    close: 'Cerrar',
    suggestedActions: 'Próximos pasos sugeridos',
  },
} as const;

function classifyError(err: unknown): 'rate_limit' | 'service_unavailable' | 'generic' {
  const msg = (err as Error)?.message ?? '';
  if (msg.includes('429')) return 'rate_limit';
  if (msg.includes('503')) return 'service_unavailable';
  return 'generic';
}

const CopilotAskPanel: React.FC<Props> = ({ context, language, onClose }) => {
  const [question, setQuestion] = useState('');
  const ask = useCopilotAsk();
  const navigate = useNavigate();
  const t = COPY[language];

  const handleApplyAction = useCallback(
    (action: CopilotSuggestedAction) => {
      const path = typeof action.payload?.path === 'string' ? action.payload.path : null;
      if (action.kind === 'NAVIGATE' || action.kind === 'OPEN_DOSSIER') {
        if (path) {
          navigate(path);
          onClose();
        }
      }
      // PREFILL_CALCULATOR / EXPLAIN_MORE not yet implemented — left
      // as no-op so future kinds can be added without touching the
      // suggestActions catalog.
    },
    [navigate, onClose],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = question.trim();
    if (trimmed.length < 3 || ask.isPending) return;
    ask.mutate({ question: trimmed, context, lang: language });
  }, [question, context, language, ask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter submits; plain Enter inserts newline.
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const errorKind = ask.isError ? classifyError(ask.error) : null;
  const errorCopy =
    errorKind === 'rate_limit' ? t.rateLimit
    : errorKind === 'service_unavailable' ? t.serviceUnavailable
    : errorKind ? t.genericError
    : null;

  const contextLabel = context.oneLine?.trim() ? context.oneLine.trim() : t.contextNone;

  return (
    <div className="flex flex-col gap-3 px-4 py-3" data-testid="copilot-ask-panel">
      {/* Context chip */}
      <div className="flex items-center gap-2 text-[10px] text-[var(--nfq-text-muted)]">
        <Info size={12} />
        <span className="font-mono uppercase tracking-[0.12em]">{t.contextLabel}:</span>
        <span className="truncate text-[var(--nfq-text-secondary)]">{contextLabel}</span>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.placeholder}
          rows={3}
          aria-label="Copilot question"
          className="w-full resize-none rounded-md border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 py-2 pr-10 text-sm text-[var(--nfq-text-primary)] outline-none placeholder:text-[var(--nfq-text-faint)] focus:border-cyan-500/40"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={ask.isPending || question.trim().length < 3}
          aria-label={t.submit}
          data-testid="copilot-submit"
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ask.isPending ? <Sparkles size={14} className="animate-pulse" /> : <ArrowUp size={14} />}
        </button>
      </div>

      {/* Status / Result */}
      {ask.isPending && (
        <p className="text-xs text-[var(--nfq-text-muted)]" role="status">
          {t.asking}
        </p>
      )}

      {errorCopy && (
        <p className="rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300" role="alert">
          {errorCopy}
        </p>
      )}

      {ask.isSuccess && ask.data && (
        <article
          className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-3 text-xs text-[var(--nfq-text-primary)]"
          data-testid="copilot-answer"
        >
          <p className="whitespace-pre-wrap leading-relaxed">{ask.data.answer}</p>
          {ask.data.citations.length > 0 && (
            <div className="mt-3 border-t border-cyan-500/10 pt-2">
              <div className="nfq-label flex items-center gap-1 text-[10px] text-cyan-300">
                <BookOpen size={10} />
                {t.citations}
              </div>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {ask.data.citations.map((c) => (
                  <li
                    key={c.label}
                    className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200"
                  >
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ask.data.suggestedActions.length > 0 && (
            <div className="mt-3 border-t border-cyan-500/10 pt-2" data-testid="copilot-suggested-actions">
              <div className="nfq-label flex items-center gap-1 text-[10px] text-cyan-300">
                <ArrowRight size={10} />
                {t.suggestedActions}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {ask.data.suggestedActions.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      onClick={() => handleApplyAction(action)}
                      data-testid={`copilot-action-${action.id}`}
                      className="flex w-full items-center justify-between gap-2 rounded border border-slate-700/60 bg-slate-800/40 px-2 py-1.5 text-left text-[11px] text-slate-200 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                    >
                      <span>{action.label}</span>
                      <ArrowRight size={11} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ask.data.redactedPii && (
            <p className="mt-3 flex items-center gap-1 text-[10px] text-[var(--nfq-text-muted)]">
              <ShieldCheck size={10} />
              {t.redactedNote}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--nfq-text-muted)] hover:text-[var(--nfq-text-primary)]"
          >
            {t.close}
          </button>
        </article>
      )}
    </div>
  );
};

export default CopilotAskPanel;
