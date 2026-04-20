#!/usr/bin/env tsx
/**
 * Seed the 3 canonical alert rules required before flipping
 * `TENANCY_STRICT=on` in production.
 *
 * Rules seeded (per-tenant, from docs/phase-0-rollout.md):
 *   - pricing p95 breach         (warning, slack)
 *   - tenancy violation          (critical, pagerduty)
 *   - snapshot write failure     (page,     pagerduty)
 *
 * Idempotent by (entity_id, name). Re-runs only insert rules that don't
 * exist yet — never overwrites an existing rule's thresholds, channels,
 * or active state, because tenants tune them after seeding.
 *
 * Usage:
 *   tsx scripts/seed-tenancy-alerts.ts --entity-id <uuid> [--dry-run]
 *   tsx scripts/seed-tenancy-alerts.ts --all-active       [--dry-run]
 *
 * Channel routing is read from environment:
 *   SEED_SLACK_WEBHOOK_URL    — slack webhook for pricing latency rule
 *   SEED_PAGERDUTY_ROUTING_KEY — PagerDuty routing key for critical rules
 * Rules are still inserted when those are absent; channel_config just
 * starts empty and ops fill it in via the UI.
 *
 * Exit 0 on success, 1 on error. Emits a compact table of actions taken.
 */

import { Pool } from 'pg';

interface Args {
  entityId?: string;
  allActive?: boolean;
  dryRun: boolean;
}

interface SeedRule {
  name: string;
  metricName: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  severity: 'info' | 'warning' | 'page' | 'critical';
  windowSeconds: number;
  cooldownSeconds: number;
  channelType: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'opsgenie';
  channelConfig: Record<string, unknown>;
}

const slackWebhook = process.env.SEED_SLACK_WEBHOOK_URL ?? '';
const pagerdutyKey = process.env.SEED_PAGERDUTY_ROUTING_KEY ?? '';

const SEED_RULES: SeedRule[] = [
  {
    name: 'pricing p95 breach',
    metricName: 'pricing_single_latency_ms',
    operator: 'gt',
    threshold: 300,
    severity: 'warning',
    windowSeconds: 300,
    cooldownSeconds: 600,
    channelType: 'slack',
    channelConfig: slackWebhook
      ? { webhookUrl: slackWebhook, channel: '#npricing-ops' }
      : {},
  },
  {
    name: 'tenancy violation',
    metricName: 'tenancy_violations_total',
    operator: 'gt',
    threshold: 0,
    severity: 'critical',
    windowSeconds: 300,
    cooldownSeconds: 300,
    channelType: 'pagerduty',
    channelConfig: pagerdutyKey
      ? { routingKey: pagerdutyKey, severity: 'critical' }
      : {},
  },
  {
    name: 'snapshot write failure',
    metricName: 'snapshot_write_failures_total',
    operator: 'gt',
    threshold: 0,
    severity: 'page',
    windowSeconds: 300,
    cooldownSeconds: 300,
    channelType: 'pagerduty',
    channelConfig: pagerdutyKey
      ? { routingKey: pagerdutyKey, severity: 'critical' }
      : {},
  },
];

function parseArgs(argv: string[]): Args {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--')) continue;
    const key = flag.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  const entityId = typeof out['entity-id'] === 'string' ? out['entity-id'] : undefined;
  const allActive = out['all-active'] === true;
  const dryRun = out['dry-run'] === true;
  if (!entityId && !allActive) {
    console.error('must pass --entity-id <uuid> or --all-active');
    process.exit(1);
  }
  if (entityId && allActive) {
    console.error('--entity-id and --all-active are mutually exclusive');
    process.exit(1);
  }
  return { entityId, allActive, dryRun };
}

async function resolveEntities(pool: Pool, args: Args): Promise<string[]> {
  if (args.entityId) return [args.entityId];
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM entities WHERE is_active = true ORDER BY id`,
  );
  return res.rows.map((r) => r.id);
}

async function seedForEntity(
  pool: Pool,
  entityId: string,
  dryRun: boolean,
): Promise<{ entityId: string; inserted: string[]; skipped: string[] }> {
  const existing = await pool.query<{ name: string }>(
    `SELECT name FROM alert_rules WHERE entity_id = $1 AND name = ANY($2::text[])`,
    [entityId, SEED_RULES.map((r) => r.name)],
  );
  const existingNames = new Set(existing.rows.map((r) => r.name));

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const rule of SEED_RULES) {
    if (existingNames.has(rule.name)) {
      skipped.push(rule.name);
      continue;
    }
    inserted.push(rule.name);
    if (dryRun) continue;
    await pool.query(
      `INSERT INTO alert_rules (
         entity_id, name, metric_name, operator, threshold,
         severity, window_seconds, cooldown_seconds,
         channel_type, channel_config, recipients, is_active
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10::jsonb, '[]'::jsonb, true
       )`,
      [
        entityId,
        rule.name,
        rule.metricName,
        rule.operator,
        rule.threshold,
        rule.severity,
        rule.windowSeconds,
        rule.cooldownSeconds,
        rule.channelType,
        JSON.stringify(rule.channelConfig),
      ],
    );
  }

  return { entityId, inserted, skipped };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const entities = await resolveEntities(pool, args);
    if (entities.length === 0) {
      console.error('no entities matched');
      process.exit(1);
    }

    console.log(
      `${args.dryRun ? '[DRY RUN] ' : ''}Seeding ${SEED_RULES.length} rules across ${entities.length} ${entities.length === 1 ? 'entity' : 'entities'}`,
    );
    if (!slackWebhook) console.warn('  (SEED_SLACK_WEBHOOK_URL unset — slack rule will start with empty channel_config)');
    if (!pagerdutyKey) console.warn('  (SEED_PAGERDUTY_ROUTING_KEY unset — pagerduty rules will start with empty channel_config)');

    let totalInserted = 0;
    let totalSkipped = 0;
    for (const entityId of entities) {
      const r = await seedForEntity(pool, entityId, args.dryRun);
      totalInserted += r.inserted.length;
      totalSkipped += r.skipped.length;
      console.log(
        `  ${entityId.slice(0, 8)} · inserted=${r.inserted.length} skipped=${r.skipped.length}${
          r.inserted.length ? ` [${r.inserted.join(', ')}]` : ''
        }`,
      );
    }

    console.log(`\n${args.dryRun ? '[DRY RUN] ' : ''}Done. inserted=${totalInserted} skipped=${totalSkipped}`);
  } catch (err) {
    console.error('seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
