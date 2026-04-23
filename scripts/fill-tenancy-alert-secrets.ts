#!/usr/bin/env tsx
/**
 * Fill channel_config secrets on the canonical tenancy-strict alert rules.
 *
 * HISTORICAL CONTEXT: this script used to be `seed-tenancy-alerts.ts` —
 * it created the 3 rules AND filled their channel_config from env vars.
 * Since Ola 6 (PR #44 migration + PR #49 provisioning hook) the *rules
 * themselves* are seeded automatically at deploy and tenant-creation time
 * with `channel_config = '{}'::jsonb`. The rule schema no longer needs
 * this script.
 *
 * What's left is the ops-time step of pushing the actual webhook /
 * routing-key secrets into channel_config once they're known. That's
 * what this script does. For every active entity (or the one you pass),
 * it looks up the 3 rules by name and merges env-provided secrets into
 * `channel_config`. If a rule is missing (pre-migration tenant, manual
 * deletion), it inserts it as a safety fallback so the pre-flight
 * checklist still passes.
 *
 * Rules targeted (seeded by migration `20260619000004_tenancy_alerts_seed.sql`
 * and by `scripts/provision-tenant.ts` for new tenants):
 *   - pricing p95 breach         (warning, slack)
 *   - tenancy violation          (critical, pagerduty)
 *   - snapshot write failure     (page,     pagerduty)
 *
 * Idempotent: safe to re-run any number of times. Existing rules with
 * matching names get their channel_config updated in place; the rest is
 * a no-op.
 *
 * Usage:
 *   tsx scripts/fill-tenancy-alert-secrets.ts --entity-id <uuid> [--dry-run]
 *   tsx scripts/fill-tenancy-alert-secrets.ts --all-active       [--dry-run]
 *
 * Secrets read from environment:
 *   SEED_SLACK_WEBHOOK_URL     — slack webhook for pricing latency rule
 *   SEED_PAGERDUTY_ROUTING_KEY — PagerDuty routing key for critical rules
 * Missing env → channel_config stays empty on the matching rule; ops
 * can still fill via UI.
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
): Promise<{
  entityId: string;
  inserted: string[];
  updated: string[];
  skipped: string[];
}> {
  const existing = await pool.query<{ name: string }>(
    `SELECT name FROM alert_rules WHERE entity_id = $1 AND name = ANY($2::text[])`,
    [entityId, SEED_RULES.map((r) => r.name)],
  );
  const existingNames = new Set(existing.rows.map((r) => r.name));

  const inserted: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const rule of SEED_RULES) {
    const hasConfig = Object.keys(rule.channelConfig).length > 0;

    if (existingNames.has(rule.name)) {
      // Primary path since Ola 6: rule exists (from migration #44 or
      // provisioning). Only touch channel_config when env vars supplied
      // actual content — an empty {} is a no-op, leaving ops-entered
      // values alone.
      if (hasConfig) {
        updated.push(rule.name);
        if (dryRun) continue;
        await pool.query(
          `UPDATE alert_rules
           SET channel_config = $3::jsonb,
               updated_at = NOW()
           WHERE entity_id = $1 AND name = $2`,
          [entityId, rule.name, JSON.stringify(rule.channelConfig)],
        );
      } else {
        skipped.push(rule.name);
      }
      continue;
    }

    // Fallback: rule doesn't exist yet (pre-migration env or manually
    // deleted). Insert with whatever channel_config we have.
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

  return { entityId, inserted, updated, skipped };
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
      `${args.dryRun ? '[DRY RUN] ' : ''}Filling channel_config on ${SEED_RULES.length} rules across ${entities.length} ${entities.length === 1 ? 'entity' : 'entities'}`,
    );
    if (!slackWebhook) console.warn('  (SEED_SLACK_WEBHOOK_URL unset — slack rule channel_config stays empty)');
    if (!pagerdutyKey) console.warn('  (SEED_PAGERDUTY_ROUTING_KEY unset — pagerduty rule channel_config stays empty)');

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    for (const entityId of entities) {
      const r = await seedForEntity(pool, entityId, args.dryRun);
      totalInserted += r.inserted.length;
      totalUpdated  += r.updated.length;
      totalSkipped  += r.skipped.length;
      const actions = [
        r.inserted.length ? `inserted=${r.inserted.length} [${r.inserted.join(', ')}]` : null,
        r.updated.length  ? `updated=${r.updated.length} [${r.updated.join(', ')}]`    : null,
        r.skipped.length  ? `skipped=${r.skipped.length}`                              : null,
      ].filter(Boolean).join(' · ');
      console.log(`  ${entityId.slice(0, 8)} · ${actions || 'noop'}`);
    }

    console.log(
      `\n${args.dryRun ? '[DRY RUN] ' : ''}Done. inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped}`,
    );
  } catch (err) {
    console.error('seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
