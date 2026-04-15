# Phase 0 — Consolidación de base técnica (diseño detallado)

> **Objetivo:** cerrar deuda bloqueante antes de abrir Fase 1 (Customer 360) y Fase 2 (Channels & Bulk Ops).
> **Alcance:** tres bloques independientes que pueden ejecutarse en paralelo.
> **Formato:** diseño y schema. No incluye código de producción todavía — solo SQL de migraciones, tipos TypeScript, contratos de API y flujos.

---

## Bloque A · RLS Hardening end-to-end

### A.1 Problema actual

El modelo RLS moderno (`20260406000001_multi_entity.sql`) está bien pensado pero tiene **cuatro agujeros** que comprometen el aislamiento multi-tenant:

1. **`get_current_entity_id()` cae a Default Entity si nadie setea `app.current_entity_id`**
   ([migration L129-147](../supabase/migrations/20260406000001_multi_entity.sql)). El backend Node (Express + cliente Supabase) **no ejecuta** `SET app.current_entity_id = $1` antes de cada query, así que toda escritura desde el server va implícitamente a `00000000-...-010` (Default Entity).
2. **Policies DELETE no se crean** en el loop (solo read/insert/update, L195-219). Si algún día se usa `DELETE` desde cliente autenticado, Postgres lo bloquea por ausencia de policy — o lo deja pasar si hay una policy permisiva hereditaria. Ambos casos son ruido.
3. **Edge Functions (`pricing`, `realize-raroc`, `elasticity-recalibrate`) usan `service_role`** — que bypasea RLS — sin validar explícitamente que el usuario del JWT pertenece a la entidad del payload.
4. **Tres tablas viven fuera del modelo entity**: `system_config` (global), `greenium_rate_cards` (SELECT abierto), `yield_curve_history` / `notifications` (por diseño).

### A.2 Diseño del fix

#### A.2.1 Middleware de tenancy en el server Node (pieza central)

**Archivo nuevo:** `server/middleware/tenancy.ts` (diseño):

```ts
// Firma
export function tenancyMiddleware(): RequestHandler
// Comportamiento:
// 1. Extrae `entity_id` del request (header `x-entity-id`, query param, o body).
// 2. Lee JWT del header `Authorization`. Extrae email.
// 3. Verifica en `entity_users` que (email, entity_id) existe y role ≠ null.
//    Si no existe → 403 TENANCY_DENIED.
// 4. Obtiene conexión Postgres de pool y ejecuta:
//       SET LOCAL app.current_entity_id = $1
//       SET LOCAL app.current_user_email = $2
//       SET LOCAL app.current_user_role = $3
//    dentro de una transacción BEGIN ... COMMIT envolviendo el handler.
// 5. Adjunta `req.tenancy = { entityId, userEmail, role }` para downstream.
```

**Por qué `SET LOCAL`:** se resetea automáticamente al final de la transacción, evita leaks entre requests que reutilizan conexión del pool.

**Helper Postgres nuevo** (migration `20260501000002_tenancy_helpers.sql`):

```sql
-- Ahora también deja de caer a Default Entity: null = deny.
CREATE OR REPLACE FUNCTION get_current_entity_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE raw TEXT;
BEGIN
  raw := current_setting('app.current_entity_id', true);
  IF raw IS NULL OR raw = '' THEN
    RAISE EXCEPTION 'tenancy_not_set' USING ERRCODE = '42501';
  END IF;
  RETURN raw::UUID;
END;
$$;
```

> Cambio semántico: ausencia de tenancy → **error**, no default. Rompe cualquier ruta que olvide pasar por el middleware. Es la decisión correcta para SaaS multi-banco.

#### A.2.2 Completar DELETE policies

**Migration:** `20260501000003_rls_delete_policies.sql`

```sql
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clients','products','business_units','deals','rules','users',
    'behavioural_models','yield_curves','rate_cards','liquidity_curves',
    'esg_transition_grid','esg_physical_grid','pricing_results'
  ])
  LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %I ON %I$f$,
      tbl || '_entity_delete', tbl);
    EXECUTE format($f$
      CREATE POLICY %I ON %I
        FOR DELETE TO authenticated
        USING (
          entity_id = get_current_entity_id()
          AND current_setting('app.current_user_role', true) IN ('Admin')
        )
    $f$, tbl || '_entity_delete', tbl);
  END LOOP;
END $$;

-- audit_log: NUNCA se borra (append-only)
-- No creamos DELETE policy → Postgres bloquea por defecto.
```

