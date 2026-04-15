# Phase 0 — Specs técnicas (SQL + tipos + contratos de API)

> Complemento de [phase-0-design.md](./phase-0-design.md).
> Contenido: SQL completo listo para convertir en migrations, interfaces TypeScript, contratos OpenAPI para los endpoints nuevos y ejemplos de payloads. Ningún archivo real se modifica todavía — todo son specs para revisión.

**Numeración de migrations propuesta** (para evitar colisión con `20260510000001_market_benchmarks.sql` ya reservada):

| Fichero propuesto | Bloque |
|---|---|
| `20260601000001_tenancy_helpers.sql` | A.1 |
| `20260601000002_rls_delete_policies.sql` | A.2 |
| `20260601000003_greenium_entity_scope.sql` | A.3 |
| `20260601000004_pricing_snapshots.sql` | B |
| `20260601000005_slo_metrics.sql` | C.1 |
| `20260601000006_alert_channels.sql` | C.2 |

---

## 1 · SQL completo de las migrations

### 1.1 · `20260601000001_tenancy_helpers.sql`

```sql
-- Tenancy strict mode + helper for user role context.
-- Ties Postgres session to the authenticated user/entity set by the Node middleware.
-- Breaking change: get_current_entity_id() no longer falls back to Default Entity.
--   A feature flag (app.tenancy_strict) controls rollout. Set to 'on' only after
--   all server paths go through the tenancy middleware (see docs/phase-0-design.md §A).

-- ---------- 1) Strict current entity resolver ----------

CREATE OR REPLACE FUNCTION get_current_entity_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  raw    TEXT;
  strict TEXT;
BEGIN
  raw    := current_setting('app.current_entity_id', true);
  strict := coalesce(current_setting('app.tenancy_strict', true), 'off');

  IF raw IS NULL OR raw = '' THEN
    IF strict = 'on' THEN
      RAISE EXCEPTION 'tenancy_not_set'
        USING ERRCODE = '42501',
              HINT    = 'Server must set app.current_entity_id before running queries.';
    END IF;
    -- Legacy fallback (to be removed after rollout).
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
  END IF;

  RETURN raw::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    IF strict = 'on' THEN
      RAISE EXCEPTION 'tenancy_invalid_uuid'
        USING ERRCODE = '42501';
    END IF;
    RETURN '00000000-0000-0000-0000-000000000010'::UUID;
END;
$$;

-- ---------- 2) Current user role helper ----------

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN coalesce(current_setting('app.current_user_role', true), '');
END;
$$;

-- ---------- 3) Tenancy violation counter ----------

CREATE TABLE IF NOT EXISTS tenancy_violations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id   TEXT,
  user_email   TEXT,
  endpoint     TEXT,
  claimed_entity UUID,
  actual_entities UUID[],
  error_code   TEXT        NOT NULL,
  detail       JSONB       DEFAULT '{}'
);

-- Only service role writes; nobody reads from authenticated context.
ALTER TABLE tenancy_violations ENABLE ROW LEVEL SECURITY;
-- No policies → no access from authenticated users. Service role bypasses RLS.

CREATE INDEX idx_tenancy_violations_recent
  ON tenancy_violations (occurred_at DESC);

COMMENT ON TABLE tenancy_violations IS
  'Append-only log of tenancy check failures. SLO target = 0 events/minute.';
```

### 1.2 · `20260601000002_rls_delete_policies.sql`

```sql
-- Fills the DELETE policy gap left by 20260406000001_multi_entity.sql.
-- Only Admin role (set by tenancy middleware) may delete, and only within current entity.

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients','products','business_units','deals','rules','users',
    'behavioural_models','yield_curves','rate_cards','liquidity_curves',
    'esg_transition_grid','esg_physical_grid','pricing_results'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      tbl || '_entity_delete', tbl
    );
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR DELETE TO authenticated
        USING (
          entity_id = get_current_entity_id()
          AND get_current_user_role() = 'Admin'
        )
    $f$, tbl || '_entity_delete', tbl);
  END LOOP;
END $$;

-- audit_log and *_versions tables: no DELETE policy created on purpose
-- (append-only invariant).

-- pricing_snapshots (created in migration 000004) explicitly forbids DELETE.
```

