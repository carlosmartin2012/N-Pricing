# Security Baseline — 2026-04

Estado repo-backed del slice de seguridad actualmente ejecutable.

## Controles automatizados

- `npm run check:security` ejecuta `npm audit --json --omit=dev` en CI y en local.
- El pipeline bloquea cualquier vulnerabilidad de producción no allowlisteada.
- `server/index.ts` añade cabeceras base en runtime:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cache-Control: no-store` para rutas `/api/*`

## Excepción gobernada actual

### `xlsx`

- Advisories:
  - `GHSA-4r6h-8v6p-xvw6`
  - `GHSA-5pgg-2g8v-p4x9`
- Estado upstream: sin fix disponible a fecha del corte.
- Motivo de permanencia: el repo sigue usando import/export Excel en flujos operativos y brochure tooling.
- Mitigaciones aplicadas en este corte:
  - validación de extensión permitida (`.xlsx`, `.xls`, `.csv`)
  - límite de tamaño de importación: `5 MB`
  - parseo por `ArrayBuffer`
  - desactivación de `cellFormula`, `cellHTML` y `cellText` en `XLSX.read`

## Próximo paso recomendado

Migrar `utils/excelUtils.ts` fuera de `xlsx` cuando exista una librería sustituta que cubra importación tabular y exportación `.xlsx` sin perder compatibilidad operativa.