#### A.2.3 Validación de tenancy en Edge Functions

**Patrón a aplicar** a `supabase/functions/pricing/index.ts`, `realize-raroc`, `elasticity-recalibrate`:

```ts
// Al inicio de cada handler, antes de usar service role client:
async function assertTenancy(req: Request, entityIdInPayload: string) {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } }
  });
  const { data: user } = await authClient.auth.getUser();
  if (!user) throw new HttpError(401, 'unauthenticated');

  // Usa cliente AUTENTICADO (no service role) para comprobar acceso.
  // RLS de entity_users filtra automáticamente.
  const { data, error } = await authClient
    .from('entity_users')
    .select('role')
    .eq('user_id', user.email)
    .eq('entity_id', entityIdInPayload)
    .single();

  if (error || !data) throw new HttpError(403, 'tenancy_denied');
  return { email: user.email, role: data.role };
}
```

Una vez validado, **se sigue usando `service_role` para las escrituras** (necesario porque el motor de pricing persiste resultados y audit). La diferencia es que la comprobación de tenancy ha ocurrido explícitamente.

#### A.2.4 Decisión por tabla "fuera del modelo"

| Tabla | Decisión | Justificación |
|---|---|---|
| `system_config` | Dejar global, SELECT amplio, WRITE solo Admin SaaS (nuevo rol) | Configuración producto, no por-banco |
| `greenium_rate_cards` | Añadir `entity_id` + policies entity-scoped | Rate card puede ser específica por banco |
| `yield_curve_history` | Dejar global lectura; WRITE solo service role | Curvas de mercado son datos de referencia compartidos |
| `notifications` | Dejar sin entity; policy por `user_id` | Mensajes personales, no del banco |

### A.3 Verificación

**Test suite nuevo** `server/__tests__/tenancy.spec.ts`:

1. Request sin `x-entity-id` → 400.
2. Request con `x-entity-id` válido pero usuario no pertenece → 403.
3. Request con `x-entity-id` ≠ `entity_id` del deal devuelto → RLS oculta el deal (SELECT) o rechaza (INSERT).
4. Fuzz: 100 requests concurrentes alternando entidad A y B → 0 cross-reads.
5. `DELETE /deals/:id` sin rol Admin → 403.
6. Edge Function `POST /pricing` con deal de entidad ajena → 403 antes de ejecutar pricing.

**Monitoring post-deploy:**

- Nueva métrica `tenancy_violations_total` (contador). SLO: **= 0**.
- Alert inmediato si > 0 en ventana de 1 minuto → Slack + PagerDuty.

### A.4 Lista de archivos a modificar

| Acción | Archivo |
|---|---|
| Crear | `server/middleware/tenancy.ts` |
| Crear | `supabase/migrations/20260501000002_tenancy_helpers.sql` |
| Crear | `supabase/migrations/20260501000003_rls_delete_policies.sql` |
| Crear | `supabase/migrations/20260501000004_greenium_entity_scope.sql` |
| Modificar | `supabase/functions/pricing/index.ts` (validación tenancy) |
| Modificar | `supabase/functions/realize-raroc/index.ts` |
| Modificar | `supabase/functions/elasticity-recalibrate/index.ts` |
| Modificar | `server/index.ts` (registrar middleware) |
| Crear | `server/__tests__/tenancy.spec.ts` |

---

## Bloque B · Reproducibilidad con snapshots

### B.1 Problema actual

`pricing_results.source_ref` guarda **referencias** (curveId, ruleId, etc.) pero no el **payload completo**:

- Las curvas se actualizan con nuevos snapshots diarios → `curveId` vuelve a apuntar a puntos distintos al original.
- Las reglas se versionan pero la Edge Function siempre usa la activa (no hay concepto "as-of").
- Configuraciones efímeras (`rateCards`, `transitionGrid`, `physicalGrid`, `behaviouralModels`, `sdrConfig`, `lrConfig`) **caen a mock** si faltan — es decir, un deal pricing-eado en `T0` con mock data **ya no se puede reproducir** si luego se cargaron datos reales.