### 1.3 · `20260601000003_greenium_entity_scope.sql`

```sql
-- Move greenium_rate_cards into the entity-scoped model.

ALTER TABLE greenium_rate_cards
  ADD COLUMN IF NOT EXISTS entity_id UUID
  REFERENCES entities(id)
  DEFAULT '00000000-0000-0000-0000-000000000010';

UPDATE greenium_rate_cards
  SET entity_id = '00000000-0000-0000-0000-000000000010'
  WHERE entity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_greenium_rate_cards_entity
  ON greenium_rate_cards(entity_id);

ALTER TABLE greenium_rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "greenium_rate_cards_read"  ON greenium_rate_cards;
DROP POLICY IF EXISTS "greenium_rate_cards_write" ON greenium_rate_cards;

CREATE POLICY greenium_rate_cards_entity_read ON greenium_rate_cards
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY greenium_rate_cards_entity_insert ON greenium_rate_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin','Risk_Manager')
  );

CREATE POLICY greenium_rate_cards_entity_update ON greenium_rate_cards
  FOR UPDATE TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (
    entity_id = get_current_entity_id()
    AND get_current_user_role() IN ('Admin','Risk_Manager')
  );

CREATE POLICY greenium_rate_cards_entity_delete ON greenium_rate_cards
  FOR DELETE TO authenticated
  USING (
    entity_id = get_current_entity_id()
    AND get_current_user_role() = 'Admin'
  );
```

### 1.4 · `20260601000004_pricing_snapshots.sql`

```sql
-- Immutable snapshot table guaranteeing pricing reproducibility.
-- Each row stores the full input + context + output used to compute an FTPResult.
-- See docs/phase-0-design.md §B for semantics and retention rules.

CREATE TABLE IF NOT EXISTS pricing_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL REFERENCES entities(id),
  deal_id           UUID        REFERENCES deals(id) ON DELETE SET NULL,
  pricing_result_id UUID        REFERENCES pricing_results(id) ON DELETE SET NULL,

  request_id        TEXT        NOT NULL,
  engine_version    TEXT        NOT NULL,
  as_of_date        DATE        NOT NULL,
  used_mock_for     TEXT[]      NOT NULL DEFAULT '{}',

  input             JSONB       NOT NULL,
  context           JSONB       NOT NULL,
  output            JSONB       NOT NULL,

  input_hash        TEXT        NOT NULL,
  output_hash       TEXT        NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_input_hash_format  CHECK (input_hash  ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_output_hash_format CHECK (output_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_snap_entity_created ON pricing_snapshots (entity_id, created_at DESC);
CREATE INDEX idx_snap_deal           ON pricing_snapshots (deal_id, created_at DESC);
CREATE INDEX idx_snap_result         ON pricing_snapshots (pricing_result_id);
CREATE INDEX idx_snap_request        ON pricing_snapshots (request_id);
CREATE INDEX idx_snap_engine_version ON pricing_snapshots (engine_version);

ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_snapshots_read ON pricing_snapshots
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY pricing_snapshots_insert ON pricing_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- No UPDATE and no DELETE policies → immutable by RLS.

-- Optional: trigger to block writes that forgot to compute hashes.
CREATE OR REPLACE FUNCTION enforce_snapshot_hashes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.input_hash IS NULL OR NEW.output_hash IS NULL THEN
    RAISE EXCEPTION 'snapshot_missing_hashes';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_enforce_snapshot_hashes
  BEFORE INSERT ON pricing_snapshots
  FOR EACH ROW EXECUTE FUNCTION enforce_snapshot_hashes();

COMMENT ON TABLE pricing_snapshots IS
  'Immutable reproducibility snapshots. Input+context+output for every pricing call.';
COMMENT ON COLUMN pricing_snapshots.used_mock_for IS
  'Config sections that fell back to mock data in this call. Production SLO: array empty.';
```

