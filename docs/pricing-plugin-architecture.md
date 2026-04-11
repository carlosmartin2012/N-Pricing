# Pricing Plug-in Architecture

## Objetivo

Permitir que el motor de pricing evolucione sin convertir `calculatePricing()` en otra secuencia monolítica difícil de extender. La idea no es abrir extensibilidad arbitraria en producción mañana, sino preparar un diseño incremental para que los gaps del core y ajustes locales se registren como pasos declarativos.

## Principios

- El core sigue siendo dueño del orden, validación y trazabilidad del cálculo.
- Ningún plug-in puede mutar directamente el `deal`; solo recibe contexto y devuelve contribuciones tipadas.
- Los 19 gaps actuales pasan a verse como pasos registrados en un pipeline.
- Las extensiones locales deben poder activarse por entidad, país o feature flag sin fork del motor.
- La salida debe seguir siendo compatible con `FTPResult`, RAROC y audit trail.

## Modelo propuesto

```ts
export interface PricingPipelineContext {
  deal: Transaction;
  approvalMatrix: ApprovalMatrixConfig;
  market: PricingContext;
  shocks: PricingShocks;
  seed: FTPResult;
}

export interface PricingGapContribution {
  id: string;
  order: number;
  label: string;
  valueBps?: number;
  updates: Partial<FTPResult>;
  diagnostics?: Record<string, unknown>;
}

export interface PricingGapPlugin {
  id: string;
  version: string;
  stage: 'prePricing' | 'pricing' | 'postPricing';
  dependsOn?: string[];
  isEnabled?: (ctx: PricingPipelineContext) => boolean;
  compute: (ctx: PricingPipelineContext, state: FTPResult) => PricingGapContribution;
}
```

## Registry

```ts
export interface PricingRegistry {
  register(plugin: PricingGapPlugin): void;
  list(): PricingGapPlugin[];
  resolve(ctx: PricingPipelineContext): PricingGapPlugin[];
}
```

Comportamiento esperado:

- `register()` falla si hay ids duplicados.
- `resolve()` filtra por feature flags, entidad o capabilities.
- El orden final se calcula por `dependsOn` y `stage`, no por orden de import.

## Pipeline de ejecución

1. `calculatePricing()` construye `PricingPipelineContext`.
2. El registry devuelve los gaps habilitados.
3. El orquestador hace sort topológico por dependencias.
4. Cada gap recibe el `FTPResult` acumulado y devuelve una contribución tipada.
5. El orquestador compone:
   - `FTPResult` final,
   - `gapBreakdown[]`,
   - `diagnostics`,
   - trazas para observabilidad.

## Compatibilidad con el motor actual

Fase 1:

- Mantener `calculatePricing()` como API pública.
- Encapsular pasos existentes en adaptadores internos sin cambiar fórmulas.
- El registry se inicializa con plug-ins del core solamente.

Fase 2:

- Extraer gaps ya modularizados (`curveUtils`, `formulaEngine`, `liquidityEngine`, `additionalCharges`, `capitalEngineCRR3`) como plug-ins internos.
- Añadir `gapBreakdown` estructurado al resultado extendido, sin romper `FTPResult`.

Fase 3:

- Habilitar extensiones configurables por entidad para cargos regulatorios o overlays locales.
- Exigir manifest y tests de regresión para cada plug-in no-core.

## Ejemplo de plug-in

```ts
export const greeniumPlugin: PricingGapPlugin = {
  id: 'gap17-greenium',
  version: '1.0.0',
  stage: 'pricing',
  dependsOn: ['gap1-formula', 'gap5-liquidity-premium'],
  isEnabled: ({ deal }) => deal.greenFormat !== 'None',
  compute: ({ market, deal }, state) => {
    const rule = market.greeniumGrid.find((row) => row.greenFormat === deal.greenFormat);
    const valueBps = rule?.adjustmentBps ?? 0;
    return {
      id: 'gap17-greenium',
      order: 170,
      label: 'Greenium adjustment',
      valueBps,
      updates: {
        esgGreeniumAdj: valueBps / 100,
        totalFTP: state.totalFTP + valueBps / 100,
      },
      diagnostics: {
        matchedRuleId: rule?.id ?? null,
      },
    };
  },
};
```

## Contratos de seguridad

- Un plug-in no puede llamar a IO remoto durante `compute()`.
- No se permite acceso a `supabase`, `fetch` ni side effects de UI.
- Toda contribución debe ser serializable para audit y replay.
- Los plug-ins externos requieren allowlist y versionado explícito.

## Impacto en testing

- Cada plug-in debe tener unit tests propios.
- El registry necesita tests de:
  - orden topológico,
  - detección de ciclos,
  - filtros por entidad/feature flag,
  - compatibilidad hacia atrás.
- La suite de regresión numérica (`pricingRegression.test.ts`) se convierte en red de seguridad del pipeline completo.

## Plan de migración incremental

1. Introducir `registry.ts` y un tipo `PricingComputationTrace` sin cambiar la salida pública.
2. Envolver gaps actuales en adaptadores internos.
3. Añadir un flag `PRICING_PIPELINE_V1` para shadow mode en tests.
4. Comparar `calculatePricing()` legacy vs pipeline en la suite de regresión.
5. Cambiar el camino por defecto solo cuando el diff sea cero o explícitamente aceptado.

## Riesgos

- El mayor riesgo no es técnico sino regulatorio: un cambio de orden entre gaps puede alterar FTP y RAROC.
- Un pipeline demasiado genérico puede volver opaca la metodología si no se acompaña de trazabilidad clara.
- La extensibilidad por entidad debe quedar detrás de gobernanza y versionado, no de configuración libre.

## Decisión recomendada

Adoptar esta arquitectura solo en modo incremental y con compatibilidad total hacia atrás. El valor real no está en “plugins de terceros”, sino en desacoplar gaps, hacer visible el orden del cálculo y habilitar replay/observabilidad sin tocar la fórmula central a ciegas.