Consecuencia: **un deal aprobado y ejecutado en marzo no se puede re-calcular hoy con garantía de mismo resultado**. Para auditoría regulatoria (SR 11‑7, EBA model risk) esto es un rojo.

### B.2 Diseño

#### B.2.1 Schema de snapshot

**Migration nueva:** `20260501000005_pricing_snapshots.sql`

```sql
CREATE TABLE IF NOT EXISTS pricing_snapshots (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID      NOT NULL REFERENCES entities(id),
  deal_id           UUID      REFERENCES deals(id),          -- nullable: puede ser pricing exploratorio
  pricing_result_id UUID      REFERENCES pricing_results(id),
  request_id        TEXT      NOT NULL,                      -- UUIDv7 de la request que lo generó
  engine_version    TEXT      NOT NULL,                      -- git sha del motor en ese momento
  as_of_date        DATE      NOT NULL,                      -- fecha de mercado efectiva

  -- Snapshot de entrada — TODO lo que consume calculatePricing()
  input             JSONB     NOT NULL,  -- { deal, approvalMatrix, shocks }
  context           JSONB     NOT NULL,  -- { curves:{...}, rules:[...], rateCards:[...],
                                         --   transitionGrid:{...}, physicalGrid:{...},
                                         --   behaviouralModels:[...], sdrConfig, lrConfig,
                                         --   clients:[...], products:[...], businessUnits:[...] }

  -- Resultado
  output            JSONB     NOT NULL,  -- FTPResult completo

  -- Hashes para detección de drift e inmutabilidad
  input_hash        TEXT      NOT NULL,  -- sha256(canonicalJson(input + context))
  output_hash       TEXT      NOT NULL,  -- sha256(canonicalJson(output))

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Inmutabilidad: nunca UPDATE ni DELETE
ALTER TABLE pricing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_snapshots_read ON pricing_snapshots
  FOR SELECT TO authenticated
  USING (entity_id = ANY(get_accessible_entity_ids()));

CREATE POLICY pricing_snapshots_insert ON pricing_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (entity_id = get_current_entity_id());

-- No policies UPDATE/DELETE → bloqueado por default.

CREATE INDEX idx_snap_deal   ON pricing_snapshots(deal_id, created_at DESC);
CREATE INDEX idx_snap_result ON pricing_snapshots(pricing_result_id);
CREATE INDEX idx_snap_req    ON pricing_snapshots(request_id);
```

**Tamaño estimado:** ~5‑20 KB por snapshot (JSON comprimido por Postgres). A 100k deals/mes ≈ 1‑2 GB/mes por tenant. Aceptable.

**Retención:**
- 10 años para snapshots con `deal_id NOT NULL` y deal approved (norma de auditoría bancaria).
- 90 días para snapshots exploratorios (`deal_id IS NULL`).
- Job de limpieza semanal: `scripts/cleanup-snapshots.ts`.

#### B.2.2 Flujo de escritura

Modificar `calculatePricing()` y el Edge Function:

```
Edge Function POST /pricing
  1. Valida tenancy (Bloque A)
  2. Carga context completo (curves, rules, rate cards, …)
  3. Si algún bloque cae a mock → marca `context._usedMockFor: [...]`
     y devuelve warning en la respuesta.
  4. Ejecuta calculatePricing(input, context)
  5. Computa input_hash + output_hash
  6. INSERT en pricing_snapshots (siempre, no solo para deals aprobados)
  7. Devuelve FTPResult + snapshot_id en response header `x-snapshot-id`
```

