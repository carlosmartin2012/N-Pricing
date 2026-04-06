# N-Pricing: State-of-the-Art Multi-Entity SaaS Design

> Spec de evolución de N-Pricing de herramienta single-tenant a plataforma FTP SaaS comercial multi-entidad para instituciones financieras.

## Context

N-Pricing es un motor FTP maduro (7/10 global) con excelente governance (9/10) y motor de pricing completo (16 gaps). Para convertirse en producto comercial NFQ necesita: multi-entidad, colaboración real-time, seguridad enterprise y operaciones de producción bancaria.

**Decisiones tomadas:**
- Modelo: Grupo → Entidad → BU (soporta tanto un banco con varias BUs como grupo bancario con entidades vinculadas)
- Aislamiento: Shared Database + Row-Level Security (aprovecha migración existente `20240501000002_multi_tenant.sql`)
- Visibilidad: Cross-entidad total — Group Admins ven todas las entidades, Entity users ven solo la suya
- Target: SaaS comercial para clientes bancarios de NFQ

## Current State Assessment

| Área | Hoy | Target | Fase |
|------|-----|--------|------|
| Multi-tenancy | 6/10 | 10/10 | 1 |
| Real-time collaboration | 5/10 | 9/10 | 2 |
| Auth & Security | 8/10 | 10/10 | 2 |
| Data layer | 8/10 | 10/10 | 4 |
| Governance | 9/10 | 10/10 | — |
| Enterprise ops | 3/10 | 9/10 | 3 |
| Observability | 8/10 | 10/10 | 3 |
| Accessibility | 6/10 | 9/10 | 4 |
| PWA / Offline | 7/10 | 9/10 | 4 |

---

## Fase 1: Multi-Entidad & Fundación SaaS

### 1.1 Schema changes

Nueva migración `20260406000001_multi_entity.sql`:

```sql
-- Nivel holding / grupo financiero
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  base_currency TEXT DEFAULT 'EUR',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entidad legal (banco, filial) — renombrado desde "tenants" de la migración existente
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  name TEXT NOT NULL,
  legal_name TEXT,
  country TEXT NOT NULL,
  base_currency TEXT DEFAULT 'EUR',
  timezone TEXT DEFAULT 'Europe/Madrid',
  approval_matrix JSONB DEFAULT '{}',
  sdr_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: usuario ↔ entidad (con rol por entidad)
CREATE TABLE entity_users (
  entity_id UUID REFERENCES entities(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('Admin','Trader','Risk_Manager','Auditor')),
  default_bu_id UUID,
  is_primary_entity BOOLEAN DEFAULT false,
  PRIMARY KEY (entity_id, user_id)
);

-- entity_id en TODAS las tablas de negocio
ALTER TABLE deals ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE rules ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE yield_curves ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE liquidity_curves ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE clients ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE products ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE business_units ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE audit_log ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE pricing_results ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE behavioural_models ADD COLUMN entity_id UUID REFERENCES entities(id);
ALTER TABLE esg_grids ADD COLUMN entity_id UUID REFERENCES entities(id);

-- Helper: entidad activa del usuario (set via app.current_entity_id)
CREATE FUNCTION get_current_entity_id() RETURNS UUID AS $$
  SELECT (current_setting('app.current_entity_id', true))::UUID;
$$ LANGUAGE sql STABLE;

-- Helper: todas las entidades accesibles por el usuario
CREATE FUNCTION get_accessible_entity_ids() RETURNS UUID[] AS $$
  SELECT array_agg(entity_id)
  FROM entity_users WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- RLS: lectura = entidades accesibles, escritura = entidad activa
-- Patrón aplicado a: deals, rules, yield_curves, liquidity_curves,
-- clients, products, business_units, audit_log, pricing_results,
-- behavioural_models, esg_grids
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_entity_read ON deals FOR SELECT
  USING (entity_id = ANY(get_accessible_entity_ids()));
CREATE POLICY deals_entity_write ON deals FOR INSERT
  WITH CHECK (entity_id = get_current_entity_id());
CREATE POLICY deals_entity_update ON deals FOR UPDATE
  USING (entity_id = get_current_entity_id());
-- (mismo patrón para todas las tablas de negocio)
```

