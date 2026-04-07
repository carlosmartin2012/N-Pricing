import express from 'express';
import cors from 'cors';
import { runMigrations } from './migrate';
import dealsRouter from './routes/deals';
import auditRouter from './routes/audit';
import configRouter from './routes/config';
import marketDataRouter from './routes/marketData';
import entitiesRouter from './routes/entities';
import reportSchedulesRouter from './routes/reportSchedules';
import authRouter from './routes/auth';

const app = express();
const PORT = 3001;

app.use(cors({ origin: true }));
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

async function main() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] API running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

main();
