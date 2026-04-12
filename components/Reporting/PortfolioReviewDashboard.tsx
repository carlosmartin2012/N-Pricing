import React, { useState, useCallback, useMemo } from 'react';
import type { Transaction, FTPResult } from '../../types';
import type {
  PortfolioReviewResult,
  UnderpricingCluster,
  RepricingCandidate,
  RenegotiationCandidate,
} from '../../utils/pricing/portfolioReviewAgent';
import { buildPortfolioReviewPrompt } from '../../utils/pricing/portfolioReviewAgent';
import { apiPost } from '../../utils/apiFetch';
import {
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Loader2,
  Target,
  Users,
  DollarSign,
} from 'lucide-react';

interface PortfolioReviewDashboardProps {
  deals: Transaction[];
  results: Map<string, FTPResult>;
}

type TabKey = 'clusters' | 'repricing' | 'renegotiation';

const SEVERITY_BADGE: Record<UnderpricingCluster['severity'], string> = {
  HIGH: 'bg-[#f43f5e]/15 text-[#f43f5e] border-[#f43f5e]/40',
  MEDIUM: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40',
  LOW: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40',
};

const numberFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
});

const thousandFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(n: number): string {
  return numberFormatter.format(n);
}

function formatThousands(n: number): string {
  return thousandFormatter.format(n / 1000);
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '—%';
  return percentFormatter.format(n);
}

function formatSigned(n: number): string {
  if (!Number.isFinite(n)) return '—%';
  const sign = n > 0 ? '+' : '';
  return `${sign}${formatPercent(n)}`;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

async function askGemini(prompt: string): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    model: 'gemini-2.0-flash',
  };
  const response = await apiPost<GeminiResponse>('/gemini/chat', body);
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