### 1.5 · `20260601000005_slo_metrics.sql`

```sql
-- SLO surface: per-minute percentile aggregates + error budget tracking.

-- ---------- 1) Materialised view over metrics ----------

DROP MATERIALIZED VIEW IF EXISTS pricing_slo_minute;
CREATE MATERIALIZED VIEW pricing_slo_minute AS
SELECT
  entity_id,
  date_trunc('minute', recorded_at)                              AS bucket,
  (dimensions->>'endpoint')                                      AS endpoint,
  count(*)                                                       AS n_requests,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value)     AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value)     AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY metric_value)     AS p99_ms,
  avg(metric_value)                                              AS avg_ms,
  max(metric_value)                                              AS max_ms,
  count(*) FILTER (WHERE (dimensions->>'status_code')::int >= 500) AS n_errors
FROM metrics
WHERE metric_name LIKE 'pricing_%_latency_ms'
GROUP BY entity_id, bucket, endpoint;

CREATE UNIQUE INDEX idx_pricing_slo_minute_pk
  ON pricing_slo_minute (entity_id, bucket, endpoint);

-- Refresh every minute via pg_cron (requires extension enabled).
-- SELECT cron.schedule('refresh-slo-minute', '* * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY pricing_slo_minute');

-- ---------- 2) Error budget tracker ----------

CREATE TABLE IF NOT EXISTS error_budget (
  entity_id     UUID        NOT NULL REFERENCES entities(id),
  slo_name      TEXT        NOT NULL,
  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,
  budget_total  NUMERIC     NOT NULL,
  budget_used   NUMERIC     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_id, slo_name, period_start)
);

ALTER TABLE error_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_budget_read ON error_budget
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY error_budget_write ON error_budget
  FOR ALL TO authenticated
  USING (entity_id = get_current_entity_id())
  WITH CHECK (entity_id = get_current_entity_id());

-- ---------- 3) Extra metric dimensions index ----------

CREATE INDEX IF NOT EXISTS idx_metrics_endpoint
  ON metrics ((dimensions->>'endpoint'), recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_request_id
  ON metrics ((dimensions->>'request_id'));
```

### 1.6 · `20260601000006_alert_channels.sql`

```sql
-- Extend alert_rules to support multiple delivery channels and severities.
-- Legacy rows (email-only) are migrated idempotently.

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS channel_type     TEXT     NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS channel_config   JSONB             DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS severity         TEXT     NOT NULL DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS window_seconds   INTEGER  NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER  NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

ALTER TABLE alert_rules
  DROP CONSTRAINT IF EXISTS alert_rules_channel_type_check,
  ADD  CONSTRAINT alert_rules_channel_type_check
    CHECK (channel_type IN ('email','slack','pagerduty','webhook','opsgenie'));

ALTER TABLE alert_rules
  DROP CONSTRAINT IF EXISTS alert_rules_severity_check,
  ADD  CONSTRAINT alert_rules_severity_check
    CHECK (severity IN ('info','warning','page','critical'));

-- Backfill: existing rows with recipients[] become email channels.
UPDATE alert_rules
SET channel_type   = 'email',
    channel_config = jsonb_build_object('recipients', recipients)
WHERE channel_type = 'email' AND channel_config = '{}'::jsonb;

-- Alert invocations log (for audit + deduplication).
CREATE TABLE IF NOT EXISTS alert_invocations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id  UUID        NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  entity_id      UUID        NOT NULL REFERENCES entities(id),
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric_value   NUMERIC     NOT NULL,
  threshold      NUMERIC     NOT NULL,
  payload_sent   JSONB       NOT NULL,
  delivery_status TEXT       NOT NULL CHECK (delivery_status IN ('pending','sent','failed','deduped')),
  delivery_error TEXT
);

CREATE INDEX idx_alert_invocations_rule
  ON alert_invocations (alert_rule_id, triggered_at DESC);

ALTER TABLE alert_invocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_invocations_read ON alert_invocations
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));
-- Writes happen via service role (worker).
```

