# Auditoría RLS — Abril 2026

## Resumen ejecutivo

Se revisaron las migraciones activas de `supabase/migrations/` con foco en tres preguntas:

1. Si cada tabla sensible tiene `ENABLE ROW LEVEL SECURITY`.
2. Si las policies filtran por rol (`get_user_role()` / `users.role`) y, cuando aplica, por `entity_id`.
3. Si hay tablas nuevas cuya seguridad vive en migraciones posteriores y ya no está reflejada en `supabase/schema_v2.sql`.

Resultado: la base está razonablemente protegida, pero el estado real de RLS ya no cabe en `supabase/schema_v2.sql` y había un ajuste de hardening pendiente en `greenium_rate_cards` y en writes entity-scoped recientes. Ese ajuste queda cubierto por `supabase/migrations/20260411000002_rls_hardening.sql`.

## Hallazgos principales

- `supabase/schema_v2.sql` ya no es una referencia completa de RLS. Sirve como baseline histórico, pero tablas y policies posteriores viven solo en migraciones.
- La migración `20240301000000_rls_policies.sql` sigue siendo la base del modelo RBAC clásico: lectura amplia para usuarios autenticados y escritura restringida por rol en tablas maestras.
- La migración `20260406000001_multi_entity.sql` introduce el control de aislamiento más importante del estado actual: `entity_id`, `get_current_entity_id()` y `get_accessible_entity_ids()`.
- `audit_log` cumple el requisito de ser `INSERT`-only en la capa RLS: hay lectura e inserción, pero no policies de `UPDATE`/`DELETE`, y además el esquema inicial ya incluía inmutabilidad por trigger.
- `pricing_results` mantiene el patrón append-only: `SELECT` + `INSERT`, sin updates ni deletes para usuarios autenticados.
- `report_runs` solo tiene policy de lectura. Esto parece intencional: la generación de ejecuciones debería venir de backend o `service_role`, no del cliente autenticado.
- `greenium_rate_cards` tenía una policy de escritura defectuosa en `20260407000001_esg_greenium_dnsh_isf.sql`: comparaba `auth.uid()` con el `id` serial de la fila, lo que no modela roles de negocio y podía bloquear escrituras legítimas. Ya se endureció en la nueva migración de follow-up.

## Cobertura por migración

| Migración | Tablas / alcance | Estado RLS | Observaciones |
| --- | --- | --- | --- |
| `20240101000000_initial_schema.sql` | Esquema base | Parcial | Define tablas y realtime; la política fina llega después. |
| `20240201000000_v2_extensions.sql` | `deal_versions`, `ftp_rate_cards`, helper `get_user_role()` | Soporte | Introduce la función que usan las policies RBAC posteriores. |
| `20240301000000_rls_policies.sql` | `deals`, `audit_log`, `pricing_results`, `rules`, `users`, `system_config`, `clients`, `products`, `business_units`, `yield_curves`, `behavioural_models`, `deal_versions`, `ftp_rate_cards`, `liquidity_curves`, `esg_*` | Correcto como baseline | `deals` separa `SELECT`/`INSERT`/`UPDATE`/`DELETE`; `audit_log` y `pricing_results` son append-only; muchas tablas maestras siguen con lectura global para authenticated. |
| `20240401000000_indexes.sql` | Índices | N/A | Sin impacto directo en RLS. |
| `20240501000001_rule_versioning.sql` | `rule_versions` | Correcto | Lectura para authenticated, insert restringido a `Admin`/`Risk_Manager`, historia inmutable. |
| `20240501000002_multi_tenant.sql` | `tenants`, `user_tenants`, `tenant_config` | Parcial / transición | Las policies tenant-scoped de tablas de negocio quedaron comentadas y luego fueron superadas por multi-entity. Mantener solo como antecedente, no como referencia activa. |
| `20240501000003_esg_versioning.sql` | `esg_transition_versions`, `esg_physical_versions` | Correcto | Históricos inmutables con insert limitado por rol. |
| `20240501000004_yield_curve_history.sql` | `yield_curve_history` | Aceptable | `SELECT` amplio para authenticated; `INSERT` restringido por rol. No tiene `entity_id`, así que hoy es global. |
| `20240501000005_deal_comments.sql` | `deal_comments`, `notifications` | Aceptable con matices | `deal_comments` es append-only; `notifications` limita lectura y update al destinatario. No está entity-scoped. |
| `20260406000001_multi_entity.sql` | `groups`, `entities`, `entity_users` y tablas de negocio con `entity_id` | Correcto y clave | Es el verdadero aislamiento actual. Las tablas de negocio revisadas reciben `read/insert/update` por entidad accesible o entidad activa. |
| `20260406000002_deal_versioning.sql` | Versionado adicional de deals | Sin cambios RLS | Hereda el modelo previo. |
| `20260406000003_report_schedules.sql` | `report_schedules`, `report_runs` | Correcto con nota | `report_schedules` está entity-scoped; `report_runs` solo lectura para authenticated, razonable si las escrituras son server-side. |
| `20260406000004_pricing_lineage.sql` | `pricing_results.source_ref` | Sin cambios RLS | Amplía trazabilidad sin cambiar políticas. |
| `20260406000005_observability.sql` | `metrics`, `alert_rules` | Correcto con hardening menor | `metrics` ya usaba `WITH CHECK`; `alert_rules` quedó endurecido para explicitar también `WITH CHECK`. |
| `20260407000001_esg_greenium_dnsh_isf.sql` | `greenium_rate_cards`, columnas ESG en `deals` | Requiere follow-up | La write policy de `greenium_rate_cards` era inconsistente con el modelo RBAC. |
| `20260411000001_deal_credit_risk_fields.sql` | Campos Anejo IX | Sin cambios RLS | Sigue protegido por las policies de `deals`. |
| `20260411000002_rls_hardening.sql` | Hardening post-auditoría | Cerrado | Corrige `greenium_rate_cards` y hace explícito `WITH CHECK` en `report_schedules` y `alert_rules`. |