**Composición de RLS policies**: Las nuevas policies de entidad se **acumulan** con las existentes de rol. Un usuario necesita:
1. Acceso a la entidad (vía `entity_users`) — filtrado por `get_accessible_entity_ids()`
2. Permiso de rol (vía `get_user_role()`) — policies existentes de Admin/Trader/Risk_Manager/Auditor

Ambas condiciones deben cumplirse. Esto se logra con AND implícito en PostgreSQL RLS (múltiples policies en la misma tabla se combinan con OR para PERMISSIVE, pero las RESTRICTIVE se combinan con AND). Las policies de entidad deben ser RESTRICTIVE.

**Datos compartidos a nivel grupo** (sin entity_id, accesibles por todas las entidades):
- Tablas regulatorias (LCR outflow, NSFR factors) — son estándar Basel III
- Market data de fuentes públicas (curvas base: SOFR, ESTR)
- Catálogo de productos base
- Templates de reglas

**Datos aislados por entidad** (con entity_id):
- Deals, pricing results, clients
- Reglas de pricing, liquidity curves propias, ESG grids
- Audit log, approval matrix, governance config
- Behavioural models

### 1.2 Tipos TypeScript

Nuevos tipos en `types.ts`:

```typescript
interface Group {
  id: string;
  name: string;
  country: string;
  baseCurrency: string;
  config: Record<string, unknown>;
}

interface Entity {
  id: string;
  groupId: string;
  name: string;
  legalName: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  approvalMatrix: ApprovalMatrixConfig;
  sdrConfig: SDRConfig;
  isActive: boolean;
}

interface EntityUser {
  entityId: string;
  userId: string;
  role: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';
  defaultBuId?: string;
  isPrimaryEntity: boolean;
}
```

Extensiones a tipos existentes:
- `UserProfile` += `entities: EntityUser[]`, `activeEntityId: string`, `groupId?: string`, `isGroupAdmin: boolean`
- `Transaction` += `entityId: string`
- Todos los tipos con persistencia += `entityId: string`

### 1.3 EntityContext.tsx

Nuevo contexto en `contexts/EntityContext.tsx`:

```
EntityContext
├── activeEntity: Entity
├── availableEntities: Entity[]
├── group: Group | null
├── isGroupScope: boolean
├── switchEntity(id: string): void    // invalida React Query caches, re-hidrata
├── setGroupScope(enabled: boolean): void
└── entityConfig: { approvalMatrix, sdrConfig, ... }
```

Se inyecta como provider en `App.tsx` entre AuthContext y DataContext. DataContext consume `activeEntity.id` para todas las queries.

### 1.4 API layer: entity scoping automático

Nuevo middleware en `api/shared.ts`:

```typescript
function withEntityScope<T>(query: SupabaseQuery<T>): SupabaseQuery<T> {
  const entityId = getActiveEntityId();
  return query.eq('entity_id', entityId);
}
```

Todas las funciones en `api/deals.ts`, `api/config.ts`, `api/marketData.ts` usan `withEntityScope()` por defecto. Para Group Admins en vista consolidada, las queries omiten el filtro y dejan que RLS filtre por `get_accessible_entity_ids()`.

Nuevo archivo `api/entities.ts`: CRUD de groups, entities, entity_users.

### 1.5 UI: Entity Switcher

Componente `EntitySwitcher.tsx` en `components/ui/`:
- Dropdown en el Header, solo visible si `availableEntities.length > 1`
- Muestra nombre + badge con iniciales/color de la entidad activa
- Group Admins ven opción "Vista Grupo (consolidada)" que activa `isGroupScope`
- Al cambiar entidad: `queryClient.invalidateQueries()` + re-set de `app.current_entity_id` en Supabase

