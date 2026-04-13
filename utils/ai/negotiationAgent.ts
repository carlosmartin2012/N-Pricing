/**
 * Negotiation Argument Generator — produces grounded arguments the originator
 * can use to defend the proposed rate or justify concessions.
 *
 * Post-MVP (Bloque J). Scaffolded now so the API contract is stable when the
 * Negotiation Cockpit view is built later.
 *
 * See: docs/pivot/ai-assistant-refocus.md §4
 */

import { invokeAI } from './client';

const SYSTEM_PROMPT = `You are a Negotiation Argument Assistant for a bank
originator negotiating a loan deal. You generate 3-5 concrete, factual
arguments the originator can use to justify the bank's proposed rate or to
negotiate concessions.

YOUR JOB:
Generate arguments grounded in the DEAL CONTEXT. Each argument has:
- type: "TECHNICAL" | "COMMERCIAL" | "RELATIONSHIP" | "COMPETITIVE"
- claim: 1-sentence claim
- backup: quantitative backup cited from context
- concession: {rate_bp, budget_impact_bp} (optional — only when a concession
  is being proposed)

RULES:
- Never invent numbers. Always cite context values.
- If a concession exceeds remaining budget, flag it in the claim.
- If no data supports an argument, skip it — do not pad.
- Arguments must be ethically defensible (no misleading statements).
- Spanish by default.

OUTPUT FORMAT (strict JSON array, no prose, no markdown fences):
[{"type": "...", "claim": "...", "backup": "...", "concession": {"rate_bp": -15, "budget_impact_bp": -15}}]

Maximum 5 items.`;

export type NegotiationArgumentType = 'TECHNICAL' | 'COMMERCIAL' | 'RELATIONSHIP' | 'COMPETITIVE';

export interface NegotiationArgument {
  type: NegotiationArgumentType;
  claim: string;
  backup: string;
  concession?: {
    rate_bp: number;
    budget_impact_bp: number;
  };
}

export interface NegotiationContext {
  segment: string;
  proposedRate: number;
  clientCounterRate?: number;
  marketBenchmarkRate?: number;
  esgProfile?: string;
  ltvPct?: number;
  clientRating?: string;
  relationshipNpv?: number;           // € ex-post from existing deals with this client
  crossBonuses?: Array<{ name: string; bp: number }>;
  concessionBudgetBp?: number;
  language?: 'es' | 'en';
}

export interface NegotiationAgentSuccess {
  ok: true;
  args: NegotiationArgument[];
}

export interface NegotiationAgentFailure {
  ok: false;
  reason: 'AI_UNAVAILABLE' | 'PARSE_ERROR' | 'EMPTY_RESPONSE';
}

const VALID_TYPES: readonly NegotiationArgumentType[] = [
  'TECHNICAL',
  'COMMERCIAL',
  'RELATIONSHIP',
  'COMPETITIVE',
];

export const parseNegotiationArguments = (raw: string): NegotiationArgument[] | null => {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    const args: NegotiationArgument[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      if (!VALID_TYPES.includes(obj.type as NegotiationArgumentType)) continue;
      if (typeof obj.claim !== 'string' || typeof obj.backup !== 'string') continue;
      const arg: NegotiationArgument = {
        type: obj.type as NegotiationArgumentType,
        claim: obj.claim,
        backup: obj.backup,
      };
      if (obj.concession && typeof obj.concession === 'object') {
        const c = obj.concession as Record<string, unknown>;
        const rate_bp = Number(c.rate_bp);
        const budget_impact_bp = Number(c.budget_impact_bp);
        if (Number.isFinite(rate_bp) && Number.isFinite(budget_impact_bp)) {
          arg.concession = { rate_bp, budget_impact_bp };
        }
      }
      args.push(arg);
    }
    return args.length > 0 ? args.slice(0, 5) : null;
  } catch {
    return null;
  }
};

export const buildNegotiationContextBlock = (ctx: NegotiationContext): string => {
  const lines: string[] = ['DEAL CONTEXT:'];
  lines.push(`- Segment: ${ctx.segment}`);
  lines.push(`- Proposed rate: ${ctx.proposedRate.toFixed(2)}%`);
  if (ctx.clientCounterRate != null) lines.push(`- Client counter-offer: ${ctx.clientCounterRate.toFixed(2)}%`);
  if (ctx.marketBenchmarkRate != null) lines.push(`- Market benchmark: ${ctx.marketBenchmarkRate.toFixed(2)}%`);
  if (ctx.esgProfile) lines.push(`- ESG profile: ${ctx.esgProfile}`);
  if (ctx.ltvPct != null) lines.push(`- LTV: ${ctx.ltvPct}%`);
  if (ctx.clientRating) lines.push(`- Rating: ${ctx.clientRating}`);
  if (ctx.relationshipNpv != null) lines.push(`- Relationship NPV: ${ctx.relationshipNpv.toLocaleString('es-ES')} €`);
  if (ctx.crossBonuses?.length) {
    lines.push(`- Cross-bonuses available:`);
    for (const cb of ctx.crossBonuses) lines.push(`    · ${cb.name}: ${cb.bp}bp`);
  }
  if (ctx.concessionBudgetBp != null) lines.push(`- Remaining concession budget: ${ctx.concessionBudgetBp}bp`);
  lines.push('');
  lines.push(`Respond in ${ctx.language === 'en' ? 'English' : 'Spanish'} with JSON only.`);
  return lines.join('\n');
};

export async function generateNegotiationArguments(
  ctx: NegotiationContext,
): Promise<NegotiationAgentSuccess | NegotiationAgentFailure> {
  const result = await invokeAI({
    capability: 'NEGOTIATION_AGENT',
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildNegotiationContextBlock(ctx),
    temperature: 0.4,
    responseFormat: 'json',
  });

  if (result.outcome !== 'SUCCESS') {
    return { ok: false, reason: 'AI_UNAVAILABLE' };
  }

  const args = parseNegotiationArguments(result.text);
  if (!args) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }
  return { ok: true, args };
}