const PortfolioReviewDashboard: React.FC<PortfolioReviewDashboardProps> = ({ deals, results }) => {
  const [review, setReview] = useState<PortfolioReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('clusters');

  const portfolio = useMemo(() => {
    const items: Array<{ deal: Transaction; result: FTPResult }> = [];
    for (const deal of deals) {
      if (!deal.id) continue;
      const result = results.get(deal.id);
      if (!result) continue;
      items.push({ deal, result });
    }
    return items;
  }, [deals, results]);

  const analyzePortfolio = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const response = await apiPost<PortfolioReviewResult>(
        '/pricing/portfolio-review',
        { portfolio },
      );
      setReview(response);
      setAiNarrative('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setAnalyzeError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [portfolio]);

  const generateNarrative = useCallback(async () => {
    if (!review) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const prompt = buildPortfolioReviewPrompt(review, 'es');
      const text = await askGemini(prompt);
      setAiNarrative(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setAiError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [review]);

  const underpricedPct = review
    ? (review.summary.underpricedDealCount / Math.max(review.dealsAnalyzed, 1)) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <section className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--nfq-accent)]/15 text-[var(--nfq-accent)]">
                <TrendingDown className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--nfq-text-primary)]">
                Revisión de cartera
              </h2>
            </div>
            <p className="text-sm text-[var(--nfq-text-secondary)]">
              Detección automática de underpricing, repricing candidates y oportunidades de
              renegociación
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={analyzePortfolio}
              disabled={isAnalyzing || portfolio.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[var(--nfq-accent)] px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isAnalyzing ? 'Analizando…' : 'Analizar cartera'}
            </button>
            <button
              type="button"
              onClick={generateNarrative}
              disabled={!review || isGenerating}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--nfq-border)] bg-transparent px-4 text-sm font-medium text-[var(--nfq-text-primary)] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? 'Generando…' : 'Generar resumen con IA'}
            </button>
          </div>
        </div>

        {analyzeError && (
          <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#f43f5e]/40 bg-[#f43f5e]/10 p-3 text-sm text-[#f43f5e]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-mono">{analyzeError}</span>
          </div>
        )}

        {!review && !isAnalyzing && !analyzeError && (
          <div className="mt-4 rounded-[10px] border border-dashed border-[var(--nfq-border)] p-4 text-sm text-[var(--nfq-text-secondary)]">
            Ejecuta "Analizar cartera" para detectar clusters y candidatos. Hay{' '}
            <span className="font-mono text-[var(--nfq-text-primary)]">{portfolio.length}</span>{' '}
            deals disponibles.
          </div>
        )}
      </section>

      {/* Summary KPIs */}
      {review && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Deals analizados"
            value={formatAmount(review.dealsAnalyzed)}
            hint={`as of ${review.asOfDate}`}
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Importe total"
            value={`${formatThousands(review.totalPortfolioAmount)} €k`}
            hint={`${review.summary.clustersDetected} clusters detectados`}
          />
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="RAROC medio cartera"
            value={`${formatPercent(review.averagePortfolioRaroc)}%`}
            hint={review.averagePortfolioRaroc >= 0 ? 'Positivo' : 'Negativo'}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Deals infra-preciados"
            value={`${formatAmount(review.summary.underpricedDealCount)}`}
            hint={`${formatPercent(underpricedPct)}% del total`}
            tone="warning"
          />
        </section>
      )}

      {/* Tabs + tables */}
      {review && (
        <section className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <TabButton
              label="Clusters underpricing"
              count={review.underpricingClusters.length}
              active={activeTab === 'clusters'}
              onClick={() => setActiveTab('clusters')}
            />
            <TabButton
              label="Candidatos repricing"
              count={review.repricingCandidates.length}
              active={activeTab === 'repricing'}
              onClick={() => setActiveTab('repricing')}
            />
            <TabButton
              label="Candidatos renegociación"
              count={review.renegotiationCandidates.length}
              active={activeTab === 'renegotiation'}
              onClick={() => setActiveTab('renegotiation')}
            />
          </div>

          {activeTab === 'clusters' && <ClustersTable clusters={review.underpricingClusters} />}
          {activeTab === 'repricing' && (
            <RepricingTable candidates={review.repricingCandidates} />
          )}
          {activeTab === 'renegotiation' && (
            <RenegotiationTable candidates={review.renegotiationCandidates} />
          )}
        </section>
      )}

      {/* AI narrative */}
      {(aiNarrative || aiError) && (
        <section
          className="rounded-[14px] p-[1px]"
          style={{
            background:
              'linear-gradient(135deg, var(--nfq-accent, #F48B4A), #9B59B6 45%, #06b6d4)',
          }}
        >
          <div className="rounded-[13px] bg-[var(--nfq-bg-surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--nfq-accent)]" />
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--nfq-text-secondary)]">
                Resumen ejecutivo · Gemini
              </h3>
            </div>
            {aiError ? (
              <div className="flex items-start gap-2 text-sm text-[#f43f5e]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-mono">{aiError}</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--nfq-text-primary)]">
                {aiNarrative}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

// ---------- Subcomponents ----------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning';
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, hint, tone = 'default' }) => {
  const valueClass =
    tone === 'warning' ? 'text-[#f59e0b]' : 'text-[var(--nfq-text-primary)]';
  return (
    <div className="rounded-[14px] bg-[var(--nfq-bg-surface)] p-5">
      <div className="mb-3 flex items-center gap-2 text-[var(--nfq-text-secondary)]">
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className={`font-mono text-2xl font-semibold ${valueClass}`}>{value}</div>
      {hint && (
        <div className="mt-1 font-mono text-[11px] text-[var(--nfq-text-secondary)]">{hint}</div>
      )}
    </div>
  );
};