## Tabla de tablas sensibles

| Tabla | RLS | Lectura | Escritura | Observación |
| --- | --- | --- | --- | --- |
| `deals` | Sí | `authenticated`, luego filtrado por entidad | `INSERT/UPDATE/DELETE` diferenciados | Buen baseline RBAC + aislamiento multi-entidad. |
| `audit_log` | Sí | `authenticated`, luego por entidad en multi-entity | Solo `INSERT` | Cumple append-only a nivel RLS. |
| `pricing_results` | Sí | `SELECT` | `INSERT` | Correcto para snapshots/versiones de pricing. |
| `system_config` | Sí | `authenticated` | `Admin` | Sigue siendo global; si se multiplica el uso por entidad convendría revisarlo. |
| `clients/products/business_units/rules/yield_curves/behavioural_models` | Sí | `authenticated`, luego entity-scoped donde aplica | `Admin/Risk_Manager` + entity-scoped | Modelo coherente. |
| `deal_versions`, `rule_versions`, `esg_*_versions`, `deal_comments` | Sí | `authenticated` | Insert-only o rol restringido | Patrón de historia inmutable correcto. |
| `notifications` | Sí | Solo destinatario | Insert amplio, update propio | Útil para UX; no tiene entity scope. |
| `groups`, `entities`, `entity_users` | Sí | Basado en acceso real del usuario | Escritura admin sobre su entidad | Correcto para administración multi-entidad. |
| `report_schedules` | Sí | Entidades accesibles | Entidad activa | Hardening explícito aplicado. |
| `report_runs` | Sí | Entidades accesibles | Sin write policy para authenticated | Asumido backend / `service_role`. |
| `metrics` | Sí | Entidades accesibles | Entidad activa | Alineado con observabilidad multi-entidad. |
| `alert_rules` | Sí | Entidades accesibles | Entidad activa | Hardening explícito aplicado. |
| `greenium_rate_cards` | Sí | `authenticated` | `Admin/Risk_Manager` | Queda alineado con otras tablas metodológicas. |

## Riesgos y deuda residual

- `schema_v2.sql` y el estado real de migraciones divergen en seguridad. Para onboarding sigue siendo útil, pero no debe considerarse fuente única de verdad.
- Varias tablas históricas previas a multi-entity siguen con lectura amplia para authenticated y dependen de que el aislamiento fuerte llegue por la migración de `entity_id`. Esto es aceptable, pero hace más importante no saltarse `20260406000001_multi_entity.sql`.
- `yield_curve_history`, `notifications` y algunos históricos no están entity-scoped. Esto puede ser correcto por diseño, pero conviene revisarlo si se profundiza el aislamiento por entidad en reporting y market data.
- `report_runs` no permite writes desde authenticated. La inferencia es que las ejecuciones las genera backend privilegiado; si en el futuro se exponen writes desde cliente, hará falta policy específica.

## Recomendaciones

1. Tratar `supabase/migrations/` como fuente de verdad operativa y rebajar el peso de `schema_v2.sql` en documentación futura.
2. Mantener el patrón append-only en tablas de auditoría, snapshots y versiones; está bien alineado con trazabilidad regulatoria.
3. Si se añade una nueva tabla de negocio:
   - activar RLS,
   - añadir `entity_id` salvo razón fuerte para no hacerlo,
   - crear policies `read/insert/update` alineadas con `get_accessible_entity_ids()` y `get_current_entity_id()`,
   - registrar el caso en `hooks/supabaseSync/useRealtimeSync.ts` si participa en sync.
4. Si `greenium_rate_cards` sigue sin consumidor runtime y el grid real vive en `system_config.greenium_grid`, decidir en una sesión futura si se consolida o se elimina la tabla para evitar doble fuente de verdad.