---

## 2 · Tipos TypeScript

Propuesta para un archivo nuevo `types/phase0.ts` (o distribuir por dominio).

### 2.1 · Tenancy

```ts
/** Context attached to every authenticated request after tenancyMiddleware runs. */
export interface TenancyContext {
  /** UUID of the entity the user is currently operating on. */
  entityId: string;
  /** Email claim from the JWT — used as user_id key. */
  userEmail: string;
  /** Role within that entity. */
  role: EntityRole;
  /** Request correlation id (UUIDv7). Echoed back via x-request-id. */
  requestId: string;
}

export type EntityRole = 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';

/** Error code returned by middleware / helpers. */
export type TenancyErrorCode =
  | 'tenancy_missing_header'
  | 'tenancy_invalid_uuid'
  | 'tenancy_denied'
  | 'tenancy_jwt_invalid';

declare module 'express-serve-static-core' {
  interface Request {
    tenancy?: TenancyContext;
  }
}
```

### 2.2 · Pricing snapshot

```ts
/** Row in pricing_snapshots — never mutated after insert. */
export interface PricingSnapshot {
  id: string;
  entityId: string;
  dealId: string | null;
  pricingResultId: string | null;

  requestId: string;
  engineVersion: string;     // git sha, e.g. '8da95ed'
  asOfDate: string;          // 'YYYY-MM-DD'
  usedMockFor: string[];     // [] in production

  input:   PricingInputPayload;
  context: PricingContextPayload;
  output:  FTPResult;

  inputHash: string;   // sha256 hex
  outputHash: string;  // sha256 hex

  createdAt: string;   // ISO timestamp
}

export interface PricingInputPayload {
  deal: Transaction;
  approvalMatrix?: ApprovalMatrixConfig;
  shocks?: { interestRate?: number; liquiditySpread?: number };
}

export interface PricingContextPayload {
  curves: {
    yield:     YieldCurve[];
    liquidity: LiquidityCurve[];
  };
  rules:              PricingRule[];
  rateCards:          RateCard[];
  transitionGrid:     ESGTransitionGrid;
  physicalGrid:       ESGPhysicalGrid;
  greeniumRateCards:  GreeniumRateCard[];
  behaviouralModels:  BehaviouralModel[];
  sdrConfig:          SDRConfig;
  lrConfig:           LRConfig;
  clients:            ClientEntity[];
  products:           ProductEntity[];
  businessUnits:      BusinessUnit[];
}

/** Replay result surfaced by POST /snapshots/:id/replay. */
export interface SnapshotReplayResult {
  snapshotId: string;
  matches: boolean;
  engineVersionOriginal: string;
  engineVersionNow: string;
  diff: {
    field: string;          // e.g. 'output.finalClientRate'
    original: unknown;
    current: unknown;
    deltaAbs?: number;
    deltaBps?: number;
  }[];
}
```

### 2.3 · SLO & alertas

