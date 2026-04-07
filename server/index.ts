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

import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const IS_PROD = !!process.env.PORT && fs.existsSync(path.join(distDir, 'index.html'));
const PORT = parseInt(process.env.PORT ?? (IS_PROD ? '5000' : '3001'), 10);

const app = express();

if (!IS_PROD) {
  app.use(cors({ origin: true }));
}

app.use(express.json({ limit: '10mb' }));

app.use('/api/deals', dealsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/config', configRouter);
app.use('/api/market-data', marketDataRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/report-schedules', reportSchedulesRouter);
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

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