### 1.6 Dashboard consolidado

Cuando `isGroupScope = true` en ReportingDashboard:
- KPIs se agregan cross-entidad
- Tablas muestran columna "Entidad" extra con badge de color
- Charts permiten filtro/comparativa por entidad (multi-select chips)
- Click en entidad → `switchEntity(id)` → drill-down

### 1.7 Onboarding wizard

Nuevo componente `EntityOnboarding.tsx` (vista en Admin):
- Step 1: Nombre, país, divisa base, legal name
- Step 2: Importar config desde grupo template o entidad existente (curvas, reglas)
- Step 3: Asignar usuarios iniciales + roles
- Step 4: Review + crear entidad
- Genera seed data por defecto (clientes demo, productos base, BUs iniciales)

### 1.8 Migraciones de datos existentes

Para datos existentes sin `entity_id`:
- Crear entidad "Default" en grupo "Default"
- `UPDATE deals SET entity_id = (SELECT id FROM entities WHERE name = 'Default') WHERE entity_id IS NULL`
- Mismo para todas las tablas
- Añadir `NOT NULL` constraint después de migrar datos existentes

---

## Fase 2: Colaboración Real-Time & Seguridad

### 2.1 Presencia de usuarios

Extiende `hooks/supabaseSync/usePresenceAndSessionAudit.ts`:

- Canal por entidad: `presence:entity:{entityId}`
- Payload: `{ userId, name, avatar, activeView, activeDealId, lastSeen }`
- Nuevo componente `PresenceAvatars.tsx` en Header: avatares circulares de usuarios online
- Badge en BlotterTable rows: "María está viendo este deal"
- Nuevo hook `useFieldPresence(dealId, fieldName)`: retorna si otro usuario tiene ese campo en foco
- Campo con borde naranja + tooltip "Editando por [nombre]" si otro usuario lo tiene activo

### 2.2 Detección de conflictos

- Columna `version INT DEFAULT 1` en deals, rules, yield_curves
- `UPDATE ... WHERE id = $1 AND version = $2` → `SET version = version + 1`
- Si `affected_rows = 0` → conflicto detectado
- Nuevo componente `ConflictModal.tsx`: diff visual campo por campo
- Opciones: "Usar mi versión" / "Usar versión del servidor" / "Cancelar"
- `api/deals.ts`: `updateDeal()` recibe `expectedVersion`, check atómico, fetch actual si falla

### 2.3 Seguridad avanzada

| Feature | Implementación | Esfuerzo |
|---------|---------------|----------|
| MFA/TOTP | `supabase.auth.mfa.enroll()` — nativo | Bajo |
| SAML SSO | Supabase Enterprise plan — config en dashboard | Config |
| Session binding | Fingerprint en `raw_user_meta_data` + check en login | Medio |
| Rate limiting | Supabase Auth rate limits nativos + UI de lockout | Bajo |
| Logout everywhere | `supabase.auth.admin.signOut(userId, 'global')` | Bajo |

MFA flow: Settings → "Activar 2FA" → QR code TOTP → verificar código → activado. En login, si MFA activo: email+pass → código TOTP → sesión.

### 2.4 Data masking

Vista SQL con masking automático por rol:

```sql
CREATE VIEW deals_masked AS
SELECT id, entity_id, status, product, currency,
  CASE WHEN get_user_role() IN ('Admin','Risk_Manager','Trader')
    THEN amount ELSE round(amount, -3) END AS amount,
  CASE WHEN get_user_role() IN ('Admin','Risk_Manager')
    THEN client_id ELSE '***masked***' END AS client_id
FROM deals;
```

`api/deals.ts` usa `deals_masked` por defecto. Componentes no necesitan lógica de masking — transparente.

---

## Fase 3: Operaciones Enterprise

### 3.1 Report scheduling