```ts
export type SLIName =
  | 'pricing_single_latency_ms'
  | 'pricing_batch_latency_ms_per_deal'
  | 'pricing_error_rate'
  | 'tenancy_violations_total'
  | 'mock_fallback_rate'
  | 'snapshot_write_failures_total'
  | 'auth_failures_total'
  | 'cold_start_duration_ms';

export interface SLODefinition {
  name: SLIName;
  target: number;
  comparator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  windowSeconds: number;
  severity: AlertSeverity;
  description: string;
}

export type AlertSeverity = 'info' | 'warning' | 'page' | 'critical';
export type AlertChannelType = 'email' | 'slack' | 'pagerduty' | 'webhook' | 'opsgenie';

export interface AlertRule {
  id: string;
  entityId: string;
  name: string;
  metricName: SLIName;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  severity: AlertSeverity;
  windowSeconds: number;
  cooldownSeconds: number;
  channelType: AlertChannelType;
  channelConfig:
    | EmailChannelConfig
    | SlackChannelConfig
    | PagerDutyChannelConfig
    | WebhookChannelConfig
    | OpsgenieChannelConfig;
  isActive: boolean;
  lastTriggeredAt: string | null;
}

export interface EmailChannelConfig     { recipients: string[]; }
export interface SlackChannelConfig     { webhookUrl: string; channel?: string; }
export interface PagerDutyChannelConfig { routingKey: string; severity?: string; }
export interface WebhookChannelConfig   { url: string; method?: 'POST'|'PUT'; headers?: Record<string,string>; secret?: string; }
export interface OpsgenieChannelConfig  { apiKey: string; team?: string; }

export interface AlertInvocation {
  id: string;
  alertRuleId: string;
  entityId: string;
  triggeredAt: string;
  metricValue: number;
  threshold: number;
  payloadSent: unknown;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'deduped';
  deliveryError: string | null;
}
```

### 2.4 · SLO seed values (para `config/slo.ts` o equivalente)

```ts
export const PRICING_SLOS: SLODefinition[] = [
  { name: 'pricing_single_latency_ms',        target: 300,   comparator: 'lt', windowSeconds: 3600, severity: 'warning',  description: '/pricing p95 under 300 ms (rolling 1h)' },
  { name: 'pricing_single_latency_ms',        target: 800,   comparator: 'lt', windowSeconds: 3600, severity: 'warning',  description: '/pricing p99 under 800 ms (rolling 1h)' },
  { name: 'pricing_batch_latency_ms_per_deal',target: 50,    comparator: 'lt', windowSeconds: 3600, severity: 'warning',  description: '/pricing/batch per-deal p95 under 50 ms' },
  { name: 'pricing_error_rate',               target: 0.005, comparator: 'lt', windowSeconds: 300,  severity: 'page',     description: 'Error rate under 0.5% (rolling 5 min)' },
  { name: 'tenancy_violations_total',         target: 0,     comparator: 'eq', windowSeconds: 60,   severity: 'critical', description: 'Any tenancy violation in 1 minute pages immediately' },
  { name: 'mock_fallback_rate',               target: 0.05,  comparator: 'lt', windowSeconds: 3600, severity: 'warning',  description: 'Under 5% of calls fall back to mock data' },
  { name: 'snapshot_write_failures_total',    target: 0,     comparator: 'eq', windowSeconds: 300,  severity: 'page',     description: 'Snapshot write must never fail' },
];
```

---

## 3 · Contratos OpenAPI (extensiones v2 de `api-spec.yaml`)

Las secciones a añadir al archivo existente. Formatear con el resto del YAML.

