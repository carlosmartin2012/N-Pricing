# Refactor follow-ups — análisis 8 bloques

> Generado tras el análisis de mejora del repo (sesión 2026-05-13).
> Esta rama (`refactor/8-bloques-mejora`) cierra los bloques mecánicos y
> seguros; los pendientes requieren rama propia con scope dedicado.

## Aplicados en esta rama

| Bloque | Cambio | Riesgo |
|--------|--------|--------|
| 8.a | `e2e/example.spec.ts` → `e2e/smoke.spec.ts` (rename, sin cambio de contenido) | Bajo |
| 8.b | `utils/supabaseClient.ts` JSDoc corregido (`@deprecated` → "compat shim activo") | Ninguno (solo doc) |
| 2 | `CLAUDE.md`: header date, packages/* en árbol, conteo tests/specs, nota port :5000 vs workspace, routes 28, workers 9 | Ninguno (solo doc) |
| 7.a | `vercel.json`: CSP `report-uri` + `report-to` + header `Reporting-Endpoints` | Bajo |
| 7.b | `server/routes/cspReport.ts` nuevo, montado público en `/api/csp-report` | Bajo |
| 7.c | Pitfall en CLAUDE.md sobre proxy Vercel→Express requerido | Ninguno (solo doc) |
| 6.a | CI: Lighthouse en push a main (non-blocking) | Bajo |
| 6.b | CI: E2E full en PR (bloqueante) + E2E critical en push a main (non-blocking) | Bajo |
| 1.1 | ESLint `no-restricted-imports` para `pricingEngine` / `canonicalJson` / `snapshotHash` | Bajo |
| 1.1 | 3 scripts migrados de `utils/snapshotHash` → `@npricing/evidence` | Bajo |
| 3.b | `tsconfig.allowJs: true → false` | Bajo |

## Pendientes (cada uno = PR/sesión propia)

### Bloque 3.a — Activar `noUncheckedIndexedAccess`
- **Diagnóstico:** flip genera **763 errores TS**. Impacto masivo, especialmente
  en `utils/pricingEngine`, `utils/snapshotHash`, `utils/pricing/*` (acceso a
  curvas, grids, transition matrices sin guardia).
- **Plan sugerido:**
  1. Rama `chore/strict-array-access`.
  2. Activar el flag, dejar el typecheck rojo.
  3. Fix por dominio (snapshots → pricing engine → grids → contexts).
  4. Tests boundary: no debería cambiar comportamiento, solo añadir guards.
  5. Cuidado especial en código financiero — el bug que esto previene es
     justo el tipo de bug que un auditor regulatorio encuentra.

### Bloque 4 — Server logger estructurado
- **Diagnóstico:** 36 `console.*` en `server/` con pattern `[prefix]`.
  `utils/logger.ts` es browser-only (usa `import.meta.env`). No hay sink.
- **Plan sugerido:**
  1. Crear `server/logger.ts` con `pino` (JSON estructurado, levels, redacción
     de PII).
  2. Helper `logger.child({ module: 'tenancy', requestId })` por scope.
  3. Sustituir mecánicamente los 36 sites.
  4. Configurar destino: stdout en dev/Replit, JSON a Datadog/Logflare en
     Vercel via env `LOG_SINK_URL`.
  5. Audit final: 0 `console.*` en server fuera de tests y stdout.

### Bloque 5 — Archivos monolíticos
6 candidatos, ordenados por valor/esfuerzo:

1. `server/routes/whatIf.ts` (1531L) — split por subdominio: workspace,
   publish, governance, history.
2. `server/routes/attributions.ts` (1228L) — split: routing, decisions,
   thresholds, simulator.
3. `utils/seedData.ts` (1418L) — extracción ya iniciada con
   `seedData.entities.ts`; faltan clientes, deals, curves, rules, etc.
4. `e2e/mockApi.ts` (1477L, 113 page.routes) — split por dominio (auth,
   pricing, deals, attributions, ...) en `e2e/mocks/*.ts`.
5. `translations.ts` raíz (1622L) — ver Bloque 1.3.
6. `server/migrate.ts` (1154L) — ver Bloque 1.2.

Cada uno requiere tests antes/después para garantizar paridad. No mecanizar.

### Bloque 1.2 — Consolidar schema migrate.ts → migrations SQL
- **Diagnóstico:** `server/migrate.ts` mantiene 1154L de schema inline que es
  subconjunto de las 43 SQL migrations. CLAUDE.md ya documenta esto como
  bug-magnet histórico (PRs #55/#56/#57 corrigieron divergencias).
- **Plan sugerido:**
  1. Rama `chore/consolidate-migrations`.
  2. Crear `server/migrationRunner.ts` que ejecuta `supabase/migrations/*.sql`
     en orden lexicográfico (similar al step del CI integration-tests).
  3. Handle bootstrap Supabase-compat objects para Node-only envs (auth schema
     stubs, publication, roles). Reusar el SQL del CI workflow.
  4. Eliminar `runMigrations()` inline, sustituir por nuevo runner.
  5. Validar con DB limpia: ¿produce schema idéntico? Smoke test en Replit.
  6. Borrar las ~1100 líneas de schema duplicado.
- **Beneficio:** una sola fuente de verdad, fin del bug-magnet histórico.

### Bloque 1.3 — Unificar translations.ts vs translations/
- **Diagnóstico:**
  - `translations.ts` raíz (1622L): monolítico, en+es completos,
    pt/fr/de parciales con fallback silente a en.
  - `translations/` (1147L): split-by-domain (`pricing.es.ts`,
    `governance.en.ts`...), solo en+es.
  - **Decisión requerida del owner:** ¿quién es la verdad?
- **Plan sugerido si translations/ es source:**
  1. Auditar qué claves están solo en `translations.ts` raíz.
  2. Migrarlas a los dominios correspondientes de `translations/`.
  3. Generar `translations.ts` raíz como barrel auto-generado.
  4. O eliminarlo y actualizar consumidores.
- **Plan sugerido si translations.ts raíz es source:**
  1. Borrar la carpeta `translations/`.
- **Plan sugerido si ambos coexisten por diseño:**
  1. Documentar la regla (e.g., `translations/` es para Olas nuevas,
     `translations.ts` raíz es legacy hasta cierta fecha).
  2. Añadir test que detecte clave duplicada en ambos.

### Bloque 7 follow-up — Wirear CSP reports en Vercel
- El endpoint Express `/api/csp-report` existe pero deploys Vercel-only
  no lo alcanzan.
- **Opción A (preferida):** rewrite en `vercel.json` apuntando a la URL del
  Express (`{ "source": "/api/csp-report", "destination": "https://api.example.com/csp-report" }`).
- **Opción B:** crear `api/csp-report.ts` como Vercel serverless function
  que duplique el handler.

### Bloque 6 follow-up — `legacy-peer-deps` y `VERCEL_FORCE_NO_BUILD_CACHE`
- Ambos sugieren issues históricos sin resolver. Audit:
  - `npm ls react react-dom @types/react` — ver qué peer-deps disputan.
  - Probablemente: React 19 + alguna lib testing/storybook que pin <19.
  - Si se puede arreglar (resolutions en package.json o bump de la lib
    incompatible), quitar `--legacy-peer-deps` da builds más predecibles.
- `VERCEL_FORCE_NO_BUILD_CACHE=1` — desactivado deliberadamente. Razón
  probable: bug Vite/PWA con cache. Si ya no aplica, ahorro ~30-60s/deploy.

## Resumen ejecutivo del estado

- **6 bloques cerrados** en esta rama (8, 2, 7, 6, 1.1, 3.b parcial).
- **5 bloques diferidos** con plan documentado (3.a, 4, 5, 1.2, 1.3).
- **2 follow-ups menores** identificados (CSP wiring, peer-deps audit).
