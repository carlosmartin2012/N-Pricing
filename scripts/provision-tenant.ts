#!/usr/bin/env tsx
/**
 * Tenant provisioning — idempotent script that creates a fresh entity with
 * its admin user, default feature flags, and seed reference data.
 *
 * Usage:
 *   tsx scripts/provision-tenant.ts \
 *     --short-code BBVA-ES \
 *     --name "BBVA España" \
 *     --legal-name "BBVA, S.A." \
 *     --country ES \
 *     --currency EUR \
 *     --admin-email admin@bbva.es \
 *     --group-id <UUID>            # optional; falls back to Default Group
 *
 * Idempotency: every INSERT uses ON CONFLICT DO NOTHING — re-runs are safe.
 * Exit code 0 on success, 1 on any error.
 */

import { Pool } from 'pg';
import crypto from 'crypto';

interface Args {
  shortCode: string;
  name: string;
  legalName?: string;
  country: string;
  currency: string;
  adminEmail: string;
  groupId?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && i + 1 < argv.length) {
      out[a.slice(2)] = argv[++i];
    }
  }
  const required = ['short-code', 'name', 'admin-email'];
  for (const r of required) {
    if (!out[r]) {
      console.error(`missing required arg --${r}`);
      process.exit(1);
    }
  }
  return {
    shortCode: out['short-code'],
    name: out.name,
    legalName: out['legal-name'],
    country: out.country ?? 'ES',
    currency: out.currency ?? 'EUR',
    adminEmail: out['admin-email'],
    groupId: out['group-id'],
  };
}

const DEFAULT_FLAGS: Array<{ flag: string; enabled: boolean; notes: string }> = [
  { flag: 'pricing_enabled',     enabled: true,  notes: 'Master switch for pricing endpoints' },
  { flag: 'channel_api_enabled', enabled: false, notes: 'Off by default until channel keys minted' },
  { flag: 'ai_assistant_enabled', enabled: true, notes: 'AI Lab visible in the UI' },
  { flag: 'kill_switch',         enabled: false, notes: 'Set to true to halt all writes for this tenant' },
];

/**
 * Canonical 3-rule seed required before flipping TENANCY_STRICT=on.
 * Mirrors supabase/migrations/20260619000004_tenancy_alerts_seed.sql so
 * tenants provisioned *after* that migration ran still get the rules
 * without waiting for the next deploy. channel_config is intentionally
 * empty; scripts/fill-tenancy-alert-secrets.ts fills in secrets when env vars
 * are available.
 */
const DEFAULT_ALERT_RULES: Array<{
  name: string;
  metricName: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  severity: 'info' | 'warning' | 'page' | 'critical';
  windowSeconds: number;
  cooldownSeconds: number;
  channelType: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'opsgenie';
}> = [
  { name: 'pricing p95 breach',      metricName: 'pricing_single_latency_ms',     operator: 'gt', threshold: 300, severity: 'warning',  windowSeconds: 300, cooldownSeconds: 600, channelType: 'slack'     },
  { name: 'tenancy violation',       metricName: 'tenancy_violations_total',      operator: 'gt', threshold: 0,   severity: 'critical', windowSeconds: 300, cooldownSeconds: 300, channelType: 'pagerduty' },
  { name: 'snapshot write failure',  metricName: 'snapshot_write_failures_total', operator: 'gt', threshold: 0,   severity: 'page',     windowSeconds: 300, cooldownSeconds: 300, channelType: 'pagerduty' },
];

async function provision(args: Args): Promise<{ entityId: string; userId: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const groupId = args.groupId ?? '00000000-0000-0000-0000-000000000001';
    const entityId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    await pool.query('BEGIN');

    // 1. Entity (idempotent on short_code).
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO entities (id, group_id, name, legal_name, short_code, country, base_currency, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (short_code) DO UPDATE SET
         name = EXCLUDED.name,
         legal_name = COALESCE(EXCLUDED.legal_name, entities.legal_name),
         updated_at = NOW()
       RETURNING id`,
      [entityId, groupId, args.name, args.legalName ?? null, args.shortCode, args.country, args.currency],
    );
    const finalEntityId = ins.rows[0].id;

    // 2. Admin user.
    await pool.query(
      `INSERT INTO users (id, name, email, role, status)
       VALUES ($1, $2, $3, 'Admin', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [userId, args.adminEmail.split('@')[0], args.adminEmail],
    );

    // 3. Membership in entity_users.
    await pool.query(
      `INSERT INTO entity_users (entity_id, user_id, role, is_primary_entity)
       VALUES ($1, $2, 'Admin', true)
       ON CONFLICT (entity_id, user_id) DO NOTHING`,
      [finalEntityId, args.adminEmail],
    );

    // 4. Default feature flags.
    for (const flag of DEFAULT_FLAGS) {
      await pool.query(
        `INSERT INTO tenant_feature_flags (entity_id, flag, enabled, set_by, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (entity_id, flag) DO NOTHING`,
        [finalEntityId, flag.flag, flag.enabled, args.adminEmail, flag.notes],
      );
    }

    // 5. Canonical alert rules (Ola 6 Bloque A — pre-TENANCY_STRICT flip).
    // alert_rules has no UNIQUE(entity_id, name), so we guard with NOT EXISTS.
    for (const rule of DEFAULT_ALERT_RULES) {
      await pool.query(
        `INSERT INTO alert_rules (
           entity_id, name, metric_name, operator, threshold,
           severity, window_seconds, cooldown_seconds,
           channel_type, channel_config, recipients, is_active
         )
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb, '[]'::jsonb, true
         WHERE NOT EXISTS (
           SELECT 1 FROM alert_rules WHERE entity_id = $1 AND name = $2
         )`,
        [
          finalEntityId,
          rule.name,
          rule.metricName,
          rule.operator,
          rule.threshold,
          rule.severity,
          rule.windowSeconds,
          rule.cooldownSeconds,
          rule.channelType,
        ],
      );
    }

    await pool.query('COMMIT');

    return { entityId: finalEntityId, userId };
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.info('[provision-tenant] starting', { shortCode: args.shortCode, name: args.name });
  const start = Date.now();
  const out = await provision(args);
  const elapsedMs = Date.now() - start;
  console.info('[provision-tenant] done', { ...out, elapsedMs });
  console.info(`[provision-tenant] took ${elapsedMs}ms (target < 60_000ms per Phase 5 SLO)`);
}

if (process.argv[1]?.endsWith('provision-tenant.ts') || process.argv[1]?.endsWith('provision-tenant.js')) {
  main().catch((err) => {
    console.error('[provision-tenant] failed', err);
    process.exit(1);
  });
}

export { provision, parseArgs, DEFAULT_FLAGS, DEFAULT_ALERT_RULES };
