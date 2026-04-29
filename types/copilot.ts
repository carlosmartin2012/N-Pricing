/**
 * Copilot — Ola 7 Bloque C.
 *
 * Types for the Cmd+K "Ask" tab — quick contextual questions answered
 * by Gemini grounded on the *current snapshot*. Distinct from
 * GenAIChat (`/ai`) which is a long free-form session.
 *
 * Persistence shares `ai_response_traces` with a discriminator
 * `kind = 'copilot'` per §7 of the plan.
 */

export interface CopilotContextSummary {
  /** When the user is on /pricing or /deals/:id/timeline with a deal
   *  loaded, the snapshot id ties the question to a specific pricing
   *  result. May be undefined when the context is "general". */
  snapshotId?: string;
  /** Free-form one-line summary the UI shows in the chip footer
   *  ("Deal #ABC, RAROC 12.4%, margin 1.45%"). Server may use it as
   *  prompt scaffolding. */
  oneLine?: string;
  /** Stable view id (`CALCULATOR`, `BLOTTER`, …) so the prompt builder
   *  can adapt tone — e.g. blotter context = portfolio-level. */
  view?: string;
  /** Optional dealId. When present + redactPII=true, the prompt
   *  builder substitutes `<CLIENT_REDACTED>` for clientName and
   *  clientId on the snapshot before sending it to Gemini. */
  dealId?: string;
}

export interface CopilotAskRequest {
  /** Free-text question. */
  question: string;
  context: CopilotContextSummary;
  /** UI language — drives response language. Server must echo this
   *  in the system prompt so Gemini answers in 'es' or 'en'. */
  lang: 'es' | 'en';
}

export interface CopilotCitation {
  /** Short label rendered in the UI (e.g. `Anejo IX §3.1`,
   *  `CRR3 Art. 501a`). */
  label: string;
  /** Optional URL or doc id that points to the canonical source
   *  via aiGrounding refs. */
  href?: string;
}

export interface CopilotSuggestedAction {
  id: string;
  /** UI label. Shown in a button. */
  label: string;
  /** What pressing the button should do. The server proposes;
   *  the UI confirms before applying. */
  kind: 'NAVIGATE' | 'PREFILL_CALCULATOR' | 'OPEN_DOSSIER' | 'EXPLAIN_MORE';
  /** Free-form payload the kind handler interprets. */
  payload?: Record<string, unknown>;
}

export interface CopilotAskResponse {
  /** Plain-text answer in the requested language. */
  answer: string;
  /** Validated regulatory citations — the server filters out
   *  hallucinated refs against the aiGrounding catalog before
   *  returning. */
  citations: CopilotCitation[];
  /** Optional suggested next actions. Empty array is valid. */
  suggestedActions: CopilotSuggestedAction[];
  /** Server records the trace; UI uses this for "show audit" links. */
  traceId: string;
  /** Echo of the redaction policy applied — true when clientName /
   *  clientId were stripped. UI surfaces this so users know whether
   *  PII left their tenant. */
  redactedPii: boolean;
}
