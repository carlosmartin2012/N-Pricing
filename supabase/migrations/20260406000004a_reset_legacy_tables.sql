-- Comprehensive cleanup of tables created by the old inline schema (server/migrate.ts).
-- These tables will be recreated correctly by the subsequent migration files.
-- Data seeded by seed-demo-dataset.ts is restored on each server start.
-- This migration is a no-op for any table that does not exist.

DROP TABLE IF EXISTS alert_invocations             CASCADE;
DROP TABLE IF EXISTS alert_rules                   CASCADE;
DROP TABLE IF EXISTS approval_escalation_configs   CASCADE;
DROP TABLE IF EXISTS approval_escalations          CASCADE;
DROP TABLE IF EXISTS attribution_decisions         CASCADE;
DROP TABLE IF EXISTS attribution_levels            CASCADE;
DROP TABLE IF EXISTS attribution_threshold_recalibrations CASCADE;
DROP TABLE IF EXISTS attribution_thresholds        CASCADE;
DROP TABLE IF EXISTS backtesting_runs              CASCADE;
DROP TABLE IF EXISTS budget_targets                CASCADE;
DROP TABLE IF EXISTS canonical_deal_templates      CASCADE;
DROP TABLE IF EXISTS channel_api_keys              CASCADE;
DROP TABLE IF EXISTS channel_request_log           CASCADE;
DROP TABLE IF EXISTS client_events                 CASCADE;
DROP TABLE IF EXISTS client_ltv_snapshots          CASCADE;
DROP TABLE IF EXISTS client_metrics_snapshots      CASCADE;
DROP TABLE IF EXISTS client_nba_recommendations    CASCADE;
DROP TABLE IF EXISTS client_positions              CASCADE;
DROP TABLE IF EXISTS deal_variance_snapshots       CASCADE;
DROP TABLE IF EXISTS error_budget                  CASCADE;
DROP TABLE IF EXISTS greenium_rate_cards           CASCADE;
DROP TABLE IF EXISTS metrics                       CASCADE;
DROP TABLE IF EXISTS methodology_snapshots         CASCADE;
DROP TABLE IF EXISTS model_inventory               CASCADE;
DROP TABLE IF EXISTS pricing_campaigns             CASCADE;
DROP TABLE IF EXISTS pricing_exceptions            CASCADE;
DROP TABLE IF EXISTS pricing_snapshots             CASCADE;
DROP TABLE IF EXISTS pricing_targets               CASCADE;
DROP TABLE IF EXISTS push_subscriptions            CASCADE;
DROP TABLE IF EXISTS sandbox_methodologies         CASCADE;
DROP TABLE IF EXISTS signed_committee_dossiers     CASCADE;
DROP TABLE IF EXISTS target_grid_cells             CASCADE;
DROP TABLE IF EXISTS tenancy_violations            CASCADE;
DROP TABLE IF EXISTS tenant_feature_flags          CASCADE;
DROP TABLE IF EXISTS tolerance_bands               CASCADE;
DROP TABLE IF EXISTS usage_events                  CASCADE;