interface TabButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, count, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-xs font-medium transition ${
      active
        ? 'bg-[var(--nfq-accent)]/15 text-[var(--nfq-accent)]'
        : 'text-[var(--nfq-text-secondary)] hover:bg-white/5'
    }`}
  >
    <span>{label}</span>
    <span className="font-mono text-[10px] opacity-80">({count})</span>
  </button>
);

const ClustersTable: React.FC<{ clusters: UnderpricingCluster[] }> = ({ clusters }) => {
  if (clusters.length === 0) {
    return <EmptyState message="Sin clusters de underpricing detectados" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--nfq-border)] text-left">
            <Th>Severidad</Th>
            <Th>Dimensiones</Th>
            <Th align="right">Deals</Th>
            <Th align="right">Importe (€k)</Th>
            <Th align="right">RAROC medio (%)</Th>
            <Th align="right">Delta vs hurdle (pp)</Th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => (
            <tr
              key={c.id}
              className="border-b border-[var(--nfq-border)]/40 last:border-b-0 hover:bg-white/5"
            >
              <Td>
                <span
                  className={`inline-flex h-6 items-center rounded-[8px] border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${SEVERITY_BADGE[c.severity]}`}
                >
                  {c.severity}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-secondary)]">
                  {c.dimensions.map((d) => d.value).join(' · ')}
                </span>
              </Td>
              <TdNum>{formatAmount(c.dealCount)}</TdNum>
              <TdNum>{formatThousands(c.totalAmount)}</TdNum>
              <TdNum>{formatPercent(c.avgRaroc)}</TdNum>
              <TdNum tone={c.avgDelta < 0 ? 'negative' : 'positive'}>
                {formatSigned(c.avgDelta)}
              </TdNum>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RepricingTable: React.FC<{ candidates: RepricingCandidate[] }> = ({ candidates }) => {
  if (candidates.length === 0) {
    return <EmptyState message="Sin candidatos de repricing" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--nfq-border)] text-left">
            <Th>Deal</Th>
            <Th>Producto</Th>
            <Th align="right">Importe (€k)</Th>
            <Th align="right">Margen actual (%)</Th>
            <Th align="right">Margen sugerido (%)</Th>
            <Th align="right">RAROC uplift (pp)</Th>
            <Th>Rationale</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.dealId}
              className="border-b border-[var(--nfq-border)]/40 last:border-b-0 hover:bg-white/5"
            >
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-primary)]">
                  {c.dealId}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-secondary)]">
                  {c.productType}
                </span>
              </Td>
              <TdNum>{formatThousands(c.amount)}</TdNum>
              <TdNum>{formatPercent(c.currentMargin)}</TdNum>
              <TdNum tone="positive">{formatPercent(c.suggestedMargin)}</TdNum>
              <TdNum tone="positive">+{formatPercent(c.expectedRarocUplift)}</TdNum>
              <Td>
                <span className="text-xs text-[var(--nfq-text-secondary)]">{c.rationale}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RenegotiationTable: React.FC<{ candidates: RenegotiationCandidate[] }> = ({
  candidates,
}) => {
  if (candidates.length === 0) {
    return <EmptyState message="Sin candidatos de renegociación" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--nfq-border)] text-left">
            <Th>Deal</Th>
            <Th>Cliente</Th>
            <Th>Producto</Th>
            <Th align="right">Importe (€k)</Th>
            <Th align="right">RAROC actual (%)</Th>
            <Th align="right">RAROC objetivo (%)</Th>
            <Th align="right">Margen headroom (bps)</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.dealId}
              className="border-b border-[var(--nfq-border)]/40 last:border-b-0 hover:bg-white/5"
            >
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-primary)]">
                  {c.dealId}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-secondary)]">
                  {c.clientId}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-xs text-[var(--nfq-text-secondary)]">
                  {c.productType}
                </span>
              </Td>
              <TdNum>{formatThousands(c.amount)}</TdNum>
              <TdNum tone="negative">{formatPercent(c.currentRaroc)}</TdNum>
              <TdNum>{formatPercent(c.targetRaroc)}</TdNum>
              <TdNum tone="positive">+{formatAmount(c.marginHeadroomBps)}</TdNum>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[10px] border border-dashed border-[var(--nfq-border)] p-6 text-center text-sm text-[var(--nfq-text-secondary)]">
    {message}
  </div>
);

interface ThProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
}

const Th: React.FC<ThProps> = ({ children, align = 'left' }) => (
  <th
    className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--nfq-text-secondary)] ${
      align === 'right' ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </th>
);

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="px-3 py-2 align-top">{children}</td>
);

interface TdNumProps {
  children: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative';
}

const TdNum: React.FC<TdNumProps> = ({ children, tone = 'default' }) => {
  const colorClass =
    tone === 'positive'
      ? 'text-[#10b981]'
      : tone === 'negative'
        ? 'text-[#f43f5e]'
        : 'text-[var(--nfq-text-primary)]';
  return (
    <td className={`px-3 py-2 text-right align-top font-mono text-xs ${colorClass}`}>
      {children}
    </td>
  );
};

export default PortfolioReviewDashboard;
