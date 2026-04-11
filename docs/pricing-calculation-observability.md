# Observabilidad de cálculos de pricing

## Objetivo

Tener trazabilidad estructurada de cada ejecución de `calculatePricing()` para explicar diferencias entre entornos, soportar auditoría regulatoria y acelerar debugging sin depender de `console.log`.

## Qué debe emitir cada cálculo

Cada ejecución relevante debe producir un trace con esta forma:

```ts
export interface PricingCalculationTrace {
  traceId: string;
  timestamp: string;
  dealId?: string;
  entityId?: string;
  userEmail?: string;
  source: 'calculator' | 'batch' | 'governance' | 'simulation' | 'edge-function';
  inputs: {
    dealSnapshot: Transaction;
    shocks: PricingShocks;
    approvalMatrixVersion?: string;
  };
  matchedRule?: {
    id?: string;
    reason?: string;
    formulaSpec?: unknown;
  };
  marketData: {
    yieldCurveIds: string[];
    liquidityCurveIds: string[];
    behaviouralModelIds: string[];
    greeniumRuleIds: string[];
  };
  gaps: Array<{
    id: string;
    label: string;
    value: number;
    unit: 'bps' | 'pct' | 'abs';
    diagnostics?: Record<string, unknown>;
  }>;
  outputs: FTPResult;
  performance: {
    durationMs: number;
    engineVersion: string;
  };
}
```

## Dónde se produce

- `utils/pricingEngine.ts` o el futuro pipeline del motor.
- `supabase/functions/pricing/index.ts` para cálculo remoto.
- Flujos que persisten resultados, por ejemplo:
  - `components/Calculator/hooks/usePricingReceiptActions.ts`
  - `utils/supabase/monitoring.ts`
  - operaciones batch o shocks de cartera.

## Dónde se consume

- `api/observability.ts` como fachada de lectura/escritura.
- Tabla `metrics` para agregados ligeros.
- `pricing_results.source_ref` para lineage resumido.
- Audit trail cuando un cálculo dispara decisión o cambio de estado.
- UI futura en Admin/Health para comparar latencia, reglas y curvas usadas.

## Separación de responsabilidades

- `pricing_results`: snapshot de negocio persistente y versionado.
- `audit_log`: eventos de usuario y workflow.
- `metrics`: series numéricas agregadas.
- `pricing_calculation_traces` o almacenamiento equivalente futuro: detalle explicable del cálculo.

No conviene sobrecargar `audit_log` con payloads completos de cálculo; se vuelve costoso y poco consultable.

## Diseño de almacenamiento

### Opción recomendada

Crear tabla dedicada:

```sql
CREATE TABLE pricing_calculation_traces (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES entities(id),
  deal_id UUID,
  source TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  trace JSONB NOT NULL,
  duration_ms NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Ventajas:

- consulta simple por `deal_id`, entidad o rango temporal,
- replay y debugging sin tocar `pricing_results`,
- payload rico comprimible en JSONB,
- RLS alineable con `entity_id`.

### Opción mínima transitoria

- guardar solo un `source_ref` resumido en `pricing_results`,
- emitir agregados a `metrics`,
- mandar trazas completas a backend logs estructurados.

Sirve para empezar, pero es peor para auditoría fina y comparación histórica.

## Métricas mínimas a publicar

- `pricing_latency_ms`
- `pricing_success_count`
- `pricing_error_count`
- `pricing_batch_size`
- `pricing_rule_match_fallback_count`
- `pricing_market_data_staleness_minutes`
- `pricing_override_count`

Las dos primeras ya encajan con la utilidad actual de `utils/metrics.ts`.

## Eventos críticos

Se debe emitir trace cuando ocurra cualquiera de estos casos:

- pricing manual desde calculator,
- save/autosave de resultado persistente,
- aprobación o booking que congela `pricing_snapshot`,
- shock analysis o simulación masiva,
- cálculo remoto en edge function,
- discrepancia entre pipeline nuevo y cálculo legacy en shadow mode.

## Integración incremental recomendada

1. Añadir helper `buildPricingCalculationTrace()` en `utils/pricing/`.
2. Medir `durationMs` en `calculatePricing()`.
3. Publicar primero métricas ligeras via `trackPricingLatency()`.
4. Guardar `source_ref` resumido en `pricing_results`.
5. Introducir tabla dedicada de traces cuando el volumen y la explicabilidad lo justifiquen.

## RLS y seguridad

- Toda traza persistida debe llevar `entity_id`.
- Lectura para entidades accesibles; escritura solo para backend o entidad activa según origen.
- Nunca incluir secretos, tokens ni payloads completos de auth.
- Si una traza contiene PII sensible del cliente, considerar redacción parcial antes de persistir.

## Consultas operativas que este diseño habilita

- “Qué curva y qué regla usó exactamente este pricing guardado.”
- “Por qué el RAROC cambió entre dos versiones del mismo deal.”
- “Qué gaps explican la diferencia entre entorno local y preview.”
- “Cuáles son los percentiles de latencia por entidad o producto.”

## Decisión recomendada

Empezar con observabilidad de dos capas:

1. métricas ligeras en `metrics`,
2. traces estructurados resumidos en `pricing_results.source_ref`.

Después, si el volumen de debugging y auditoría lo justifica, promover el payload completo a una tabla `pricing_calculation_traces` con RLS entity-scoped.
