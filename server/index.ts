import express from 'express';
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
import authRouter from './routes/auth';
import geminiRouter from './routes/gemini';
import pricingRouter from './routes/pricing';
import { authMiddleware } from './middleware/auth';

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

// Public routes (no auth required)
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Protected routes (auth required)
app.use('/api/deals', authMiddleware, dealsRouter);
app.use('/api/audit', authMiddleware, auditRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/market-data', authMiddleware, marketDataRouter);
app.use('/api/entities', authMiddleware, entitiesRouter);
app.use('/api/report-schedules', authMiddleware, reportSchedulesRouter);
app.use('/api/gemini', authMiddleware, geminiRouter);
app.use('/api/pricing', authMiddleware, pricingRouter);

if (IS_PROD) {
  app.use(express.static(distDir));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

async function main() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] Running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

main();
