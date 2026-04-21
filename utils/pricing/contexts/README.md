# Pricing motor — bounded contexts

> Estado: **scaffold documentado** (2026-04-21). Las extracciones reales
> se hacen por olas, un contexto por PR.

## Motivación

Hoy `utils/pricing/` es un flat directory con ~22 módulos. Trabaja pero mezcla
responsabilidades: `creditRiskEngine` calcula riesgo + governance,
`liquidityEngine` mezcla FTP + descuentos de depósitos. No hay interfaces de
dominio explícitas entre ellos.

Meta: agrupar por **bounded context** con una sola forma de entrar y salir
de cada contexto (un `index.ts` público), para poder razonar sobre cada
dominio independientemente.

## Contextos diana

```
utils/pricing/
  contexts/
    core/          # Orquestación (pricingEngine.ts), tipos compartidos, formulaEngine
    credit/        # creditRiskEngine, creditLifecycle, IFRS9, delegationEngine
    liquidity/     # liquidityEngine, LCR / NSFR, deposit runoff
    capital/       # capitalEngineCRR3, capital_income, output floor phase-in
    governance/    # approval level, EVA bands, audit trail side-effects
    market/        # curveUtils, nelsonSiegelSvensson, interpolation
    analytics/     # expostRaroc, rarocRealization, elasticityCalibration, priceElasticity
```

Cada contexto expone **una sola superficie pública** vía `index.ts`:

```ts
// utils/pricing/contexts/governance/index.ts
export { resolveApprovalLevel, DEFAULT_EVA_BANDS } from './approvalLevel';
export type { ApprovalLevel, GovernanceMode } from './approvalLevel';
```

Los contextos sólo importan de:

1. **`types/*`** (tipos de dominio).
2. **`../market`** (el único contexto upstream del que casi todos dependen).
3. **Su propio contexto** (ficheros hermanos).

Un contexto **nunca** importa de otros contextos al mismo nivel (credit ↔
liquidity) — eso indicaría que la frontera está mal dibujada.

## Reglas para tocar contextos

1. **Un PR = un contexto.** No mezclar refactors de credit + liquidity en la
   misma PR porque ambos parecen "pricing stuff".
2. **Tests al mover, no al reordenar.** Extraer un módulo a un contexto
   nuevo exige que su test suite siga verde sin modificar tests — si hay que
   tocar tests, la frontera está mal.
3. **`index.ts` es el contrato.** Si añades un export al index, documenta
   por qué ese símbolo es público (quién lo consume y desde qué capa).
4. **`governance` es special-case.** Funciona como un *decorator* sobre el
   output del motor (determina approval level del deal tras pricing). No
   debe ser invocado por otros contextos pricing — sólo por el orquestador
   core y el workflow layer.

## Plan de migración

| Ola | Contexto | Alcance | Estado |
|---|---|---|---|
| C-1 | `governance/` | Split aprobación + modo EVA/RAROC + shim retrocompatible | ✅ **Done** |
| C-2 | `market/` | Barrel re-exportando curveUtils + interpolation + NSS | ✅ **Done** (re-export phase) |
| C-3 | `capital/` | Barrel: CRR3 output floor + buffers | ✅ **Done** (re-export phase) |
| C-4 | `liquidity/` | Barrel: LCR + NSFR + LP curves + SDR | ✅ **Done** (re-export phase) |
| C-5 | `credit/` | Mayor: `creditRiskEngine`, `creditLifecycle`, `delegationEngine`, IFRS9 | Pendiente |
| C-6 | `analytics/` | Post-trade (expostRaroc, rarocRealization) | Pendiente |
| C-7 | `core/` | Orquestador y tipos compartidos al final | Pendiente |

**Acceso unificado**: desde cualquier caller nuevo se puede importar los
contextos vía el barrel raíz del motor:

```ts
import { market, governance } from 'utils/pricing';
market.nssYield(params, t);
governance.resolveApprovalLevel(raroc, hurdle, matrix);
```

## Preview — governance context

Cuando se ejecute la ola C-1, el layout será:

```
contexts/governance/
  index.ts                      # Exports públicos
  approvalLevel.ts              # resolveApprovalLevel, bandas EVA/RAROC
  governanceMode.ts             # Flag + env reader (VITE_GOVERNANCE_MODE)
  __tests__/
    approvalLevel.test.ts
    governanceMode.test.ts
```

Los consumidores actuales (`import … from 'utils/pricing/governance'`)
siguen funcionando porque `utils/pricing/governance.ts` se convierte en un
re-export shim:

```ts
// utils/pricing/governance.ts  (tras C-1)
export * from './contexts/governance';
```

Esto permite:
- **Cero breaking change** para callers.
- Deprecar el shim en una ola posterior cuando todos los imports estén
  actualizados.
