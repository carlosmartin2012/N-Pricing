// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';

// Mock pg.Pool / queryOne to avoid touching a real DB.
const dbMock = vi.hoisted(() => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
  withTransaction: vi.fn(),
  withTenancyTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import { createCopilotRouter, __resetCopilotRateLimits, type GeminiCaller } from '../../server/routes/copilot';

function buildApp(geminiCaller: GeminiCaller, tenancy = { entityId: 'E1', userEmail: 'demo@bank.es' }) {
  const app = express();
  app.use(express.json());
  // Inject synthetic tenancy on each request — bypasses real middleware.
  app.use((req, _res, next) => {
    (req as unknown as { tenancy: typeof tenancy }).tenancy = tenancy;
    next();
  });
  app.use('/api/copilot', createCopilotRouter(geminiCaller));
  return app;
}

async function postJson(app: express.Express, body: Record<string, unknown>) {
  // Minimal in-process invocation via supertest-style use of node's http
  return await new Promise<{ status: number; body: unknown }>((resolve) => {
    const req = {
      method: 'POST',
      url: '/api/copilot/ask',
      body,
      headers: { 'content-type': 'application/json' },
    };
    // Use express directly via supertest substitute — manual invocation
    const handler = app as unknown as (req: typeof req, res: { status: (n: number) => unknown; json: (o: unknown) => unknown; setHeader?: () => void; end?: () => void; statusCode?: number }) => void;
    let statusCode = 200;
    let payload: unknown = null;
    const res = {
      status: (n: number) => { statusCode = n; return res; },
      json: (o: unknown) => { payload = o; resolve({ status: statusCode, body: payload }); return res; },
      setHeader: () => undefined,
      end: () => resolve({ status: statusCode, body: payload }),
      statusCode: 200,
    };
    handler(req as unknown as Parameters<typeof handler>[0], res);
  });
}

describe('createCopilotRouter (POST /api/copilot/ask)', () => {
  beforeEach(() => {
    __resetCopilotRateLimits();
    dbMock.queryOne.mockReset();
  });

  it('returns 400 when question is missing or too short', async () => {
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('ok');
    const app = buildApp(gemini);
    const r = await postJson(app, { question: 'hi', lang: 'en', context: {} });
    expect(r.status).toBe(400);
    expect(gemini).not.toHaveBeenCalled();
  });

  it('passes the trimmed question to Gemini and echoes the answer', async () => {
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('Margin is below RAROC target.');
    const app = buildApp(gemini);
    const r = await postJson(app, {
      question: '  Why is RAROC low?  ',
      lang: 'en',
      context: { oneLine: 'Deal D-1' },
    });
    expect(r.status).toBe(200);
    expect(gemini).toHaveBeenCalledOnce();
    const [prompt, lang] = (gemini as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(prompt).toContain('Why is RAROC low?');
    expect(lang).toBe('en');
    expect((r.body as { answer?: string }).answer).toContain('Margin is below RAROC target.');
  });

  it('extracts validated citations from the model response', async () => {
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('Per EBA GL 2018/02 §3.4 the shock applies. CRR3 Art. 501a covers ISF.');
    const app = buildApp(gemini);
    const r = await postJson(app, { question: 'Explain shocks', lang: 'en', context: {} });
    const labels = (r.body as { citations?: Array<{ label: string }> }).citations?.map((c) => c.label) ?? [];
    expect(labels).toContain('EBA GL 2018/02 §3.4');
    expect(labels).toContain('CRR3 Art. 501a');
  });

  it('redacts client PII from the response when redaction is enabled', async () => {
    dbMock.queryOne.mockResolvedValue({
      id: 'S-1',
      deal_id: 'D-1',
      client_id: 'CL-1001',
      client_name: 'Acme Corp',
      product_type: 'LOAN_COMM',
      amount: 1_000_000,
      currency: 'EUR',
      total_ftp: 3.0,
      final_client_rate: 4.5,
      raroc: 13,
    });
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('Acme Corp (CL-1001) RAROC is on target.');
    const app = buildApp(gemini);
    const r = await postJson(app, {
      question: 'Is the deal profitable?',
      lang: 'en',
      context: { snapshotId: 'S-1' },
    });
    expect(r.status).toBe(200);
    const body = r.body as { answer: string; redactedPii: boolean };
    expect(body.redactedPii).toBe(true);
    expect(body.answer).not.toContain('Acme Corp');
    expect(body.answer).not.toContain('CL-1001');
    expect(body.answer).toContain('<CLIENT_REDACTED>');
  });

  it('returns 429 after the per-user rate limit is exceeded', async () => {
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('ok');
    const app = buildApp(gemini);
    for (let i = 0; i < 5; i += 1) {
      const ok = await postJson(app, { question: `Q${i} please`, lang: 'en', context: {} });
      expect(ok.status).toBe(200);
    }
    const blocked = await postJson(app, { question: 'one too many', lang: 'en', context: {} });
    expect(blocked.status).toBe(429);
  });

  it('returns 503 when the Gemini caller throws "API key not configured"', async () => {
    const gemini: GeminiCaller = vi.fn().mockRejectedValue(new Error('Gemini API key not configured'));
    const app = buildApp(gemini);
    const r = await postJson(app, { question: 'any question here', lang: 'en', context: {} });
    expect(r.status).toBe(503);
    expect((r.body as { code: string }).code).toBe('service_unavailable');
  });

  it('treats unknown snapshotId as no-snapshot (general context)', async () => {
    dbMock.queryOne.mockResolvedValue(null);
    const gemini: GeminiCaller = vi.fn().mockResolvedValue('General response.');
    const app = buildApp(gemini);
    const r = await postJson(app, {
      question: 'Explain LCR charge',
      lang: 'en',
      context: { snapshotId: 'S-not-found' },
    });
    expect(r.status).toBe(200);
    const [prompt] = (gemini as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(prompt).toContain('No active pricing snapshot.');
  });
});
