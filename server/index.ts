import express, { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate';
import dealsRouter from './routes/deals';
import dealTimelineRouter from './routes/dealTimeline';
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
import customer360Router from './routes/customer360';
import clvRouter from './routes/clv';
import reconciliationRouter from './routes/reconciliation';
import channelPricingRouter from './routes/channelPricing';
import governanceRouter from './routes/governance';
import meteringRouter from './routes/metering';
import campaignsRouter from './routes/campaigns';
import targetGridRouter from './routes/targetGrid';
import marketBenchmarksRouter from './routes/marketBenchmarks';
import copilotRouter from './routes/copilot';
import attributionsRouter from './routes/attributions';
import admissionRouter from './routes/admission';
import coreBankingRouter from './routes/coreBanking';
import budgetRouter from './routes/budget';
import notificationsRouter from './routes/notifications';
import { authMiddleware } from './middleware/auth';
import { tenancyMiddleware, liteTenancyMiddleware } from './middleware/tenancy';
import { requestIdMiddleware } from './middleware/requestId';
import { requireTenancy } from './middleware/requireTenancy';
import { authRateLimit } from './middleware/authRateLimit';
import { safeError } from './middleware/errorHandler';
import { startAlertEvaluator } from './workers/alertEvaluator';
import { startEscalationSweeper } from './workers/escalationSweeper';
import { startLtvSnapshotWorker } from './workers/ltvSnapshotWorker';
import { startAttributionDriftDetector } from './workers/attributionDriftDetector';
import { startThresholdRecalibrator } from './workers/attributionThresholdRecalibrator';
import { startCrmEventSync } from './workers/crmEventSync';
import { getWorkerHealth } from './workers/workerHealth';
import { bootstrapAdapters } from './integrations/bootstrap';
import { pool } from './db';
import { seedDemoDataset } from '../scripts/seed-demo-dataset';

import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const IS_PROD = !!process.env.PORT && fs.existsSync(path.join(distDir, 'index.html'));
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
// Strip the default `X-Powered-By: Express` banner so we don't volunteer the
// server stack to scanners. Cheap defence-in-depth.
app.disable('x-powered-by');
// Trust X-Forwarded-* when behind a reverse proxy / Vercel so req.ip,
// rate limiting, and HTTPS detection see the real client. Behind a single
// proxy hop this is the safe value; tune if more hops are involved.
app.set('trust proxy', 1);

// 3000 is the Vite dev port (see vite.config.ts — 5000 is reserved by macOS
// AirPlay). 5173 kept for ad-hoc `vite --port 5173` runs; 3001 is the
// Express server itself when opened directly.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
];
app.use(cors({
  // In production the SPA is served from the same origin as the API
  // (express.static below), so `origin: false` keeps cross-origin requests
  // out. If a separate origin needs API access, set ALLOWED_ORIGINS in env.
  origin: IS_PROD ? (process.env.ALLOWED_ORIGINS ? ALLOWED_ORIGINS : false) : ALLOWED_ORIGINS,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS in prod only — sending it during local HTTP would refuse future
  // localhost http:// loads in the same browser profile.
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  if (req.path.startsWith('/api/')) {
    // API responses: block embedding and disable caching.
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Public routes (no auth required)
// /api/auth/google is public (sign-in); /api/auth/me requires JWT.
// Per-IP rate limiter on the unauthenticated branches so credential stuffing
// against /demo and replay against /google can't run unbounded. /me sits
// behind authMiddleware and doesn't need throttling beyond JWT verification.
const authLimiter = authRateLimit({ scope: 'login', capacity: 10, rpm: 10 });
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/me') return authMiddleware(req, res, next);
  return authLimiter(req, res, next);
}, authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
// Worker-tick heartbeat snapshot. Documented in
// server/workers/workerHealth.ts but never exposed before; ops needs this
// to detect a silently dead worker (last_success_at far in the past).
app.get('/api/health/workers', (_req, res) => {
  res.json({ ts: new Date().toISOString(), workers: getWorkerHealth() });
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
//
// `requireTenancy()` is stacked unconditionally as a belt-and-suspenders guard
// (see server/middleware/requireTenancy.ts). It is a no-op when TENANCY_ENFORCE
// is off, but in strict mode it returns 500 if a request reaches a handler
// without `req.tenancy` populated — catching the regression "new router was
// added without joining the entityScoped chain". Reading the env on each
// request lets the rollout flip live without restarting the server.
const tenancyOn = process.env.TENANCY_ENFORCE === 'on';
// Always populate req.tenancy so downstream route handlers can rely on it.
// Strict mode does a DB membership check in entity_users; lite mode trusts the
// JWT role and just validates the UUID format of x-entity-id.
const entityScoped = tenancyOn
  ? [authMiddleware, tenancyMiddleware(), requireTenancy()]
  : [authMiddleware, liteTenancyMiddleware(), requireTenancy()];

// Protected routes (auth required)
app.use('/api/deals', ...entityScoped, dealsRouter);
// Deal timeline aggregator (Ola 7 Bloque A). Mounted *after* dealsRouter
// so GET /api/deals/:id keeps matching the deal lookup; the timeline
// router only handles the deeper /:id/timeline path.
app.use('/api/deals', ...entityScoped, dealTimelineRouter);
app.use('/api/audit', ...entityScoped, auditRouter);
app.use('/api/config', ...entityScoped, configRouter);
app.use('/api/market-data', ...entityScoped, marketDataRouter);
app.use('/api/entities', authMiddleware, entitiesRouter);
app.use('/api/report-schedules', ...entityScoped, reportSchedulesRouter);
app.use('/api/observability', ...entityScoped, observabilityRouter);
app.use('/api/gemini', authMiddleware, geminiRouter);
app.use('/api/pricing', ...entityScoped, pricingRouter);
app.use('/api/snapshots', ...entityScoped, snapshotsRouter);
app.use('/api/customer360', ...entityScoped, customer360Router);
app.use('/api/clv', ...entityScoped, clvRouter);
app.use('/api/reconciliation', ...entityScoped, reconciliationRouter);
app.use('/api/governance', ...entityScoped, governanceRouter);
app.use('/api/metering', ...entityScoped, meteringRouter);
app.use('/api/campaigns', ...entityScoped, campaignsRouter);
app.use('/api/target-grid', ...entityScoped, targetGridRouter);
// Market benchmarks are cross-tenant reference data (BBG/BdE/EBA surveys).
// Read is open to any authenticated user; write is admin-gated inside the router.
app.use('/api/market-benchmarks', authMiddleware, marketBenchmarksRouter);
// Copilot Cmd+K (Ola 7 Bloque C). Tenancy-scoped — questions about a
// deal must run in the tenant that owns that deal so PII redaction
// + RLS-derived snapshot resolution stay aligned.
app.use('/api/copilot', ...entityScoped, copilotRouter);

// Atribuciones jerárquicas (Ola 8 Bloque A). Tenancy-scoped — la matriz
// es per-tenant y las decisiones son append-only con hash chain a
// pricing_snapshots (validado por trigger DB).
app.use('/api/attributions', ...entityScoped, attributionsRouter);

// Admission integration (Ola 9 Bloque A) — push de decisiones de pricing
// hacia el sistema de admisión del banco (PUZZLE en BM, in-memory en dev).
// El adapter concreto se registra en bootstrapAdapters() vía
// ADAPTER_ADMISSION env var. Tenancy-scoped por defense-in-depth.
app.use('/api/admission', ...entityScoped, admissionRouter);

// Core Banking integration (Ola 9 Bloque B) — reconciliación batch HOST
// mainframe vs pricing_snapshots. Adapter registrado en bootstrap (in-memory
// por defecto, 'bm-host' opt-in via ADAPTER_CORE_BANKING).
app.use('/api/core-banking', ...entityScoped, coreBankingRouter);

// Budget reconciliation (Ola 9 Bloque C) — wrapper read-only sobre ALQUID.
// Compara supuestos del budget con precios realizados N-Pricing por
// (segment × productType × currency) en el periodo. Sin escritura a ALQUID.
app.use('/api/budget', ...entityScoped, budgetRouter);

// Push notifications (Ola 10 Bloque C) — registro de suscripciones Web
// Push para mobile-first cockpit. El sender real con web-push + VAPID
// queda como follow-up.
app.use('/api/notifications', ...entityScoped, notificationsRouter);

// Channel pricing — its own auth (API key) and rate limit. No JWT.
app.use('/api/channel', channelPricingRouter);

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
    // Opt-in demo seed (Replit + local quickstart). Gated by env so local dev
    // against a real DB does not clobber it. Runs AFTER migrations so every
    // target table exists. Invoked inline (not spawned) so any failure is
    // visible in the server log — the previous child-process approach swallowed
    // PATH/env issues and made "seed silently skipped" look identical to
    // "seed succeeded". Each per-table step in seedDemoDataset is wrapped in
    // its own try/catch, so a missing table does not abort the whole catalogue.
    if (process.env.SEED_DEMO_ON_BOOT === 'true') {
      try {
        await seedDemoDataset(pool);
      } catch (err) {
        console.error('[server] seedDemoDataset crashed (startup continues):', err);
      }
    }
    // Register integration adapters BEFORE the server starts accepting
    // requests: the health endpoint and any pricing path that reads from
    // MarketDataAdapter will otherwise see an empty registry.
    bootstrapAdapters();
    app.listen(PORT, '0.0.0.0', () => {
      console.info(`[server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
    // Alert evaluator is opt-in: set ALERT_EVAL_INTERVAL_MS to a positive
    // integer (milliseconds) to start the background tick. Disabled by default
    // to avoid background work during local dev or tests.
    startAlertEvaluator();
    // Escalation sweeper — opt-in via ESCALATION_SWEEP_INTERVAL_MS.
    // Recommended: ≥ 60000 (one minute). The /api/governance/escalations/sweep
    // endpoint remains available for external cron triggers regardless.
    startEscalationSweeper();
    // LTV snapshot worker — opt-in via LTV_SNAPSHOT_INTERVAL_MS (min 60000).
    // Refreshes client_ltv_snapshots for every (entity, client) with an
    // active position. Idempotent via unique (entity_id, client_id, as_of_date).
    startLtvSnapshotWorker();
    // CRM event sync — opt-in via CRM_SYNC_INTERVAL_MS. Pulls events from
    // the registered CRM adapter into client_events for every active client.
    startCrmEventSync();
    // Attribution drift detector — opt-in via ATTRIBUTION_DRIFT_INTERVAL_MS.
    // Detecta patrones sistemáticos de aprobación al límite por figura
    // comercial. Logs estructurados consumidos por el alert evaluator.
    startAttributionDriftDetector();
    // Attribution threshold recalibrator (Ola 10 Bloque B) — opt-in via
    // ATTRIBUTION_RECALIBRATION_INTERVAL_MS. Propone ajustes a thresholds
    // basado en histórico de decisiones; persiste como pending para
    // governance flow Admin/Risk_Manager review.
    startThresholdRecalibrator();
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

main();
