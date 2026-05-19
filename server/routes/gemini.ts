import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('claude-proxy');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_TIMEOUT_MS = 30_000;

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? 'replit-managed',
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

function convertContents(
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Array<Anthropic.MessageParam> {
  return contents
    .filter((c) => c.parts?.length > 0)
    .map((c) => ({
      role: (c.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: c.parts.map((p) => p.text).join(''),
    }));
}

function extractSystem(body: Record<string, unknown>): string | undefined {
  if (typeof body.systemInstruction === 'string') return body.systemInstruction;
  const si = body.systemInstruction as
    | { parts?: Array<{ text: string }>; text?: string }
    | undefined;
  if (si?.text) return si.text;
  if (Array.isArray(si?.parts)) return si!.parts.map((p) => p.text).join('');
  return undefined;
}

router.post('/chat', async (req, res) => {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    return res
      .status(503)
      .json({ error: 'Anthropic AI integration not configured — activate it in Replit Secrets.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const contents = body.contents as Array<{ role: string; parts: Array<{ text: string }> }>;
  const isStream = body.stream === true;
  const system = extractSystem(body);

  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: 'contents array required' });
  }

  const messages = convertContents(contents);
  if (messages.length === 0) {
    return res.status(400).json({ error: 'No valid messages after conversion' });
  }

  const client = getClient();

  try {
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          event.delta.text
        ) {
          const chunk = {
            candidates: [{ content: { parts: [{ text: event.delta.text }] } }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

      try {
        const response = await client.messages.create(
          {
            model: CLAUDE_MODEL,
            max_tokens: 8192,
            ...(system ? { system } : {}),
            messages,
          },
          { signal: controller.signal },
        );

        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        res.json({
          candidates: [{ content: { parts: [{ text }] } }],
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    logger.error('Claude proxy error', undefined, err);
    res
      .status(aborted ? 504 : 500)
      .json({ error: aborted ? 'Claude proxy timeout' : 'Claude proxy error' });
  }
});

export default router;
