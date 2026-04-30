# Runbook — Attribution drift sistemático

Trigger: el detector de drift (worker `attributionDriftDetector`) emite
señales `warning` o `breached` sobre figuras comerciales que muestran
patrón sistemático de aprobación al límite.

## Señales

- Logs `[attribution-drift]` con `severity: 'warning' | 'breached'` en
  el server (incluyen `entityId`, `userId`, `count`, `meanBps`,
  `pctAtLimit`, `reasons`).
- Métrica derivada `attribution_drift_signals_total` no es 0 en la
  ventana de 24h (ver `PRICING_SLOS` en `types/phase0.ts`).
- Vista `/attributions/reporting` tab "Drift" muestra usuarios fuera
  de banda con detalle por motivo dominante.

## Triage

1. **¿El worker está corriendo?**
   ```bash
   # En el server donde arrancó:
   echo "$ATTRIBUTION_DRIFT_INTERVAL_MS"   # debería ser ≥ 1000
   ```
   Si está vacío, el worker no se inicia (opt-in). Sin él, los logs
   no aparecen y la UI sigue funcionando contra `/reporting/summary`
   bajo demanda.

2. **¿Cuántos usuarios y qué severidad?**
   ```sql
   -- Reproduce la señal contra DB live
   SELECT decided_by_user, count(*),
          avg(abs((routing_metadata->>'deviationBps')::numeric)) AS mean_dev
   FROM attribution_decisions
   WHERE entity_id = :entity
     AND decided_at >= now() - interval '90 days'
     AND decided_by_user IS NOT NULL
   GROUP BY decided_by_user
   HAVING count(*) >= 20
   ORDER BY mean_dev DESC;
   ```

3. **¿Es ruido o patrón real?**
   - Confirma que la matriz no se reconfiguró recientemente (un
     threshold más estricto puede empujar masivamente al límite a un
     comercial). Revisa `attribution_thresholds.created_at` últimos 30
     días.
   - Cruza con volumen del comercial — si maneja deals atípicos, el
     drift puede estar justificado por composición de cartera, no por
     comportamiento.

## Acciones

### Si el patrón es real (drift sistemático individual)

1. Compartir la señal con el manager directo del usuario (Risk Officer
   + Comercial Lead). NO comunicar al usuario directamente desde el
   sistema — es información para gestión de personas.
2. Abrir un caso de revisión: ¿formación, recalibración de incentivos,
   trade-off explícito en pricing committee?

### Si el patrón es ruido (cambio de threshold reciente)

1. Verificar que el threshold nuevo es deliberado. Si lo es, esperar
   30 días de data antes de emitir más alertas (los últimos 90 días
   incluyen decisiones bajo el threshold viejo, lo que sesga el drift).
2. Considerar subir temporalmente `meanDeviationWarnBps` /
   `pctAtLimitWarn` en la matriz hasta que la cohorte se estabilice
   (cambio en `DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS` o por env override
   futuro).

### Si el detector dispara en bucle (falso positivo crónico)

1. Subir `ATTRIBUTION_DRIFT_INTERVAL_MS` a 6h (21_600_000) o desactivar
   temporalmente (eliminar la env var) mientras se calibra.
2. La UI de `/attributions/reporting` sigue accesible — el detector
   sólo añade el log estructurado para alert pipelines.

## Recovery

- Una vez el patrón se ha tratado (formación, recalibración, comité),
  esperar a que la cohorte de 90 días se renueve para que la métrica
  baje. No hay nada que "limpiar" en DB — el drift es derivado.

## Postmortem checklist

- ¿La matriz tenía thresholds adecuados al perfil de cartera?
- ¿El comercial había recibido formación sobre los criterios de
  delegación y trade-offs (margen vs RAROC vs venta cruzada)?
- ¿Hay otros usuarios con perfil similar que NO disparan alerta?
  Comparar las distribuciones — si la mayoría también está al límite,
  el problema es la matriz, no la persona.

## Referencias

- Plan: `docs/ola-8-atribuciones-banca-march.md` §3 Bloque C.
- Detector puro: `utils/attributions/attributionReporter.ts`
  (`detectSystematicDrift`, `DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS`).
- Worker runtime: `server/workers/attributionDriftDetector.ts`.
- SLI: `attribution_drift_signals_total` en `PRICING_SLOS`
  (`types/phase0.ts`).
