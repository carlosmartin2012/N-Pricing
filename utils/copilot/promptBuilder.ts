import type { CopilotAskRequest } from '../../types/copilot';

/**
 * Pure prompt builder for the Cmd+K Ask flow (Ola 7 Bloque C).
 *
 * Given the request + a snapshot of the deal pricing context, returns
 * the prompt string the server sends to Gemini. Pure — no I/O, no
 * randomness. Tested independently in __tests__/promptBuilder.test.ts.
 *
 * Default behaviour: failing closed on PII per §7 of the plan. The
 * caller can opt out per tenant via `COPILOT_REDACT_CLIENT_PII=false`,
 * surfaced as `redactPii=false` in the input.
 */

export interface PricingSnapshotForPrompt {
  id: string;
  dealId: string;
  clientId: string | null;
  clientName: string | null;
  productType: string | null;
  amount: number | null;
  currency: string | null;
  totalFtpPct: number | null;
  finalClientRatePct: number | null;
  marginPct: number | null;
  rarocPct: number | null;
  /** Top-N components rendered as { name, valuePct }. */
  components?: Array<{ name: string; valuePct: number }>;
}

export interface BuildPromptOptions {
  request: CopilotAskRequest;
  snapshot?: PricingSnapshotForPrompt;
  /** Redaction policy — default true. */
  redactPii?: boolean;
  /** Bloque markdown de contexto de atribuciones (Ola 10 Bloque A).
   *  Construido típicamente con `buildAttributionsContextBlock` del
   *  módulo `utils/attributions/aiContext`. Se inserta como sección
   *  `## Attributions context` cuando es no vacío; ausente si no aplica.
   *  Failing closed con el copilot stock cuando se omite. */
  attributionsContext?: string;
}

export interface BuildPromptResult {
  prompt: string;
  /** True when the builder substituted clientName / clientId for
   *  `<CLIENT_REDACTED>`. The handler echoes this to the response so
   *  the UI can surface "PII redacted before send". */
  redactedPii: boolean;
}

const REDACTION_PLACEHOLDER = '<CLIENT_REDACTED>';

const SYSTEM_PROMPT_EN = [
  'You are N-Pricing Copilot, an assistant for bank pricing decisions.',
  'Answer concisely (≤ 4 sentences) and only on bank pricing topics.',
  'Cite regulatory sources by exact reference (e.g. "EBA GL 2018/02 §X", "CRR3 Art. 501a", "Anejo IX §3.1") when relevant.',
  'Never invent numbers. If the snapshot lacks a number, say so explicitly.',
  'If asked about non-pricing topics, decline politely.',
].join('\n');

const SYSTEM_PROMPT_ES = [
  'Eres N-Pricing Copilot, un asistente para decisiones de pricing bancario.',
  'Responde de forma concisa (≤ 4 frases) y solo sobre temas de pricing bancario.',
  'Cita fuentes regulatorias con referencia exacta (p.ej. "EBA GL 2018/02 §X", "CRR3 Art. 501a", "Anejo IX §3.1") cuando proceda.',
  'No inventes números. Si el snapshot no contiene un dato, indícalo explícitamente.',
  'Si se te pregunta sobre temas no relacionados con pricing, declina amablemente.',
].join('\n');

function fmtNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(2);
}

function redact(value: string | null, shouldRedact: boolean): string {
  if (value === null || value === '') return 'n/a';
  return shouldRedact ? REDACTION_PLACEHOLDER : value;
}

function snapshotBlock(
  snapshot: PricingSnapshotForPrompt | undefined,
  shouldRedact: boolean,
): string {
  if (!snapshot) return 'No active pricing snapshot.';
  const lines: string[] = [
    `- Deal id: ${snapshot.dealId}`,
    `- Client id: ${redact(snapshot.clientId, shouldRedact)}`,
    `- Client name: ${redact(snapshot.clientName, shouldRedact)}`,
    `- Product type: ${snapshot.productType ?? 'n/a'}`,
    `- Amount: ${fmtNumber(snapshot.amount)} ${snapshot.currency ?? ''}`.trim(),
    `- FTP: ${fmtNumber(snapshot.totalFtpPct)}%`,
    `- Final client rate: ${fmtNumber(snapshot.finalClientRatePct)}%`,
    `- Margin: ${fmtNumber(snapshot.marginPct)}%`,
    `- RAROC: ${fmtNumber(snapshot.rarocPct)}%`,
  ];
  if (snapshot.components && snapshot.components.length > 0) {
    lines.push('- Top components:');
    for (const c of snapshot.components) {
      lines.push(`  · ${c.name}: ${fmtNumber(c.valuePct)}%`);
    }
  }
  return lines.join('\n');
}

export function buildCopilotPrompt(options: BuildPromptOptions): BuildPromptResult {
  const { request, snapshot } = options;
  const shouldRedact = options.redactPii !== false;
  const system = request.lang === 'es' ? SYSTEM_PROMPT_ES : SYSTEM_PROMPT_EN;
  const contextLine = request.context.oneLine?.trim()
    ? request.context.oneLine.trim()
    : 'general';

  const willRedact = shouldRedact && Boolean(
    snapshot && (snapshot.clientId || snapshot.clientName),
  );

  const sections: string[] = [
    system,
    '',
    `# Context (${contextLine})`,
    '',
    '## Active snapshot',
    snapshotBlock(snapshot, shouldRedact),
  ];

  const attributionsContext = options.attributionsContext?.trim();
  if (attributionsContext) {
    sections.push('', '## Attributions context', attributionsContext);
  }

  sections.push('', '## User question', request.question.trim());

  return { prompt: sections.join('\n'), redactedPii: willRedact };
}

/**
 * Helper for the response post-processor. Removes any leakage of
 * the user's clientName/clientId in case Gemini echoes a value the
 * caller passed (defensive — should not happen because we redact
 * upstream, but bank security teams want belt-and-suspenders).
 */
export function scrubClientPii(text: string, snapshot: PricingSnapshotForPrompt | undefined): string {
  if (!snapshot) return text;
  let out = text;
  if (snapshot.clientName) out = out.split(snapshot.clientName).join(REDACTION_PLACEHOLDER);
  if (snapshot.clientId)   out = out.split(snapshot.clientId).join(REDACTION_PLACEHOLDER);
  return out;
}

export const __copilotPromptInternals = { REDACTION_PLACEHOLDER };