- Tabla `report_schedules`: `entity_id, report_type, frequency (cron), recipients[], format (pdf|xlsx|csv), is_active`
- Supabase Edge Function `scheduled-reports`: ejecuta en cron, genera reporte, envía por email (Resend/SendGrid)
- UI: Tab "Report Scheduling" en MethodologyConfig con CRUD de schedules, preview del próximo envío
- Reportes generables: Portfolio summary, LCR/NSFR, RAROC breakdown, Maturity ladder, NII sensitivity

### 3.2 Export regulatorio

Nuevo módulo `utils/regulatoryExport.ts`:
- `generateCOREP_LCR(entityId, date)`: XML conforme a esquemas EBA
- `generateCOREP_NSFR(entityId, date)`: XML conforme a esquemas EBA
- `generateIRRBB_Report(entityId, date, scenarios[])`: Excel con formato EBA GL 2018/02
- Templates en `constants/regulatory-templates/`
- UI: Botón "Export Regulatorio" en ReportingDashboard con selector de formato y fecha de referencia

### 3.3 Backup & data lineage

**Backup:**
- Supabase Pro incluye backups automáticos diarios (point-in-time recovery)
- Export manual por entidad: Edge Function genera JSON snapshot de toda la data de una entidad
- UI: Admin panel con historial de snapshots y botón restore
- Restore: import snapshot con validación de integridad + dry-run mode

**Data lineage:**
- Columna `source_ref JSONB` en `pricing_results`: `{ curveId, curveDate, ruleId, ruleVersion, modelId }`
- UI: click en cualquier precio → drawer "Pricing Lineage" con trazabilidad completa
- Cadena: curva de mercado → regla aplicada → modelo conductual → pricing → deal → aprobación

### 3.4 Observabilidad & alertas

Nuevo `utils/metrics.ts`:
- `trackPricingLatency(dealId, durationMs)`
- `trackDealVolume(entityId, count)`
- `trackErrorRate(module, count)`
- Buffer + flush cada 60s a tabla `metrics`
- UI: `HealthDashboard.tsx` en Admin (solo Group/Entity Admin): latencia P50/P95, error rate, deal volume

**Alertas:**
- Tabla `alert_rules`: `entity_id, metric, operator, threshold, recipients[], is_active`
- Edge Function cron (cada 5 min): evalúa reglas contra métricas recientes
- Notificación vía tabla `notifications` + email
- Ejemplos: "FTP spread medio > 500bps", "Error rate > 5%", "Pricing latency P95 > 2s"

---

## Fase 4: Polish & Diferenciación

### 4.1 Offline-first robusto

- `utils/offlineStore.ts` con `idb-keyval` (~1KB): IndexedDB para deals_draft y pending_mutations
- Al crear/editar deal offline → guarda en IndexedDB + cola de mutaciones
- Al reconectar → `processMutationQueue()`: POST cada mutación, conflict resolution si version mismatch
- Service Worker: `BackgroundSyncManager.register('sync-deals')`
- UI: badge "3 cambios pendientes" en Header cuando offline

### 4.2 Accesibilidad WCAG AA

Checklist por componente:
- Todos los `<input>` con `<label>` asociado (htmlFor)
- Todos los `<button>` con texto visible o `aria-label`
- Modales: focus trap + Escape to close + return focus on close
- Tables: `scope="col|row"`, `aria-sort` en columnas ordenables
- Live regions: `aria-live="polite"` para precios calculados en tiempo real
- Skip navigation link en el top del layout
- Color contrast ratio ≥ 4.5:1 (verificar con axe-core)
- E2E: añadir `@axe-core/playwright` a specs existentes para validación automática

### 4.3 AI avanzada

Extensiones al módulo Intelligence/:
- **Pricing suggestions**: deals similares por features → nearest neighbors en histórico → "Deals similares tuvieron spread medio de X"
- **Anomaly detection**: desviación > 2σ en curvas de mercado → alerta automática en MarketData
- **NL queries**: "¿Cuál es el LP medio de hipotecas EUR este mes?" → Gemini function calling con context de cartera
- **Risk auto-classification**: auto-tag de deals por risk tier basado en features (ML ligero o Gemini classification)

