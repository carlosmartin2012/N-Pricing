import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { buildCopilotPrompt, scrubClientPii, type PricingSnapshotForPrompt } from '../../utils/copilot/promptBuilder';
import { extractValidatedCitations } from '../../utils/copilot/citationValidator';
import { suggestCopilotActions } from '../../utils/copilot/suggestActions';
import type {
  CopilotAskRequest,
  CopilotAskResponse,
} from '../../types/copilot';

/**
 * POST /api/copilot/ask — Ola 7 Bloque C.2.
 *
 * Cmd+K Ask flow. Tenancy-scoped, builds prompt via the pure
 * promptBuilder (with PII redaction by default), calls Claude via
 * Replit AI Integrations, and returns a structured response with
 * validated citations.
 */

export interface GeminiCaller {
  (prompt: string, lang: 'es' | 'en'): Promise<string>;
}

interface SnapshotRow {
  id: string;
  deal_id: string;
  client_id: string | null;
  client_name: string | null;
  product_type: string | null;
  amount: number | null;
  currency: string | null;
  total_ftp: number | null;
  final_client_rate: number | null;
  raroc: number | null;
}

const COPILOT_RATE_LIMIT_PER_USER = 5;
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(userKey: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(userKey);
  if (!bucket || now - bucket.windowStart >= 60_000) {
    rateLimitBuckets.set(userKey, { count: 1, windowStart: now });
    return false;
  }
  if (bucket.count >= COPILOT_RATE_LIMIT_PER_USER) return true;
  bucket.count += 1;
  return false;
}

function shouldRedact(): boolean {
  return process.env.COPILOT_REDACT_CLIENT_PII !== 'false';
}

function defaultClaudeCaller(): GeminiCaller {
  return async (prompt, lang) => {
    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
      throw new Error('Anthropic AI integration not configured');
    }
    const client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? 'replit-managed',
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return (
      text ||
      (lang === 'es'
        ? 'No se pudo obtener respuesta del modelo.'
        : 'Could not retrieve a response from the model.')
    );
  };
}

export function createCopilotRouter(geminiCaller?: GeminiCaller): Router {
  const router = Router();
  const callClaude = geminiCaller ?? defaultClaudeCaller();

  router.post('/ask', async (req, res) => {
    try {
      if (!req.tenancy) {
        res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
        return;
      }
      const userKey = `${req.tenancy.entityId}:${req.tenancy.userEmail ?? 'anon'}`;
      if (isRateLimited(userKey)) {
        res.status(429).json({ code: 'rate_limited', message: 'Max 5 questions per minute. Please slow down.' });
        return;
      }

      const body = req.body as Partial<CopilotAskRequest> | undefined;
      const question = typeof body?.question === 'string' ? body.question.trim() : '';
      if (!question || question.length < 3) {
        res.status(400).json({ code: 'invalid_payload', message: 'question (min 3 chars) required' });
        return;
      }
      const lang: 'es' | 'en' = body?.lang === 'es' ? 'es' : 'en';
      const context = body?.context ?? {};
      const request: CopilotAskRequest = { question, context, lang };

      let snapshot: PricingSnapshotForPrompt | undefined;
      if (typeof context.snapshotId === 'string' && context.snapshotId) {
        const row = await queryOne<SnapshotRow>(
          `SELECT id, deal_id, client_id, client_name, product_type, amount,
                  currency, total_ftp, final_client_rate, raroc
           FROM pricing_snapshots
           WHERE id = $1 AND entity_id = $2 LIMIT 1`,
          [context.snapshotId, req.tenancy.entityId],
        );
        if (row) {
          const margin =
            row.final_client_rate !== null && row.total_ftp !== null
              ? row.final_client_rate - row.total_ftp
              : null;
          snapshot = {
            id: row.id,
            dealId: row.deal_id,
            clientId: row.client_id,
            clientName: row.client_name,
            productType: row.product_type,
            amount: row.amount,
            currency: row.currency,
            totalFtpPct: row.total_ftp,
            finalClientRatePct: row.final_client_rate,
            marginPct: margin,
            rarocPct: row.raroc,
          };
        }
      }

      const { prompt, redactedPii } = buildCopilotPrompt({
        request,
        snapshot,
        redactPii: shouldRedact(),
      });

      const rawAnswer = await callClaude(prompt, lang);
      const answer = redactedPii ? scrubClientPii(rawAnswer, snapshot) : rawAnswer;
      const citations = extractValidatedCitations(answer);

      const response: CopilotAskResponse = {
        answer,
        citations,
        suggestedActions: suggestCopilotActions({ snapshot, question }),
        traceId: `copilot:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        redactedPii,
      };
      res.json(response);
    } catch (err) {
      const code = (err as Error)?.message?.includes('not configured')
        ? 'service_unavailable'
        : 'internal_error';
      res.status(code === 'service_unavailable' ? 503 : 500).json({
        code,
        error: safeError(err),
      });
    }
  });

  return router;
}

export default createCopilotRouter();

export function __resetCopilotRateLimits(): void {
  rateLimitBuckets.clear();
}
