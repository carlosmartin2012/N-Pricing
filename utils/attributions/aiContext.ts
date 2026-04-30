/**
 * Ola 10 Bloque A — AI Assistant grounding sobre atribuciones.
 *
 * Genera bloques de contexto enchufables al prompt del copilot
 * (utils/copilot/promptBuilder.ts) cuando la pregunta del usuario es
 * sobre la matriz de atribuciones, drift de aprobadores o decisiones
 * recientes.
 *
 * Pure: no I/O. El caller (server/routes/copilot.ts) carga datos
 * desde el reporting summary endpoint y los pasa serializados aquí.
 *
 * Política de PII: no incluye nombres de cliente — sólo dealId, levels,
 * userIds (que son emails internos del banco). El redactor del copilot
 * no toca este bloque por defecto, pero los emails internos se pueden
 * redactar opcionalmente con `redactInternalUsers`.
 */

import type {
  AttributionMatrix,
  AttributionDecision,
} from '../../types/attributions';
import type {
  AttributionReportingSummary,
  ByLevelEntry,
  DriftSignal,
} from './attributionReporter';

export interface AttributionsAiContextInput {
  matrix: AttributionMatrix;
  /** Resumen reporting consolidado (output de buildAttributionSummary). */
  summary?: AttributionReportingSummary;
  /** Decisiones recientes destacadas (e.g. últimas 5 escaladas). */
  recentEscalations?: AttributionDecision[];
  /** Si true, los user emails se sustituyen por `<USER_REDACTED_N>`. */
  redactInternalUsers?: boolean;
}

const REDACTION_TEMPLATE = (n: number) => `<USER_REDACTED_${n}>`;

function fmtBps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} bps`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function fmtPp(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(1)} pp`;
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function buildUserRedactor(): (userId: string) => string {
  const map = new Map<string, string>();
  return (userId: string) => {
    const existing = map.get(userId);
    if (existing) return existing;
    const slot = REDACTION_TEMPLATE(map.size + 1);
    map.set(userId, slot);
    return slot;
  };
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function matrixSubBlock(matrix: AttributionMatrix): string {
  const activeLevels = matrix.levels.filter((l) => l.active);
  if (activeLevels.length === 0) {
    return '- Matrix is empty (no active levels configured).';
  }
  const sorted = [...activeLevels].sort((a, b) => a.levelOrder - b.levelOrder);
  const lines: string[] = [`- Active levels (${sorted.length}):`];
  for (const lv of sorted) {
    lines.push(`  · L${lv.levelOrder} — ${lv.name} (role: ${lv.rbacRole})`);
  }
  const activeThresholds = matrix.thresholds.filter((t) => t.isActive);
  lines.push(`- Active thresholds: ${activeThresholds.length}`);
  return lines.join('\n');
}

function summarySubBlock(summary: AttributionReportingSummary): string {
  const lines: string[] = [
    `- Window: ${summary.windowDays} days  ·  Total decisions: ${summary.totalDecisions}`,
    `- Funnel: approved ${summary.funnel.approved} (${fmtPct(summary.funnel.approvedRate)})  ·  rejected ${summary.funnel.rejected}  ·  escalated ${summary.funnel.escalated}  ·  expired ${summary.funnel.expired}`,
  ];

  if (summary.byLevel.length > 0) {
    lines.push('- Volume by level (top 5 by count):');
    const top: ByLevelEntry[] = [...summary.byLevel]
      .sort((a, b) => b.stats.count - a.stats.count)
      .slice(0, 5);
    for (const entry of top) {
      const name = entry.level?.name ?? entry.levelId;
      lines.push(`  · ${name}: ${entry.stats.count} decisions  ·  vol ${fmtEur(entry.stats.totalEur)}  ·  RAROC ${fmtPp(entry.stats.meanRarocPp)}  ·  drift ${fmtBps(entry.stats.meanDeviationBps)}`);
    }
  }

  return lines.join('\n');
}

function driftSubBlock(
  drift: DriftSignal[],
  redactor: ((userId: string) => string) | null,
): string {
  if (drift.length === 0) {
    return '- No systematic drift signals detected — all approvers stay within band.';
  }
  const breached = drift.filter((s) => s.severity === 'breached');
  const warnings = drift.filter((s) => s.severity === 'warning');

  const lines: string[] = [
    `- Drift signals: ${breached.length} breached  ·  ${warnings.length} warning`,
  ];

  // Top 5 by severity then by absolute mean drift
  const top = [...drift]
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'breached' ? -1 : 1;
      return Math.abs(b.meanDeviationBps) - Math.abs(a.meanDeviationBps);
    })
    .slice(0, 5);

  if (top.length > 0) {
    lines.push('- Top 5 drift signals:');
    for (const signal of top) {
      const userId = redactor ? redactor(signal.userId) : signal.userId;
      lines.push(
        `  · ${userId}: ${signal.severity.toUpperCase()}  ·  n=${signal.count}  ·  mean drift ${fmtBps(signal.meanDeviationBps)}  ·  ${fmtPct(signal.pctAtLimit)} at limit`,
      );
    }
  }
  return lines.join('\n');
}

