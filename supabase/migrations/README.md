# N-Pricing Database Migrations

## Overview

This directory contains Supabase migrations for the N-Pricing FTP engine database. These migrations were converted from the legacy `schema.sql` and `schema_v2.sql` files into a proper sequential migration system.

## Migration Files

| File | Description |
|------|-------------|
| `20240101000000_initial_schema.sql` | Core tables: deals, audit_log, behavioural_models, yield_curves, system_config, rules, users, pricing_results, clients, products, business_units, rate_cards, liquidity_curves, esg grids, incentivisation_rules, approval_matrix. Includes audit immutability trigger and realtime subscriptions. |
| `20240201000000_v2_extensions.sql` | V2 enhancements: new columns on deals (workflow, versioning, approval), new tables (deal_versions, ftp_rate_cards), enhanced constraints on reference tables, updated_at triggers, grants, and seed data. |
| `20240301000000_rls_policies.sql` | All Row Level Security policies. Drops legacy blanket `USING(true)` policies and replaces them with role-based policies using `get_user_role()`. Separated for independent policy tuning. |
| `20240401000000_indexes.sql` | All performance indexes across all tables. Separated for independent performance tuning. |

## How to Run Migrations

### Using Supabase CLI (recommended)

```bash
# Apply all pending migrations
supabase db push

# Or use migration up
supabase migration up
```

### Manually in Supabase Dashboard

1. Go to **SQL Editor** in your Supabase Dashboard.
2. Run each migration file in order (by timestamp prefix).

## How to Create New Migrations

```bash
supabase migration new <descriptive_name>
```

This creates a new timestamped file in `supabase/migrations/`. Example:

```bash
supabase migration new add_counterparty_table
# Creates: supabase/migrations/20260402120000_add_counterparty_table.sql
```

## Naming Convention

Migrations use the Supabase standard format:

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

- Timestamp ensures execution order.
- Use snake_case for the descriptive name.
- Keep names short but meaningful.

## Notes

- **Converted from legacy files:** The original `supabase/schema.sql` and `supabase/schema_v2.sql` are kept for reference but should not be used for schema changes. All future changes go through migrations.
- **Idempotent where possible:** Tables use `IF NOT EXISTS`, columns are checked before adding via `information_schema`, and policies are dropped before recreation.
- **Sequential dependency:** Migrations must be run in timestamp order. Each migration may depend on objects created in earlier migrations.
- **RLS policies:** The v2 policies use `get_user_role()` which queries the `users` table via `auth.jwt()`. For development/demo without Supabase Auth, you may need to temporarily use the simpler `USING(true)` policies from the initial schema.
