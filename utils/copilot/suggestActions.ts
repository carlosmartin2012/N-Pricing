import type { CopilotSuggestedAction } from '../../types/copilot';
import type { PricingSnapshotForPrompt } from './promptBuilder';

/**
 * Rule-based action suggestion (Ola 7 Bloque C.4).
 *
 * Given a snapshot + the user's question, returns 0–3 navigation
 * shortcuts the UI renders as buttons. Pure, deterministic — no AI
 * extra-call. The user always confirms before the action triggers
 * a route change, so even if a suggestion is irrelevant the worst
 * case is a wasted click.
 *
 * Suggestions never modify state — they only navigate or open
 * existing flows. PREFILL_CALCULATOR is a hint for the future
 * "apply X bps margin tweak" flow; for MVP it lives in the type
 * but no rule emits it yet.
 */

export interface SuggestActionsInput {
  snapshot?: PricingSnapshotForPrompt;
  question: string;
}

const TIMELINE_KEYWORDS = /timeline|history|escalat|dossier|audit|chronolog/i;
const RAROC_KEYWORDS    = /raroc|capital|economic profit|return on/i;
const DOSSIER_KEYWORDS  = /dossier|committee|sign|approval/i;
const STRESS_KEYWORDS   = /stress|shock|eba|scenario/i;

export function suggestCopilotActions(input: SuggestActionsInput): CopilotSuggestedAction[] {
  const { snapshot, question } = input;
  if (!snapshot?.dealId) return [];

  const out: CopilotSuggestedAction[] = [];
  const q = question || '';

  // 1. Timeline — always a strong default for a deal-anchored question.
  out.push({
    id: 'open-timeline',
    label: 'View deal timeline',
    kind: 'NAVIGATE',
    payload: { path: `/deals/${encodeURIComponent(snapshot.dealId)}/timeline` },
  });

  // 2. RAROC Terminal when the question/context hints at returns.
  if (RAROC_KEYWORDS.test(q) || (snapshot.rarocPct !== null && snapshot.rarocPct < 12)) {
    out.push({
      id: 'open-raroc',
      label: 'Open RAROC Terminal',
      kind: 'NAVIGATE',
      payload: { path: '/raroc' },
    });
  }

  // 3. Dossier flow when the question is about approvals.
  if (DOSSIER_KEYWORDS.test(q)) {
    out.push({
      id: 'open-dossiers',
      label: 'Open Dossiers',
      kind: 'OPEN_DOSSIER',
      payload: { path: '/dossiers' },
    });
  }

  // 4. Stress Pricing when the question hints at scenarios.
  if (STRESS_KEYWORDS.test(q)) {
    out.push({
      id: 'open-stress',
      label: 'Open Stress Pricing',
      kind: 'NAVIGATE',
      payload: { path: '/stress-pricing' },
    });
  }

  // 5. If the question already mentioned timeline keywords, hoist the
  //    timeline link to the top by emitting it again with a more
  //    specific label — but de-dupe to avoid 2 entries.
  if (TIMELINE_KEYWORDS.test(q) && out[0]?.id === 'open-timeline') {
    out[0] = {
      ...out[0],
      label: 'Jump to timeline (matches your question)',
    };
  }

  // Cap at 3 to keep the UI tight; the timeline always wins.
  return out.slice(0, 3);
}
