# Translations — namespaced structure

> Estado: **scaffolding + async loaders** (2026-04-29 / Ola 7 Bloque D
> foundations). El monolito `translations.ts` (~80 KB, 1450 LOC) sigue
> siendo la fuente viva para la mayoría de consumers. Este directorio
> es el destino de la migración incremental.

## API

Hay dos formas de consumir packs:

1. **Sync (bundle inicial)**

   ```ts
   import { sharedTranslations } from './translations/index';
   const t = sharedTranslations('es');
   t.sharedSave; // → 'Guardar'
   ```

   Importa todos los packs en el bundle inicial. Útil para componentes
   siempre montados (header, sidebar, login).

2. **Async / code-split** *(añadido 2026-04-29)*

   ```ts
   import { loadNamespaceTranslations } from './translations/lazy';
   const t = await loadNamespaceTranslations('shared', 'es');
   t.sharedSave; // → 'Guardar'
   ```

   Vite emite un chunk separado por `(namespace, lang)`. Solo el
   locale activo lo descarga el browser. Recomendado para vistas
   lazy-loaded (Storybook, Admin, Governance).

   Cache in-memory: una segunda llamada con el mismo `(ns, lang)`
   devuelve la misma referencia sin re-importar.

## Motivación

El `translations.ts` raíz tiene 3 problemas:

1. **TTI** — se carga al 100% en el bundle inicial aunque muchas vistas nunca
   se monten (Admin, Governance).
2. **Auditoría** — imposible ver claves huérfanas (no hay tooling que asocie
   uso con declaración).
3. **Merge-conflict magnet** — cualquier PR que toque UI añade líneas aquí.

## Estructura destino

```
translations/
  index.ts                 # Barrel + getTranslations() con lazy fallback
  commercial.en.ts / .es.ts   # Customer360, Campaigns, TargetGrid
  pricing.en.ts / .es.ts      # Calculator, RAROC, Stress, What-If
  governance.en.ts / .es.ts   # Methodology, Dossiers, Models, Escalations
  insights.en.ts / .es.ts     # Analytics, MarketData, Behavioural
  system.en.ts / .es.ts       # UserConfig, Health, Audit, Manual
  shared.en.ts / .es.ts       # Login, header, footer, common buttons
  clv.en.ts / .es.ts          # NEW — Phase 6 CLV + 360
```

## Contrato

Cada namespace exporta `{ [key: string]: string }`. `index.ts` hace merge
shallow (`...shared, ...commercial, ...pricing, ...`) y expone
`getTranslations(lang)` idéntico al actual.

El consumidor sigue usando `translations.es.xxx` — cero breaking change.

## Plan de migración — estado actual

| Ola | Namespace | Estado | Claves |
|---|---|---|---|
| T-A | `clv` | ✅ Done | ~30 |
| T-B | `commercial` | ✅ Done | ~16 |
| T-C | `pricing` | ✅ Done | ~20 |
| T-D | `governance` | ✅ Done | ~25 |
| T-E | `insights` | ✅ Done | ~15 |
| T-F | `system` + `shared` | ✅ Done | ~50 |
| T-G | Migrar componentes del monolito a estos namespaces | Pendiente (mecánico) |
| T-H | Borrar `translations.ts` raíz | Pendiente (bloqueado por T-G) |

Los 7 namespaces están en producción como **source of truth** para
cualquier clave nueva. La sweep de migración de claves existentes
(T-G → T-H) es puramente mecánica: localizar consumidores en
componentes, actualizar `import` y regenerar.

Cada sprint sólo toca UN namespace y es verificable con `npm run typecheck`.

## Reglas para nuevos textos

- Si añades texto nuevo, **hazlo directamente en el namespace correspondiente**
  (p. ej. `translations/clv.es.ts`), no en el monolito.
- Si no existe el namespace, créalo primero y regístralo en `index.ts`.
- **Claves nuevas**: camelCase, prefijo de dominio cuando aporte claridad
  (`clvProjectionTitle`, no `projectionTitle`).
