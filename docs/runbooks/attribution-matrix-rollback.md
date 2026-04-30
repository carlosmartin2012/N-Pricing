# Runbook — Attribution matrix rollback

Trigger: un cambio reciente en `attribution_levels` o
`attribution_thresholds` está provocando enrutados incorrectos
(escalations spurias, rechazos masivos a Comité, drift breached
inmediato post-cambio).

## Cuándo ejecutar este runbook

- Una propuesta de `attribution_threshold_recalibrations` se aprobó y
  los siguientes 24 h muestran patrón anómalo: **>30%** decisiones
  escalando a un nivel superior al esperado.
- Un Admin/Risk_Manager modificó manualmente un threshold y se
  detectaron mismatches con `pricing_snapshots` históricos.
- El editor visual de la matriz reportó dry-run "X deals afectados"
  pero la realidad post-aplicación supera ese estimate por mucho.

## Triage

1. **Identificar el cambio**:
   ```sql
   -- Niveles modificados últimas 48 h
   SELECT id, name, level_order, rbac_role, active, updated_at
   FROM attribution_levels
   WHERE entity_id = :entity AND updated_at > NOW() - INTERVAL '48 hours'
   ORDER BY updated_at DESC;

   -- Thresholds modificados últimas 48 h
   SELECT id, level_id, deviation_bps_max, raroc_pp_min, volume_eur_max,
          is_active, updated_at
   FROM attribution_thresholds
   WHERE entity_id = :entity AND updated_at > NOW() - INTERVAL '48 hours'
   ORDER BY updated_at DESC;
   ```

2. **Cuantificar el impacto**:
   ```sql
   -- Decisiones desde el cambio
   SELECT decision, COUNT(*)
   FROM attribution_decisions
   WHERE entity_id = :entity
     AND decided_at > '2026-XX-XX'   -- timestamp del cambio
   GROUP BY decision;
   ```
   Si `escalated` > 30% del total, el cambio es la causa probable.

3. **Identificar la propuesta de recalibration** (si aplica):
   ```sql
   SELECT id, threshold_id, status, decided_at, decided_by_user
   FROM attribution_threshold_recalibrations
   WHERE entity_id = :entity AND status = 'approved'
     AND decided_at > NOW() - INTERVAL '48 hours'
   ORDER BY decided_at DESC;
   ```

## Rollback

> **Principio**: no se borra nada. Se desactiva el cambio dañino
> (`is_active = false` / `active = false`) y se reactiva la versión
> anterior. Esto preserva el audit trail y permite forensics.

### Opción A — Threshold modificado mal

1. **Crear threshold restaurando los valores anteriores**:
   ```sql
   INSERT INTO attribution_thresholds
     (entity_id, level_id, scope, deviation_bps_max, raroc_pp_min,
      volume_eur_max, active_from, is_active)
   VALUES
     (:entity, :level_id, '{}'::jsonb,
      :prev_deviation, :prev_raroc, :prev_volume,
      CURRENT_DATE, TRUE);
   ```
2. **Desactivar el threshold dañino** (NO DELETE):
   ```sql
   UPDATE attribution_thresholds
   SET is_active = false, updated_at = NOW()
   WHERE id = :bad_threshold_id;
   ```
3. **Marcar la recalibration aprobada como superseded** (audit trail):
   ```sql
   UPDATE attribution_threshold_recalibrations
   SET status = 'superseded',
       reason = 'rolled-back due to <incident-id>'
   WHERE id = :recal_id;
   ```

### Opción B — Level estructural roto (organigrama)

Si el problema es un nivel mal configurado (parent_id incorrecto,
levelOrder duplicado, etc):

1. **Soft-delete del level dañino**:
   ```sql
   UPDATE attribution_levels
   SET active = false, updated_at = NOW()
   WHERE id = :bad_level_id AND entity_id = :entity;
   ```
   Sus thresholds quedan filtrados por el query del router (que ya
   filtra `WHERE active = TRUE`).

2. **Crear el nivel correcto** con `level_order` y `parent_id` correctos.

3. **Verificar que las decisiones existentes que apuntaban al nivel
   dañino siguen siendo legibles** (sí lo serán; FK sin `ON DELETE`
   protege la integridad histórica gracias al soft-delete):
   ```sql
   SELECT COUNT(*) FROM attribution_decisions
   WHERE required_level_id = :bad_level_id;
   ```

### Opción C — Estado inconsistente generalizado

Si la matriz está en estado tan corrupto que es más rápido restaurar
desde un snapshot:

1. Detener el `ATTRIBUTION_RECALIBRATION_INTERVAL_MS` worker
   (env var → unset → restart) para evitar nuevas propuestas mientras
   se restaura.
2. Pausar el routing (kill switch via tenant feature flag):
   ```sql
   INSERT INTO tenant_feature_flags (entity_id, flag, enabled)
   VALUES (:entity, 'ATTRIBUTIONS_PAUSED', true)
   ON CONFLICT (entity_id, flag) DO UPDATE SET enabled = true;
   ```
   El cliente fallback al `delegationTier` plano de FTPResult mientras.
3. Restaurar `attribution_levels` y `attribution_thresholds` desde
   un point-in-time backup de la DB (Supabase: PITR; Postgres bare:
   `pg_restore` del backup más cercano antes del cambio).
4. Reactivar feature flag y workers en orden inverso.

## Verificación post-rollback

```bash
# Ratio de escalations después del rollback
curl -s -H "x-entity-id: $ENTITY" \
  "$HOST/api/attributions/reporting/summary?window_days=1" | jq '.funnel'
```
- `escalatedRate` debería volver a baseline (típicamente 5-15%).

```bash
# Drift signals post-rollback
curl -s -H "x-entity-id: $ENTITY" \
  "$HOST/api/attributions/reporting/summary?window_days=7" | jq '.drift'
```
- Sin breached signals nuevos en 7 días → rollback exitoso.

## Postmortem checklist

- ¿El editor mostró dry-run? Si sí, ¿por qué subestimó el impacto?
  Posibles causas: la cohorte de los 30 días previos no era
  representativa (cambio estacional), o el cambio afectó scope que
  no estaba en la muestra.
- ¿La propuesta venía del recalibrator automático o manual? Si
  automático, considerar endurecer los thresholds del recalibrator
  (sub `meanDriftRelaxBps` por debajo de 5 para prevenir relax
  prematuros).
- ¿Hubo trigger de violación de RLS / hash chain? Si sí, ver runbook
  `tenancy-violation.md` y `snapshot-write-failure.md`.

## Prevención

- **Dry-run obligatorio antes de aprobar**: el editor de la matriz
  ya simula contra el último mes. Confirmar que el operador miró
  ese resultado antes de aprobar.
- **Cambios graduales**: en lugar de cambiar `deviationBpsMax` de
  10 a 30 de una vez, escalonar 10 → 15 → 20 → 30 con una semana
  entre pasos.
- **Canary tenant**: si el deployment soporta múltiples entities,
  aplicar el cambio primero en un canary (entity de menor volumen)
  y monitorizar 48 h antes de roll-out general.

## Referencias

- Schema: `supabase/migrations/20260620000001_attributions.sql`
- Recalibrator: `utils/attributions/driftRecalibrator.ts`
- Plan: `docs/ola-8-atribuciones-banca-march.md`
- Runbook drift: `docs/runbooks/attribution-drift-systematic.md`