```yaml
paths:
  /pricing/snapshots/{id}:
    get:
      summary: Fetch a pricing snapshot by id
      operationId: getPricingSnapshot
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Snapshot detail
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PricingSnapshot' }
        '403': { description: Tenancy denied }
        '404': { description: Snapshot not found }

  /pricing/snapshots/{id}/replay:
    post:
      summary: Replay a pricing snapshot with the current engine version
      description: >
        Re-runs the pricing engine with the stored input and context.
        Returns matches=true if the output hash matches the original;
        diff is populated when outputs drift (engine version bump, regulatory change).
      operationId: replayPricingSnapshot
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Replay outcome
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SnapshotReplayResult' }

  /observability/slo-summary:
    get:
      summary: SLO status snapshot for the current entity
      operationId: getSLOSummary
      parameters:
        - name: window
          in: query
          schema: { type: string, enum: [1h, 24h, 7d, 30d], default: 1h }
      responses:
        '200':
          description: Summary
          content:
            application/json:
              schema:
                type: object
                properties:
                  entityId:   { type: string, format: uuid }
                  window:     { type: string }
                  generatedAt:{ type: string, format: date-time }
                  slos:
                    type: array
                    items:
                      type: object
                      properties:
                        name:        { type: string }
                        target:      { type: number }
                        current:     { type: number }
                        status:      { type: string, enum: [ok, warning, breached] }
                        errorBudget:
                          type: object
                          properties:
                            total: { type: number }
                            used:  { type: number }
                            pct:   { type: number }
                  activeAlerts:
                    type: array
                    items:
                      type: object
                      properties:
                        ruleId:       { type: string, format: uuid }
                        severity:     { type: string }
                        triggeredAt:  { type: string, format: date-time }

components:
  schemas:
    PricingSnapshot:
      type: object
      required: [id, entityId, requestId, engineVersion, asOfDate, input, context, output, inputHash, outputHash, createdAt]
      properties:
        id:                { type: string, format: uuid }
        entityId:          { type: string, format: uuid }
        dealId:            { type: string, format: uuid, nullable: true }
        pricingResultId:   { type: string, format: uuid, nullable: true }
        requestId:         { type: string }
        engineVersion:     { type: string, description: 'Git sha of the engine' }
        asOfDate:          { type: string, format: date }
        usedMockFor:
          type: array
          items: { type: string }
        input:    { type: object }
        context:  { type: object }
        output:   { $ref: '#/components/schemas/FTPResult' }
        inputHash:   { type: string, pattern: '^[a-f0-9]{64}$' }
        outputHash:  { type: string, pattern: '^[a-f0-9]{64}$' }
        createdAt:   { type: string, format: date-time }

    SnapshotReplayResult:
      type: object
      required: [snapshotId, matches, engineVersionOriginal, engineVersionNow, diff]
      properties:
        snapshotId:           { type: string, format: uuid }
        matches:              { type: boolean }
        engineVersionOriginal:{ type: string }
        engineVersionNow:     { type: string }
        diff:
          type: array
          items:
            type: object
            properties:
              field:    { type: string }
              original: {}
              current:  {}
              deltaAbs: { type: number, nullable: true }
              deltaBps: { type: number, nullable: true }

    Error:
      type: object
      required: [code, message]
      properties:
        code:      { type: string }
        message:   { type: string }
        requestId: { type: string }
        details:   { type: object }
```

**Headers normativos** que se añaden a TODOS los endpoints:

| Header | Dirección | Obligatorio | Semántica |
|---|---|---|---|
| `x-request-id` | request & response | No (server lo genera) | Correlación end-to-end |
| `x-entity-id` | request | Sí | UUID de la entidad activa |
| `x-snapshot-id` | response (solo `/pricing*`) | Sí | UUID de snapshot persistido |
| `x-engine-version` | response | Sí | Git sha del motor usado |

---

## 4 · Ejemplos de payloads

### 4.1 · Snapshot (una fila real)