**Canonical JSON:** usar [json-stable-stringify](https://www.npmjs.com/package/json-stable-stringify) o implementación propia (`utils/canonicalJson.ts`) — ordenar keys, normalizar números, quitar undefined.

#### B.2.3 Replay endpoint

**Contrato nuevo** (versionar `docs/api-spec.yaml` → v2):

```
GET  /pricing/snapshots/:id            → devuelve snapshot completo
POST /pricing/snapshots/:id/replay     → reejecuta motor con ese input/context
                                         → compara output vs output original
                                         → devuelve { matches: bool, diff: {...} }
```

Esto es la prueba de reproducibilidad: si el motor cambió (nueva versión regulatoria), `matches=false` señala qué componente drifteó.

#### B.2.4 Eliminar mocks del Edge Function

Los fallbacks a mock data en `supabase/functions/pricing/index.ts:376-380` (rateCards, transitionGrid, physicalGrid, behaviouralModels, sdrConfig, lrConfig) **se eliminan en producción**. En vez:

- Si tenant no ha configurado ese bloque → `400 CONFIGURATION_INCOMPLETE` con `missing: ["rateCards", "transitionGrid"]`.
- Modo desarrollo: flag `?allowMocks=true` (solo acepta desde localhost o entorno dev).

### B.3 Verificación

**Test nuevo** `utils/__tests__/pricingReproducibility.spec.ts`:

1. Crea 10 deals con pricing real.
2. Para cada uno: toma snapshot_id, ejecuta replay, afirma `matches === true`.
3. Provoca drift: cambia una regla → ejecuta replay de snapshot viejo → afirma que el snapshot devuelve el output viejo (NO el nuevo).
4. Property test: 100 deals aleatorios, snapshot + replay, 100% match.

**E2E nuevo** `e2e/pricing-reproducibility.spec.ts`:

1. Calcula pricing para un deal en UI.
2. Lee `x-snapshot-id` del response.
3. Navega a `/admin/snapshots/:id` → verifica que muestra input completo + output + input_hash.
4. Click "Replay" → verifica badge "Reproducible ✓".

### B.4 Archivos

| Acción | Archivo |
|---|---|
| Crear | `supabase/migrations/20260501000005_pricing_snapshots.sql` |
| Crear | `utils/canonicalJson.ts` |
| Modificar | `supabase/functions/pricing/index.ts` (quitar mocks, escribir snapshot) |
| Modificar | `utils/pricingEngine.ts` (aceptar context completo, no cargar por su cuenta) |
| Crear | `api/snapshots.ts` (GET, POST /replay) |
| Crear | `components/Admin/SnapshotViewer.tsx` |
| Crear | `utils/__tests__/pricingReproducibility.spec.ts` |
| Crear | `e2e/pricing-reproducibility.spec.ts` |
| Crear | `scripts/cleanup-snapshots.ts` |

---

## Bloque C · SLO/SLI formales y alertas

### C.1 Problema actual

- La tabla `metrics` captura `pricing_latency_ms`, `deal_volume`, `error_count` (migration `20260406000005_observability.sql:2-9`).
- `/observability/summary` expone p50/p95 24h.
- `alert_rules` soporta operadores simples (`gt`, `lt`, `gte`, `lte`, `eq`) con **recipients solo email**.

Faltan: request_id correlacional, P99, distributed tracing, SLI de tenancy leakage, fallback-to-mock rate, y targets Slack/PagerDuty/webhook.

### C.2 Catálogo de SLIs

| SLI | Descripción | Cómo se mide |
|---|---|---|
| `pricing_single_latency_ms` | Duración de `POST /pricing` | Timer Edge Function, percentiles |
| `pricing_batch_latency_ms_per_deal` | Duración por deal en `/pricing/batch` | `duration / deals.length` |
| `pricing_error_rate` | % respuestas 5xx | count(5xx) / count(total), ventana 5 min |
| `tenancy_violations_total` | Contador de fallos de tenancy (403 `tenancy_denied` + queries RLS bloqueadas) | Hooks en middleware |
| `mock_fallback_rate` | % pricing calls que usaron mock data | Edge Function incrementa contador si `context._usedMockFor.length > 0` |
| `snapshot_write_failures_total` | Snapshots que fallaron al persistir | Edge Function log |
| `auth_failures_total` | 401/403 por endpoint | Middleware |
| `cold_start_duration_ms` | Duración de cold start de Edge Function | Deno runtime event |

### C.3 SLOs propuestos (valores iniciales a calibrar)

| Endpoint / SLI | Objetivo | Ventana | Acción al fallar |
|---|---|---|---|
| `/pricing` p95 | < 300 ms | rolling 1h | warning |
| `/pricing` p99 | < 800 ms | rolling 1h | warning |
| `/pricing/batch` p95 / deal | < 50 ms | rolling 1h | warning |
| `pricing_error_rate` | < 0.5% | rolling 5 min | page |
| `tenancy_violations_total` | = 0 | instantáneo | **page inmediato** |
| `mock_fallback_rate` | < 5% | rolling 1h | warning |
| `snapshot_write_failures_total` | = 0 | rolling 5 min | page |
| Availability `/pricing` | ≥ 99.9% | rolling 30d | review trimestral |

> Nota: estos son iniciales. Hay que recopilar 2 semanas de métricas reales y recalibrar.

### C.4 Implementación técnica

#### C.4.1 Request correlation

- Cada request entra con header `x-request-id` (si no viene, el server lo genera como UUIDv7).
- Se propaga a todos los logs y a la tabla `metrics.dimensions`.
- Se devuelve en response header para que cliente pueda referenciarlo.

#### C.4.2 Extensión del schema de métricas

**Migration** `20260501000006_slo_metrics.sql`:

```sql
-- Vista materializada con agregados por endpoint y minuto
CREATE MATERIALIZED VIEW pricing_slo_minute AS
SELECT
  entity_id,
  date_trunc('minute', recorded_at) AS bucket,
  (dimensions->>'endpoint')         AS endpoint,
  count(*)                          AS n_requests,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY metric_value) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY metric_value) AS p95,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY metric_value) AS p99,
  avg(metric_value)                 AS avg_ms,
  max(metric_value)                 AS max_ms
FROM metrics
WHERE metric_name LIKE 'pricing_%_latency_ms'
GROUP BY entity_id, bucket, endpoint;

CREATE UNIQUE INDEX idx_pricing_slo_minute_pk
  ON pricing_slo_minute (entity_id, bucket, endpoint);

-- Refresh job cada 1 min (pg_cron)
SELECT cron.schedule('refresh-slo-minute', '* * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY pricing_slo_minute');
```

**Nueva tabla** `error_budget`:

```sql
CREATE TABLE error_budget (
  entity_id    UUID NOT NULL REFERENCES entities(id),
  slo_name     TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  budget_total NUMERIC NOT NULL,      -- Ej: 0.1% de requests
  budget_used  NUMERIC DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_id, slo_name, period_start)
);
```

#### C.4.3 Extensión de `alert_rules`

**Migration** `20260501000007_alert_channels.sql`:

```sql
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS channel_type TEXT
    NOT NULL DEFAULT 'email'
    CHECK (channel_type IN ('email','slack','pagerduty','webhook','opsgenie'));

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS channel_config JSONB DEFAULT '{}';
-- slack: { webhook_url, channel }
-- pagerduty: { routing_key, severity }
-- webhook: { url, method, headers, secret }
-- opsgenie: { api_key, team }

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS severity TEXT
    NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info','warning','page','critical'));

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS window_seconds INTEGER DEFAULT 60;
-- Tiempo durante el cual evaluar la condición antes de disparar.

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER DEFAULT 300;
-- Tiempo mínimo entre disparos consecutivos.
```

#### C.4.4 Worker de evaluación de alertas

**Archivo nuevo:** `server/workers/alertEvaluator.ts`

- Cron cada 30s.
- Query `alert_rules` activas → evalúa cada una contra `pricing_slo_minute` y `metrics`.
- Si triggers & respeta cooldown → envía notificación al canal configurado.
- Actualiza `last_triggered_at`.
- Logs cada evaluación en `audit_log`.

#### C.4.5 Distributed tracing (opcional, Fase 0.5)

- OpenTelemetry SDK en Edge Function + server Node.
- Exporter a Grafana Tempo self-hosted o Honeycomb (si se contrata).
- Trace context propagado via `traceparent` header.

### C.5 Dashboard inicial

**UI nueva** `components/Admin/SLODashboard.tsx` consumiendo `/observability/slo-summary`:

- Tarjetas con p50/p95/p99 actuales de cada endpoint, color por SLO cumplido / en riesgo / fallando.
- Gráfico de evolución 24h para cada SLI.
- Lista de alerts activas con severity chip.
- Estado de error budget del mes.

### C.6 Verificación

**Test nuevo** `server/__tests__/alertEvaluator.spec.ts`:

1. Seed 100 métricas `pricing_latency_ms` con p95 > threshold → disparar alerta.
2. Verificar que respeta cooldown: segundo disparo < cooldown no envía.
3. Test por canal: email mock, slack mock, pagerduty mock reciben payload correcto.
4. Regresión SLO: endpoint calcula correctamente p95 con datos sintéticos.

**Load test:** `scripts/loadTestPricing.ts` usando [k6](https://k6.io) — 100 RPS durante 10 min a `/pricing` y `/pricing/batch`, asserts p95 < 300 ms y error rate < 0.5%.

### C.7 Archivos

| Acción | Archivo |
|---|---|
| Crear | `supabase/migrations/20260501000006_slo_metrics.sql` |
| Crear | `supabase/migrations/20260501000007_alert_channels.sql` |
| Crear | `server/middleware/requestId.ts` |
| Modificar | `utils/metrics.ts` (emitir por endpoint + request_id) |
| Modificar | `supabase/functions/pricing/index.ts` (timer + error capture + dimensions) |
| Crear | `server/workers/alertEvaluator.ts` |
| Crear | `server/integrations/slack.ts` |
| Crear | `server/integrations/pagerduty.ts` |
| Crear | `server/integrations/webhook.ts` |
| Crear | `api/slo.ts` (endpoint `/observability/slo-summary`) |
| Crear | `components/Admin/SLODashboard.tsx` |
| Crear | `server/__tests__/alertEvaluator.spec.ts` |
| Crear | `scripts/loadTestPricing.ts` |

---

## Secuenciación recomendada (2 sprints)

### Sprint 1 (semana 1‑2)

- A.2.1 Middleware de tenancy + helper PG estricto
- A.2.2 DELETE policies
- A.2.4 Greenium → entity scope
- B.2.1 Schema `pricing_snapshots`
- C.4.1 Request ID en server y Edge Function
- C.4.2 Schema de error budget y vista materializada

### Sprint 2 (semana 3‑4)

- A.2.3 Tenancy validation en Edge Functions
- B.2.2 Escritura de snapshots en Edge Function
- B.2.3 Replay endpoint
- B.2.4 Eliminar mocks (flag dev-only)
- C.4.3 Extensión alert_rules + canales
- C.4.4 Worker de evaluación
- C.5 SLO Dashboard
- Verificación end-to-end + load test

Entre ambos sprints: **freeze de features no relacionados** para evitar ruido en el rollout.

---

## Criterios de "hecho" para cerrar Fase 0

- [ ] `npm run verify:full` pasa con nuevas migrations y tests.
- [ ] `scripts/loadTestPricing.ts` corre 10 min sin violar SLOs.
- [ ] `e2e/pricing-reproducibility.spec.ts` verde.
- [ ] Fuzz tenancy (100 requests concurrentes) arroja 0 cross-reads.
- [ ] SLODashboard muestra datos reales post-deploy.
- [ ] Documento `docs/rls-audit-2026-05.md` firmado con resultado "clean".
- [ ] Runbook de respuesta a alertas en `docs/runbook-slo.md`.

---

## Decisiones abiertas (bloqueantes o no)

1. **Targets de alerta:** ¿Qué canales priorizamos en sprint 2 — Slack + email, o también PagerDuty desde día 1? *(Recomendación: Slack + email; PagerDuty cuando haya primer tenant productivo.)*
2. **Retención de snapshots:** 10 años es cómodo pero caro. ¿Confirmamos que el coste de almacenamiento JSONB comprimido es asumible para los volúmenes previstos? *(Se mitiga con glacier/archivo frío trimestralmente.)*
3. **OpenTelemetry:** ¿Entra en Fase 0 o se aplaza a Fase 5 (SaaS hardening)? *(Recomendación: aplazar; el logging estructurado + metrics cubre 90% del valor.)*
4. **Compatibilidad hacia atrás:** al cambiar `get_current_entity_id()` para que no caiga a Default, hay que migrar **todos** los callers simultáneamente o habrá downtime breve. ¿Preparamos un modo "warn-only" durante 48h antes de activar el error? *(Recomendación: sí, flag `app.tenancy_strict` con rollout gradual.)*
