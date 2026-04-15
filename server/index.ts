import express, { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate';
import dealsRouter from './routes/deals';
import auditRouter from './routes/audit';
import configRouter from './routes/config';
import marketDataRouter from './routes/marketData';
import entitiesRouter from './routes/entities';
import reportSchedulesRouter from './routes/reportSchedules';
import observabilityRouter from './routes/observability';
import authRouter from './routes/auth';
import geminiRouter from './routes/gemini';
import pricingRouter from './routes/pricing';
import snapshotsRouter from './routes/snapshots';
import { authMiddleware } from './middleware/auth';
import { requestIdMiddleware } from './middleware/requestId';
import { tenancyMiddleware } from './middleware/tenancy';
import { safeError } from './middleware/errorHandler';

import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const IS_PROD = !!process.env.PORT && fs.existsSync(path.join(distDir, 'index.html'));
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3001'];
app.use(cors({
  origin: IS_PROD ? false : ALLOWED_ORIGINS,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// API documentation — serve OpenAPI spec + Swagger UI
app.get('/api/docs/spec', (_req, res) => {
  const specPath = path.resolve(__dirname, '..', 'docs', 'api-spec.yaml');
  if (fs.existsSync(specPath)) {
    res.setHeader('Content-Type', 'text/yaml');
    res.sendFile(specPath);
  } else {
    res.status(404).json({ error: 'API spec not found' });
  }
});
app.get('/api/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head><title>N-Pricing API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/docs/spec', dom_id: '#swagger-ui' });</script>
</body></html>`);
});

// Tenancy enforcement is gated by the TENANCY_ENFORCE env var during rollout.
// Valid values: 'off' (default — skip), 'on' (apply & block). 'warn' mode is
// planned for the next sprint. Routes that are conceptually entity-scoped
// (deals, pricing, market-data, etc.) opt into this middleware; global routes
// (/api/entities — needed to discover entities before picking one) stay out.
const tenancyOn = process.env.TENANCY_ENFORCE === 'on';
const entityScoped = tenancyOn ? [authMiddleware, tenancyMiddleware()] : [authMiddleware];

// Protected routes (auth required)
app.use('/api/deals', ...entityScoped, dealsRouter);
app.use('/api/audit', ...entityScoped, auditRouter);
app.use('/api/config', ...entityScoped, configRouter);
app.use('/api/market-data', ...entityScoped, marketDataRouter);
app.use('/api/entities', authMiddleware, entitiesRouter);
app.use('/api/report-schedules', ...entityScoped, reportSchedulesRouter);
app.use('/api/observability', ...entityScoped, observabilityRouter);
app.use('/api/gemini', authMiddleware, geminiRouter);
app.use('/api/pricing', ...entityScoped, pricingRouter);
app.use('/api/snapshots', ...entityScoped, snapshotsRouter);

// 404 for unknown API routes — without this, the SPA fallback below would
// swallow typos as HTML responses and a failing frontend fetch would surface
// as a JSON-parse error instead of a clear 404.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (IS_PROD) {
  app.use(express.static(distDir));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Global error handler. Catches:
//   1. Malformed JSON bodies (SyntaxError from express.json) → 400
//   2. Request-too-large (PayloadTooLargeError) → 413
//   3. Anything thrown from an async route handler that wasn't caught
//      locally. Express 5 forwards async rejections here automatically.
// Without this middleware, a crash in one handler produced an unhelpful
// default 500 with no logging, making prod incidents invisible.
const errorHandler: ErrorRequestHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }
  if (err && typeof err === 'object') {
    const e = err as { type?: string; status?: number; statusCode?: number };
    if (e.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }
    if (e.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large' });
      return;
    }
    const status = e.status ?? e.statusCode;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: safeError(err) });
      return;
    }
  }
  console.error('[server] Unhandled route error', err);
  res.status(500).json({ error: safeError(err) });
};
app.use(errorHandler);

// Process-level safety nets. Before these handlers, an unhandled rejection
// anywhere in the process would either be silently swallowed or crash the
// Node process in a future runtime (Node 15+ defaults), leaving no log trail.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception', err);
});

async function main() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.info(`[server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

main();