### 4.4 Performance at scale

**Cursor pagination** (reemplazar offset en api/deals.ts):
```
listDeals(cursor?: string, limit: number)
cursor = base64(created_at + id) del último item
WHERE (created_at, id) > (cursor_ts, cursor_id) ORDER BY created_at, id
```

**Optimistic updates** (React Query):
```
useMutation({
  onMutate: async (newDeal) => { /* update cache optimistically */ },
  onError: (err, vars, context) => { /* rollback */ },
  onSettled: () => { queryClient.invalidateQueries(['deals']) }
})
```

**Query projection**: `listDealsLight()` selecciona solo `id, amount, status, client_id, created_at` para listados. `getDealFull(id)` selecciona `*` solo para detalle.

**Web Workers pool**: Para batch pricing de >50 deals, pool de 4 workers con distribución round-robin.

---

## Archivos nuevos y modificados

### Nuevos archivos
| Archivo | Fase |
|---------|------|
| `supabase/migrations/20260406000001_multi_entity.sql` | 1 |
| `contexts/EntityContext.tsx` | 1 |
| `api/entities.ts` | 1 |
| `components/ui/EntitySwitcher.tsx` | 1 |
| `components/Admin/EntityOnboarding.tsx` | 1 |
| `components/ui/PresenceAvatars.tsx` | 2 |
| `components/ui/ConflictModal.tsx` | 2 |
| `hooks/useFieldPresence.ts` | 2 |
| `utils/regulatoryExport.ts` | 3 |
| `components/Admin/HealthDashboard.tsx` | 3 |
| `utils/metrics.ts` | 3 |
| `utils/offlineStore.ts` | 4 |

### Archivos modificados (principales)
| Archivo | Cambio | Fase |
|---------|--------|------|
| `types.ts` | Group, Entity, EntityUser types + entityId en existentes | 1 |
| `App.tsx` | EntityContext provider, entity-aware routing | 1 |
| `api/shared.ts` | `withEntityScope()` middleware | 1 |
| `api/deals.ts` | Entity scoping, version checking, cursor pagination | 1, 2, 4 |
| `api/mappers.ts` | Mappers para group, entity, entity_user | 1 |
| `components/ui/Header.tsx` | EntitySwitcher, PresenceAvatars | 1, 2 |
| `hooks/supabaseSync/usePresenceAndSessionAudit.ts` | Presence payload extendido | 2 |
| `hooks/supabaseSync/useRealtimeSync.ts` | Entity-scoped channels | 1 |
| `contexts/AuthContext.tsx` | MFA flow, session binding | 2 |
| `components/Reporting/ReportingDashboard.tsx` | Group scope aggregation | 1 |
| `components/Blotter/BlotterTable.tsx` | Presence badges, entity column | 1, 2 |
| `translations.ts` | Keys para entity mgmt, presence, scheduling, etc. | 1-4 |

## Testing strategy

Cada fase incluye tests:
- **Fase 1**: Unit tests para entity scoping en api/, E2E para entity switcher y onboarding
- **Fase 2**: Unit tests para version conflict detection, E2E para presence indicators
- **Fase 3**: Unit tests para regulatory export format validation, integration tests para report scheduling
- **Fase 4**: Unit tests para offlineStore mutation queue, axe-core a11y validation en E2E

## Dependencias entre fases

```
Fase 1 (Multi-Entidad)
  └── Fase 2 (Colaboración & Seguridad) — requiere entity_id en presence channels
       └── Fase 3 (Enterprise Ops) — requiere entity scoping para report scheduling
            └── Fase 4 (Polish) — independiente, puede paralelizarse con Fase 3
```

Fase 4 es la más independiente y sus items pueden intercalarse con Fases 2-3 si se priorizan.
