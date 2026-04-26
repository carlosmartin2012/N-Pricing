import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Transaction, FTPResult } from '../../types';
import { buildWaterfallExplanation } from '../../utils/waterfallExplainer';
import { apiPost } from '../../utils/apiFetch';
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react';

interface WaterfallExplainerCardProps {
  deal: Transaction;
  result: FTPResult;
  language?: 'es' | 'en';
}

interface ParsedRow {
  label: string;
  value: string;
  bold: boolean;
}

interface ExplainWaterfallResponse {
  systemPrompt: string;
  markdown: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function parseMarkdownTable(markdown: string): ParsedRow[] {
  const lines = markdown.split('\n');
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length !== 2) continue;
    if (cells[0] === 'Componente' && cells[1] === 'Valor') continue;

    const bold = cells[0].startsWith('**') && cells[0].endsWith('**');
    const label = cells[0].replace(/\*\*/g, '');
    const value = cells[1].replace(/\*\*/g, '');
    rows.push({ label, value, bold });
  }

  return rows;
}

function isEmptyResult(result: FTPResult): boolean {
  if (!result) return true;
  // Treat result as empty when all the key rate components are zero/undefined
  const total = Number(result.totalFTP ?? 0);
  const final = Number(result.finalClientRate ?? 0);
  const base = Number(result.baseRate ?? 0);
  return total === 0 && final === 0 && base === 0;
}

async function askCopilot(systemPrompt: string, userMessage: string): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    model: 'gemini-2.0-flash',
  };
  const response = await apiPost<GeminiResponse>('/gemini/chat', body);
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export const WaterfallExplainerCard: React.FC<WaterfallExplainerCardProps> = ({
  deal,
  result,
  language = 'es',
}) => {
  const markdown = useMemo(
    () => buildWaterfallExplanation(deal, result, { language }),
    [deal, result, language],
  );

  const rows = useMemo(() => parseMarkdownTable(markdown), [markdown]);

  const [copied, setCopied] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, []);

  const empty = isEmptyResult(result);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1800);
    } catch {
      // silently ignore clipboard failures
    }
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setAnswer('');
    try {
      const explain = await apiPost<ExplainWaterfallResponse>('/pricing/explain-waterfall', {
        dealId: deal.id,
        deal,
        result,
        language,
      });
      const userMessage = `${explain.markdown}\n\nPregunta del gestor:\n${q}`;
      const reply = await askCopilot(explain.systemPrompt, userMessage);
      setAnswer(reply || 'Sin respuesta del copiloto.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al contactar al copiloto.');
    } finally {
      setLoading(false);
    }
  };

  if (empty) {
    return (
      <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-4">
        <div className="mb-2 text-base font-semibold text-[color:var(--nfq-text-primary)]">
          Explicación del waterfall
        </div>
        <div className="text-xs text-[color:var(--nfq-text-secondary)]">
          Desglose componente a componente del cálculo FTP
        </div>
        <div className="mt-6 rounded-[10px] bg-[var(--nfq-bg-elevated)]/50 p-4 text-center text-sm text-[color:var(--nfq-text-muted)]">
          Calcula un precio para ver el waterfall
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-4">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-[color:var(--nfq-text-primary)]">
            Explicación del waterfall
          </div>
          <div className="mt-1 text-xs text-[color:var(--nfq-text-secondary)]">
            Desglose componente a componente del cálculo FTP
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--nfq-bg-elevated)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-secondary)] transition hover:text-[color:var(--nfq-text-primary)]"
          aria-label="Copiar markdown"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[10px]">
        {rows.map((row, idx) => {
          const base =
            idx % 2 === 0 ? 'bg-[var(--nfq-bg-elevated)]/50' : 'bg-transparent';
          const boldCls = row.bold
            ? 'text-[color:var(--nfq-accent)] font-semibold'
            : 'text-[color:var(--nfq-text-primary)]';
          return (
            <div
              key={`${row.label}-${idx}`}
              className={`flex items-center justify-between gap-4 px-4 py-2.5 ${base}`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-[0.12em] ${row.bold ? 'text-[color:var(--nfq-accent)]' : 'text-[color:var(--nfq-text-secondary)]'}`}
              >
                {row.label}
              </div>
              <div
                className={`font-mono text-sm tabular-nums ${boldCls}`}
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              >
                {row.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Copilot section */}
      <div className="mt-6 border-t border-white/5 pt-5">
        {!copilotOpen ? (
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-[#F48B4A] to-[#E04870] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Preguntar al copiloto
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--nfq-text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--nfq-accent)]" />
              Copiloto de pricing
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej. ¿Qué componente pesa más en el total FTP? ¿Puedo mejorar el RAROC ajustando el plazo?"
              rows={3}
              disabled={loading}
              className="w-full rounded-[10px] bg-[var(--nfq-bg-elevated)]/80 p-3 text-sm text-[color:var(--nfq-text-primary)] placeholder:text-[color:var(--nfq-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--nfq-accent)]"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAsk}
                disabled={loading || question.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-[#F48B4A] to-[#E04870] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Enviar pregunta
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCopilotOpen(false);
                  setQuestion('');
                  setAnswer('');
                  setError(null);
                }}
                disabled={loading}
                className="rounded-[10px] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] transition hover:text-[color:var(--nfq-text-primary)] disabled:opacity-40"
              >
                Cerrar
              </button>
            </div>

            {error && (
              <div className="rounded-[10px] bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            {answer && (
              <div className="rounded-[10px] bg-[var(--nfq-bg-elevated)]/60 p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                  Respuesta
                </div>
                <div
                  className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--nfq-text-primary)]"
                  style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
                >
                  {answer}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterfallExplainerCard;