function recentEscalationsSubBlock(
  decisions: AttributionDecision[],
  redactor: ((userId: string) => string) | null,
): string {
  if (decisions.length === 0) return '- No recent escalations.';
  const lines: string[] = [`- Recent escalations (${decisions.length}, ordered by time desc):`];
  const ordered = [...decisions]
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
    .slice(0, 5);
  for (const d of ordered) {
    const user = d.decidedByUser ? (redactor ? redactor(d.decidedByUser) : d.decidedByUser) : 'system';
    lines.push(
      `  · ${d.dealId}  ·  ${user}  ·  Δbps ${fmtBps(d.routingMetadata.deviationBps)}  ·  RAROC ${fmtPp(d.routingMetadata.rarocPp)}  ·  vol ${fmtEur(d.routingMetadata.volumeEur)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Construye el bloque markdown que se enchufa al prompt del copilot
 * cuando el contexto es attributions. Devuelve string vacío si no hay
 * datos significativos (matriz vacía y sin summary), para que el
 * caller pueda omitir el bloque sin lógica adicional.
 */
export function buildAttributionsContextBlock(input: AttributionsAiContextInput): string {
  const redactor = input.redactInternalUsers ? buildUserRedactor() : null;
  const subBlocks: string[] = [];

  subBlocks.push('### Attribution matrix');
  subBlocks.push(matrixSubBlock(input.matrix));

  if (input.summary) {
    subBlocks.push('### Reporting summary');
    subBlocks.push(summarySubBlock(input.summary));
    subBlocks.push('### Drift signals');
    subBlocks.push(driftSubBlock(input.summary.drift, redactor));
  }

  if (input.recentEscalations && input.recentEscalations.length > 0) {
    subBlocks.push('### Recent escalations');
    subBlocks.push(recentEscalationsSubBlock(input.recentEscalations, redactor));
  }

  // Si sólo tenemos la cabecera de la matriz vacía, no aporta — devuelve ''.
  if (
    input.matrix.levels.filter((l) => l.active).length === 0 &&
    !input.summary &&
    (!input.recentEscalations || input.recentEscalations.length === 0)
  ) {
    return '';
  }

  return subBlocks.join('\n');
}

// ---------------------------------------------------------------------------
// Suggested actions
// ---------------------------------------------------------------------------

export interface AttributionsSuggestedAction {
  id: string;
  label: string;
  href: string;
  /** Razón por la que se sugiere — útil para tooltip y para tests. */
  reason: string;
}

const ROUTE_APPROVALS = '/approvals';
const ROUTE_MATRIX    = '/attributions/matrix';
const ROUTE_REPORTING = '/attributions/reporting';

function nextActionId(): string {
  return 'attr-act-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Sugiere acciones del UI relevantes según el input del usuario y el
 * contexto. Las acciones son rutas internas — el copilot las renderiza
 * como botones inline en la respuesta.
 */
export function suggestAttributionsActions(input: {
  question: string;
  matrix: AttributionMatrix;
  summary?: AttributionReportingSummary;
}): AttributionsSuggestedAction[] {
  const out: AttributionsSuggestedAction[] = [];
  const lower = input.question.toLowerCase();

  // Drift / sistemático / al límite → reporting tab drift
  if (/drift|systemat|al l[ií]mite|at limit|fuera de banda|sospech/.test(lower)) {
    out.push({
      id:     nextActionId(),
      label:  'Open drift dashboard',
      href:   `${ROUTE_REPORTING}#drift`,
      reason: 'question mentions drift / systematic',
    });
  }

  // Approve / pending / bandeja / cockpit → cockpit
  if (/approve|pending|bandeja|cockpit|aprueb|pendient/.test(lower)) {
    out.push({
      id:     nextActionId(),
      label:  'Open approval cockpit',
      href:   ROUTE_APPROVALS,
      reason: 'question mentions pending approvals / cockpit',
    });
  }

  // Matrix / threshold / nivel → matrix editor
  if (/matrix|threshold|nivel|level|hierarchy|jerarqu/.test(lower)) {
    out.push({
      id:     nextActionId(),
      label:  'Open attribution matrix',
      href:   ROUTE_MATRIX,
      reason: 'question mentions matrix / threshold / level',
    });
  }

  // Funnel / volumen / reporting general → reporting volume
  if (/volum|funnel|embudo|report|dashboard/.test(lower)) {
    out.push({
      id:     nextActionId(),
      label:  'Open reporting volume tab',
      href:   `${ROUTE_REPORTING}#volume`,
      reason: 'question mentions volume / funnel / reporting',
    });
  }

  // Default: si hay drift breached señalar reporting incluso si la pregunta no lo menciona
  if (out.length === 0 && input.summary && input.summary.drift.some((s) => s.severity === 'breached')) {
    out.push({
      id:     nextActionId(),
      label:  'Review drift signals',
      href:   `${ROUTE_REPORTING}#drift`,
      reason: 'breached drift signals exist for current window',
    });
  }

  // Cap at 3 unique hrefs to avoid spam
  const seen = new Set<string>();
  return out.filter((a) => {
    if (seen.has(a.href)) return false;
    seen.add(a.href);
    return true;
  }).slice(0, 3);
}

// Exposed for tests
export const __aiContextInternals = { fmtBps, fmtPp, fmtPct, fmtEur };
