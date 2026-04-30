# N-Pricing — Commercial documentation

> Documentación comercial — orientada a equipo Sales NFQ y conversaciones
> con compradores en el banco. **NO es documentación técnica del producto**
> (esa vive en `docs/architecture.md` y siblings).

## Documentos de este directorio

| Documento | Propósito | Audiencia |
|---|---|---|
| [`modules.md`](./modules.md) | Catálogo de módulos comerciales: Core + 4 módulos opcionales con buyer persona, workshop, KPIs y pricing tiers | Sales NFQ + comprador del banco |

## Workflow esperado

```
modules.md (este doc)
    │
    ├─→ Validación con 2-3 prospects → prospect-feedback-2026-XX.md
    │       │
    │       ├─→ Si la segmentación se confirma → cablear código
    │       │   (catálogo + feature flags + sidebar guards)
    │       │
    │       └─→ Si no se confirma → iterar la propuesta
    │
    └─→ Decks específicos por módulo (skill /offering-deck)
        Cowork/decks/n-pricing-{core,m1,m2,m3,m4}.html
```

## Dependencias

- **Primitiva técnica de feature flags:** `tenant_feature_flags`
  (Phase 5, ya en `main`)
- **Sidebar actual:** `appNavigation.ts` con taxonomía customer-centric
  (Option B, abril 2026) — los módulos se aplican como filtro encima,
  no sustituyen la taxonomía
- **Adapter framework:** `integrations/types.ts` —
  los adapters M4 ya son intercambiables vía env vars