```json
{
  "id": "7c94bf4a-ebee-7c94-bf4a-ebee7c94bf4a",
  "entityId": "00000000-0000-0000-0000-000000000010",
  "dealId": "d9d50421-5b1f-4220-8ecb-3e9c26feaabc",
  "pricingResultId": "a3eef05c-2a91-4f8e-bf1c-e7b56e68d7aa",
  "requestId": "0195e1a7-4f1c-7a05-b2d6-77c7e4d91c0a",
  "engineVersion": "8da95ed",
  "asOfDate": "2026-04-15",
  "usedMockFor": [],
  "input": {
    "deal": {
      "id": "d9d50421-5b1f-4220-8ecb-3e9c26feaabc",
      "product": "MORTGAGE",
      "category": "RETAIL",
      "amount": 180000,
      "duration": 25,
      "currency": "EUR",
      "clientId": "c-0421",
      "clientType": "Retail",
      "clientRating": "BBB+"
    },
    "approvalMatrix": { "levels": [/* ... */] },
    "shocks": { "interestRate": 0, "liquiditySpread": 0 }
  },
  "context": {
    "curves": { "yield": [ /* full curve points */ ], "liquidity": [ /* ... */ ] },
    "rules": [ /* all rules that matched */ ],
    "rateCards": [ /* ... */ ],
    "transitionGrid": { /* ... */ },
    "physicalGrid": { /* ... */ },
    "greeniumRateCards": [ /* ... */ ],
    "behaviouralModels": [ /* ... */ ],
    "sdrConfig": { /* ... */ },
    "lrConfig": { /* ... */ },
    "clients": [ /* only the referenced client */ ],
    "products": [ /* only the referenced product */ ],
    "businessUnits": [ /* only the relevant BU */ ]
  },
  "output": {
    "baseRate": 0.0318,
    "liquiditySpread": 0.0042,
    "strategicSpread": 0.0025,
    "capitalCharge": 0.0017,
    "finalClientRate": 0.0402,
    "raroc": 0.152
  },
  "inputHash":  "a3c9b1d4e2f6a8b0c7d5e3f1b4a2c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0",
  "outputHash": "5f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0a3c9b1d4e2f6a8b0c7d5e3f1b4a2c6d8e",
  "createdAt": "2026-04-15T10:27:31.842Z"
}
```

### 4.2 · Alert payloads por canal

**Slack (`channelType: 'slack'`):**

```json
{
  "channel": "#ops-npricing",
  "text": ":rotating_light: *[PAGE] pricing_error_rate breached*",
  "attachments": [{
    "color": "danger",
    "fields": [
      { "title": "Entity",       "value": "BBVA PROD", "short": true },
      { "title": "SLI",          "value": "pricing_error_rate", "short": true },
      { "title": "Current",      "value": "0.018 (1.8%)", "short": true },
      { "title": "Threshold",    "value": "< 0.005", "short": true },
      { "title": "Window",       "value": "last 5 min", "short": true },
      { "title": "Triggered at", "value": "2026-04-15T10:27:31Z", "short": true },
      { "title": "Runbook",      "value": "<https://docs.internal/npricing/runbook-error-rate|Open>" }
    ]
  }]
}
```

**PagerDuty (`channelType: 'pagerduty'`):**

```json
{
  "routing_key": "${PAGERDUTY_ROUTING_KEY}",
  "event_action": "trigger",
  "dedup_key": "alert_rule_<ruleId>_<entityId>",
  "payload": {
    "summary": "[PAGE] tenancy_violations_total > 0 on BBVA PROD",
    "severity": "critical",
    "source": "n-pricing",
    "component": "edge-function-pricing",
    "group": "n-pricing.multitenancy",
    "class": "security",
    "custom_details": {
      "ruleId": "<uuid>",
      "entityId": "<uuid>",
      "metricValue": 3,
      "threshold": 0,
      "requestIds": ["0195e1a7-4f1c-7a05-b2d6-77c7e4d91c0a"]
    }
  }
}
```

**Webhook genérico (`channelType: 'webhook'`):**

```json
{
  "event": "alert.triggered",
  "alertRuleId": "<uuid>",
  "entityId":    "<uuid>",
  "name":        "Pricing error spike",
  "sli":         "pricing_error_rate",
  "severity":    "page",
  "triggeredAt": "2026-04-15T10:27:31Z",
  "metricValue": 0.018,
  "threshold":   0.005,
  "window":      "5m",
  "signature":   "sha256=<hmac of body with channelConfig.secret>"
}
```

### 4.3 · Tenancy middleware failure

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
x-request-id: 0195e1a7-4f1c-7a05-b2d6-77c7e4d91c0a

{
  "code": "tenancy_denied",
  "message": "User carlos@bank.es does not have access to entity 00000000-0000-0000-0000-000000000020",
  "requestId": "0195e1a7-4f1c-7a05-b2d6-77c7e4d91c0a"
}
```

### 4.4 · Snapshot replay — match

```http
POST /pricing/snapshots/7c94bf4a-.../replay
Authorization: Bearer …
x-entity-id: 00000000-0000-0000-0000-000000000010

HTTP/1.1 200 OK
x-engine-version: 9f12ac2

{
  "snapshotId": "7c94bf4a-...",
  "matches": true,
  "engineVersionOriginal": "8da95ed",
  "engineVersionNow":     "9f12ac2",
  "diff": []
}
```

### 4.5 · Snapshot replay — drift

```json
{
  "snapshotId": "7c94bf4a-...",
  "matches": false,
  "engineVersionOriginal": "8da95ed",
  "engineVersionNow":     "9f12ac2",
  "diff": [
    {
      "field": "output.capitalCharge",
      "original": 0.0017,
      "current":  0.0019,
      "deltaAbs": 0.0002,
      "deltaBps": 2.0
    },
    {
      "field": "output.finalClientRate",
      "original": 0.0402,
      "current":  0.0404,
      "deltaAbs": 0.0002,
      "deltaBps": 2.0
    }
  ]
}
```

---

## 5 · Matriz de rollout con flag `app.tenancy_strict`

| Fase | `app.tenancy_strict` | `get_current_entity_id()` comportamiento | Acción server |
|---|---|---|---|
| 0 · Deploy migrations | `off` | fallback a Default (compat) | Middleware opcional, log warning si falta |
| 1 · Warn-only (48 h) | `off` | fallback a Default | Middleware obligatorio, log ERROR + métrica `tenancy_missing_count` |
| 2 · Canary (1 tenant) | `on` para ese tenant | error si no seteado | Middleware enforced; observar 24h |
| 3 · Global enforce | `on` global | error si no seteado | Default Entity solo para seed fixtures |

El flag se setea por conexión: `SET LOCAL app.tenancy_strict = 'on'` dentro del middleware (o vía `ALTER DATABASE ... SET app.tenancy_strict` para global).

---

## 6 · Runbooks mínimos (stubs)

Crear en `docs/runbooks/`:

- `runbook-tenancy-violation.md` — qué hacer si alerta page `tenancy_violations_total > 0`.
- `runbook-error-rate.md` — qué hacer si alerta page `pricing_error_rate > 0.5%`.
- `runbook-snapshot-failure.md` — qué hacer si snapshots fallan al persistir.
- `runbook-mock-fallback.md` — qué hacer si un tenant empieza a usar mocks en producción.

Cada runbook contendrá: síntoma, causas probables, comandos de diagnóstico (`supabase logs`, `SELECT ... FROM tenancy_violations`), acción de mitigación, y criterio de resolución.

---

## 7 · Consideraciones de coste / riesgo

- **Snapshots JSONB comprimidos:** ~5‑20 KB por call. A 10M calls/año por tenant = ~100 GB/año. Archivable a storage frío cada trimestre para reducir I/O principal.
- **Materialised view refresh cada minuto:** operación barata en tablas indexadas, pero si el volumen de métricas crece > 10M rows/día conviene particionar `metrics` por fecha (TimescaleDB o `pg_partman`).
- **Hash de payload en Edge Function:** `crypto.subtle.digest('SHA-256', ...)` en Deno es nativo, < 1 ms para payloads típicos.
- **Breaking change de `get_current_entity_id()`:** único riesgo real. Mitigado por rollout gradual con flag (sección 5).

---

## 8 · Qué queda para Sprint 1 de implementación

Una vez aprobado este documento:

1. Aplicar las 6 migrations (orden listado en §1).
2. Implementar el middleware de tenancy.
3. Añadir request_id middleware y metrics instrumentation.
4. Implementar `pricing_snapshots` write path en Edge Function.
5. Tests de tenancy fuzz + reproducibilidad.
6. Deploy con `app.tenancy_strict = 'off'` (fase 0 del rollout).

El resto de piezas (replay endpoint, SLO Dashboard, worker de alertas, channels Slack/PagerDuty) caen en Sprint 2.
