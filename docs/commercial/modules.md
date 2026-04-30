# N-Pricing — Módulos comerciales

> **Estado:** borrador para validar con 2-3 prospects (mayo 2026).
> **Audiencia primaria:** equipo comercial NFQ + comprador en el banco
> (CFO / CRO / Director Comercial / CIO).
> **Próximo paso:** validar la segmentación con pilots reales antes de
> cablear feature flags en código (ver `roadmap-implantacion.md`).

## Filosofía: core + extensions, no editions

N-Pricing **no se vende como Starter / Pro / Enterprise**. Esa
segmentación obliga a partir features arbitrariamente y termina
disgustando a los 3 segmentos a la vez (el "Pro" siente que le falta lo
del "Enterprise"; el "Starter" no puede crecer sin saltar de tier).

En lugar de eso: **un Core obligatorio + 4 módulos opcionales**, cada
uno con buyer persona distinto, workshop de implantación independiente,
y precio por separado.

Criterio para que algo sea un módulo (no una feature dentro de otro):

1. **Buyer persona distinto** — si el comprador es el mismo, va junto.
2. **Workshop de implantación independiente** — si requiere su propia
   sesión de 2-5 días con stakeholders distintos.
3. **Vendible solo o combinado** — sin que el resto del producto se
   rompa. (El Core es la excepción: obligatorio.)

## Tabla resumen

| Módulo | Buyer | Workshop | Depende de | Sin él, ¿el resto sigue funcionando? |
|---|---|---|---|---|
| **Core — FTP Engine** | CFO / Treasurer | 5-7 días | — | (es la base) |
| **M1 — Commercial Pricing** | Director Comercial / CRO | 3-5 días | Core | Sí |
| **M2 — Risk & Governance** | CRO / Risk Manager | 5-7 días | Core | Sí, pero no para banco regulado |
| **M3 — Channel Pricing** | Director Digital / CIO | 3-4 días | Core | Sí |
| **M4 — Integrations Pack** | CIO / Architecture | 3-5 días por adapter | Core | Sí |

---

## Core — FTP Engine

> **Sin esto, no hay producto.** Lo que un Treasury/ALM department
> necesita para hacer FTP regulatoriamente correcto y reproducible.

### Qué incluye

- **Motor FTP completo** (19 gaps cubiertos): liquidity premium, CLC,
  LCR/NSFR charges, capital charge, currency basis, incentivisation,
  SDR, ESG transition + physical, greenium, DNSH, ISF (Art. 501a
  CRR2), RAROC, economic profit
- **Calculadora individual** + **RAROC Terminal**
- **Yield Curves & Behavioural Models** — curvas duales por divisa,
  modelos comportamentales (NMD Caterpillar, prepayments, decay)
- **Methodology Engine** — reglas versionadas, configuración por
  segment×product×tenor, formula spec parametrizable
- **Snapshots inmutables** — cada cálculo guarda input + context +
  output + hashes SHA-256 para reproducibilidad regulatoria
- **Audit Log** + **Replay endpoint** — auditor puede re-ejecutar el
  motor con un snapshot histórico y obtener diff field-level
- **Multi-tenant** vía RLS Postgres (un único deploy sirve N bancos
  con aislamiento estricto)
- **Auth** (JWT + Google SSO) + **RBAC** básico

### Buyer persona

CFO, Treasurer, Head of ALM. Compradores que ya tienen el problema
"hacemos FTP en Excel + un proveedor caro y no escala". El Core
sustituye esa stack.

### Pain points que resuelve

- "Cada cierre de mes un equipo de 4 gestiona 200 hojas Excel"
- "El auditor pidió reproducir un pricing de hace 2 años y no podemos"
- "Cambiar una regla de pricing implica 6 semanas de coordinación"
- "Cada banco filial tiene sus números — no se consolidan"

### Workshop típico de implantación

5-7 días distribuidos:
- Día 1: Discovery + mapping de catálogo de productos del banco
- Día 2-3: Calibración de yield curves + behavioural models
- Día 4: Configuración methodology + reglas
- Día 5: User training (Treasury + ALM team)
- Día 6-7: Hyperintensive support primer cierre

### KPIs de éxito (criterios de aceptación)

- Tiempo de pricing por deal: **< 2 segundos** (vs ≥ 30 min en Excel)
- Reproducibilidad: **100%** de pricings reproducibles a la fecha
- Cierre de mes: **-60%** en horas-persona
- Cobertura regulatoria: **EBA GL 2018/02 + SR 11-7 + CRR3**

---

## M1 — Commercial Pricing

> **De "pricing de cada deal" a "pricing de la relación cliente".**
> Lo que un Director Comercial necesita para que sus gestores hagan
> ofertas defendibles que respeten márgenes y reflejen el valor del
> cliente como un todo.

### Qué incluye

- **Customer 360** — vista relacional del cliente: posiciones
  activas, eventos, métricas (NIM, share-of-wallet, NPS), CLV
- **Pipeline** — vista temporal del flujo de oportunidades por
  gestor / oficina / segmento
- **Campaigns** — ofertas versionadas por
  segment×product×currency×channel×window×volume con state machine
  (draft → active → ended)
- **Targets** — pricing targets top-down por celda
  (segment × product × tenor) con tolerance bands y discipline tracking
- **Cross-bonus relacional** — descuentos cross-sell calculados
  desde las posiciones del cliente, no per-deal manual
- **Pricing targets como pre-aprobado / hard floor**
- **What-If interactivo** — el comercial simula ajustes y ve nuevo
  routing de aprobación + diff legible

### Buyer persona

Director Comercial, Director de Banca de Empresas, CRO (en bancos
donde el CRO controla pricing de cliente).

### Pain points que resuelve

- "Mis gestores cierran a precios que destruyen RAROC y nadie lo ve
  hasta el cierre trimestral"
- "Los descuentos por cross-sell se prometen verbalmente y no se
  trackean"
- "No sé qué clientes son rentables como relación, sólo deal a deal"
- "Las campañas comerciales se documentan en un PowerPoint que nadie
  lee"

### Workshop típico de implantación

3-5 días:
- Día 1: Discovery comercial + segmentación cliente actual
- Día 2: Import histórico Customer 360 (CSV / API CRM) + calibración
  de targets top-down
- Día 3: Configuración de campaigns piloto + cross-bonus rules
- Día 4: Training comerciales (típicamente 10-30 gestores)
- Día 5 opcional: integration con CRM (Salesforce o similar — ver M4)

### KPIs de éxito

- **% de deals con descuento "no auditable"**: → 0
- **RAROC medio comercial**: +1-2 pp (mejora por discipline)
- **Tiempo de cotización gestor**: -50%
- **Conversion rate de pipeline**: +5-10% (mejor segmentación)

### Sin M1, ¿qué pierde el banco?

El motor FTP da el precio "correcto" para Treasury. Sin M1, ese precio
se traslada al gestor pero **no hay capa que ajuste el precio según la
relación**. Resultado típico: gestores aplican descuentos manuales
fuera del sistema → erosión de margen invisible.

---

## M2 — Risk & Governance

> **Convierte el motor en una herramienta auditable regulatoriamente.**
> Sin esto, N-Pricing es un Excel grande. Con esto, es un sistema
> defendible ante el supervisor (BdE, ECB, FED bajo SR 11-7).

### Qué incluye

- **Stress Testing** — 6 shocks EBA GL 2018/02 (±200bp parallel,
  ±250bp short, steepener, flattener) por deal y por cartera
- **Stress Pricing** — 6 presets EBA × deal individual (vista
  `/stress-pricing`)
- **Discipline Tracking** — quién aprobó qué fuera de tolerance, con
  scorecard por gestor / oficina
- **Model Inventory (SR 11-7 / EBA)** — registro formal de cada
  modelo con `kind`, `version`, `status`, owner, validation_doc_url
- **Signed Committee Dossiers** — paquete firmado HMAC-SHA256 con
  todos los inputs/outputs/contexto que se llevó a comité de modelos
- **Attribution Matrix** — árbol N-ario de niveles organizativos
  (Oficina → Zona → Territorial → Comité) con thresholds por nivel ×
  scope. Cada decisión queda en `attribution_decisions` append-only
  con hash chain a `pricing_snapshots`
- **Approval flows** con escalation temporal (con timeout, escala
  automáticamente al siguiente nivel)
- **Drift Recalibrator** — worker trimestral que detecta thresholds
  mal-calibrados y propone ajustes via governance flow
  Admin/Risk_Manager

### Buyer persona

CRO, Risk Manager, Model Validation team, Compliance Officer.
Compradores que tienen un IM en SR 11-7 o un próximo onsite del
supervisor.

### Pain points que resuelve

- "El supervisor pidió evidencia de que el modelo de pricing está
  validado y no podemos demostrarlo"
- "Las aprobaciones se hacen por email y se pierden"
- "No sabemos cuántas decisiones de pricing van fuera de los
  delegated authority limits"
- "Cuando la cartera cambia, los thresholds quedan obsoletos y nadie
  los revisa"

### Workshop típico de implantación

5-7 días distribuidos:
- Día 1-2: Mapping de organigrama → AttributionLevels
  (Oficina/Zona/Territorial/Comité) + thresholds por scope
- Día 3: Onboarding modelos en Model Inventory + carga histórica
- Día 4: Configuración Stress + Stress Pricing presets
- Día 5: Approval flows + escalation policies
- Día 6-7: Training equipo Risk + Compliance

### KPIs de éxito

- **Decisiones fuera de delegated authority no documentadas**: → 0
- **Tiempo de generación de Committee Dossier**: días → minutos
- **Cobertura de Model Inventory**: 100% de modelos productivos
- **Pasar IM regulatorio sin findings críticos**

### Sin M2, ¿qué pierde el banco?

**Cumplimiento regulatorio.** SR 11-7 (US), EBA GL 2018/02 (EU), MaRisk
(DE), Anejo IX BdE. En banco regulado europeo, M2 no es opcional — es
el motivo por el que el banco compra. **Recomendación NFQ: M2 debe ir
junto al Core en cualquier oferta a banco regulado.**

---

## M3 — Channel Pricing

> **Real-time pricing para canales digitales** — sucursal, web, mobile,
> call center, partner. Vendido por API key con rate limit y campaigns
> aplicadas en tiempo real.

### Qué incluye

- **Channel API** — endpoint `POST /api/channel/quote` con
  `x-channel-key` (sha256 en DB)
- **API Keys management** — creación/revocación per channel, con
  capability scoping (qué products / segments puede cotizar)
- **Token bucket rate limit** per-key (capacity = burst, refill =
  rpm/60)
- **Campaign delta** aplicado a `finalClientRate` en quotes — el
  comercial ve el precio promocional sin saltarse audit trail
- **Channel request log** para reconciliation y observability
- **SDK opcional** (TypeScript) para integración rápida

### Buyer persona

Director Digital, CIO, Head of Self-Service Banking. Comprador que
quiere ofrecer pricing instantáneo en canales digitales sin
sacrificar el mismo motor regulatoriamente correcto.

### Pain points que resuelve

- "La web da una cotización, el comercial otra, el call center otra,
  y el cliente se queja"
- "Cada canal tiene su propia 'lógica' de pricing en código duplicado
  que diverge en cada release"
- "Las campañas digitales no se reflejan en los pricings del comercial"

### Workshop típico de implantación

3-4 días:
- Día 1: API discovery + channel inventory + capability mapping
- Día 2: Setup de API keys + rate limit + first quote en sandbox
- Día 3: Integration con front digital existente (web / mobile)
- Día 4: Go-live + monitoring + reconciliation setup

### KPIs de éxito

- **Latencia p95 quote**: < 200 ms
- **Discrepancia de precio cross-canal**: → 0
- **Adopción de campaigns**: 100% de campañas digitales pasando por
  el motor (vs hardcoded en cada front)

---

## M4 — Integrations Pack

> **Conectores reales** a los sistemas core del banco. Sin esto,
> N-Pricing vive aislado y los datos se introducen manualmente.

### Qué incluye

Cada adapter es **opcional dentro del módulo**. El cliente contrata
el módulo + selecciona qué conectores activa.

| Adapter | Reemplaza | Esfuerzo |
|---|---|---|
| **Salesforce CRM** | CSV upload manual de Customer 360 | 3-5 días |
| **Bloomberg Market Data** | Carga manual de yield curves | 2-3 días |
| **PUZZLE Admission** (BM-style) | Push manual a sistema admisión | 5-7 días |
| **HOST Mainframe** (BM-style, SFTP file-drop) | Reconciliation manual | 5-7 días |
| **ALQUID Budget** (BM-style) | Carga manual de budget vs realizado | 3-5 días |
| **Custom adapter** | (cualquier sistema cliente) | 5-15 días |

Adicionalmente:
- **Reconciliation views** — admission, host, budget — con summary +
  drill-down a discrepancias
- **Adapter health monitoring** — endpoint `/health` por adapter,
  surface en `/health` global
- **Adapter fail-loud** en producción (no fallback silencioso a
  in-memory cuando faltan credenciales — Ola 10.3)

### Buyer persona

CIO, Head of Architecture, Integration Lead. Comprador que ya tiene
los sistemas core y quiere evitar capa manual entre ellos y N-Pricing.

### Pain points que resuelve

- "Importar el catálogo de clientes de Salesforce a N-Pricing es un
  CSV semanal que se rompe"
- "Las curvas Bloomberg se cargan a mano cada mañana"
- "Las decisiones de pricing no llegan al sistema de admisión hasta
  T+1 — y a veces nunca"

### Workshop típico de implantación

Por adapter (cifras arriba). Workshop conjunto si se contratan ≥3
adapters: 2-3 días extra de coordinación.

### KPIs de éxito

- **Datos manuales eliminados**: 100% para los flows cubiertos
- **Latencia de reconciliation**: T+1 → tiempo real
- **Discrepancia admission**: → < 0.5 bps tolerance

---

## Bundles típicos por tipo de cliente

### Banco grande regulado (BBVA, Santander, Sabadell)
**Recomendado: Core + M1 + M2 + M4**
- Treasury usa el Core
- Comercial usa M1
- Risk + Compliance dependen de M2 (regulador)
- M4 indispensable para escalar (no se puede operar manualmente con
  > 1000 deals/día)
- M3 opcional si tienen front digital relevante

### Banco mediano regulado (Bankinter, Banca March, Cajas/Mutuas)
**Recomendado: Core + M2 + selectivo M1/M3/M4**
- Core + M2 obligatorios (regulador no perdona)
- M1 si tienen estructura comercial fuerte (BM, sí; mutual de consumo,
  quizá no)
- M3 si tienen apuesta digital
- M4 selectivo (típico: empezar con 1-2 adapters)

### Financiera de consumo / fintech (más channel-driven)
**Recomendado: Core + M3 + selectivo M1/M2**
- Core + M3 son el caso de uso principal
- M1 selectivo (puede no tener "comerciales" tradicionales)
- M2 selectivo (depende del régimen regulatorio)

### Banco corporativo / mercado mayorista
**Recomendado: Core + M1 + M2**
- Core + M1 (cada deal es relacional)
- M2 obligatorio
- M3 normalmente innecesario (no hay self-service)
- M4 si tienen Bloomberg / Reuters

### Pilot / banco pequeño / proof-of-value
**Recomendado: Core solo**
- 30-60 días para validar fit antes de añadir módulos
- Si pasa el pilot, naturalmente sale demanda por M1 o M2

---

## Pricing tiers (rangos placeholder)

> Los rangos de abajo son **iniciales** para conversaciones
> tempranas. Validar y ajustar después de los primeros 3 contratos
> reales. Pricing real depende de tamaño del banco (assets bajo
> gestión), número de tenants y volumen de pricings/mes.

| Componente | Setup (one-time) | Subscription anual | Comentarios |
|---|---|---|---|
| Core — FTP Engine | €70-120k | €60-120k | Por banco; multi-entidad +20% por entidad adicional |
| M1 — Commercial Pricing | €40-60k | €30-60k | Pricing escalable a número de gestores |
| M2 — Risk & Governance | €60-90k | €40-80k | Premium si regulador requiere certificación |
| M3 — Channel Pricing | €30-50k | €20-40k + uso | Variable por volumen de quotes/mes |
| M4 — Integrations Pack (por adapter) | €15-30k | €10-20k | Por adapter activado |

**Política de bundling:** un bundle Core + 2 módulos descuenta ~10%;
Core + 3 módulos ~15%; suite completa ~20%. Negociable per-deal.

**No incluido en pricing arriba:** soporte 24/7 (módulo aparte),
on-call regulatorio (consultoría NFQ separada), customizaciones
(tasa día/persona).

---

## Cómo se cablea técnicamente (referencia rápida)

**Primitiva existente:** tabla `tenant_feature_flags(entity_id, flag,
enabled, set_by, set_at, notes)` — Phase 5, ya en `main`. Mismo schema
en `supabase/migrations/20260606000001_metering_phase_5.sql` y en
`server/migrate.ts` inline.

**Plan de cableado (post-validación de prospects):**

1. **Catálogo en código** (`lib/modules/catalog.ts`):
   ```ts
   export const MODULES = {
     'core':         { views: ['CALCULATOR', 'RAROC', ...], required: true },
     'm1-commercial':{ views: ['CUSTOMER_360', 'PIPELINE', ...] },
     'm2-governance':{ views: ['SHOCKS', 'STRESS_PRICING', ...] },
     ...
   };
   ```

2. **Sidebar respeta flags** — `appNavigation.ts:buildMainNavItems()`
   filtra entries cuyos modules están activados en
   `tenant_feature_flags` para el tenant.

3. **Per-route guards** — middleware Express devuelve 403
   `module_not_active` si el route pertenece a un módulo no contratado.

4. **Onboarding visual** — panel "What's included" en `/health` que
   muestra qué módulos tiene el tenant.

**No** se necesita rebrand del sidebar ni cambio de UX. La taxonomía
customer-centric (Relationships / Pricing / Market Data / Insights /
Governance) se mantiene; los módulos son una capa de billing/onboarding,
no de UX.

---

## Validation checklist (uso con prospects)

Llevar a las 2-3 conversaciones de validación. Si todos los prospects
contestan "sí" a las preguntas de un módulo, ese módulo es vendible
solo. Si todos contestan "sí" a uno y "no" al otro, hay diferenciación
clara entre los dos.

### Para validar el Core
- [ ] ¿Hacéis FTP regulatoriamente correcto hoy? ¿Cómo?
- [ ] ¿Cuánto tiempo dedica el equipo a un cierre de mes?
- [ ] ¿Podríais reproducir un pricing de hace 2 años si el supervisor
      lo pide?
- [ ] ¿Tenéis los 19 componentes (LCR, NSFR, capital charge, ESG, ...)
      cubiertos formalmente?

### Para validar M1 — Commercial Pricing
- [ ] ¿Sabéis qué clientes son rentables como relación (no per-deal)?
- [ ] ¿Trackéis los descuentos por cross-sell formalmente?
- [ ] ¿Hay discipline en los precios que fijan vuestros gestores?
- [ ] ¿Las campañas se reflejan en el motor o son ad-hoc?

### Para validar M2 — Risk & Governance
- [ ] ¿Tenéis Model Inventory SR 11-7 / EBA?
- [ ] ¿Cómo gestionáis las decisiones fuera de delegated authority?
- [ ] ¿Cuánto tarda generar un dossier de comité?
- [ ] ¿Cuándo fue el último IM regulatorio? ¿Findings sobre pricing?

### Para validar M3 — Channel Pricing
- [ ] ¿Tenéis pricing en self-service (web, mobile)?
- [ ] ¿La cotización digital y la del gestor coinciden?
- [ ] ¿Las campañas digitales pasan por el motor?

### Para validar M4 — Integrations Pack
- [ ] ¿Cuántos sistemas core diferentes alimentan vuestro pricing?
- [ ] ¿Qué % de datos se introducen manualmente?
- [ ] ¿Cuál es el sistema de admisión / CRM / market data hoy?

---

## Próximos pasos

1. **Validación con prospects** (esta semana / próxima):
   - 2-3 conversaciones con buyers actuales o pipeline avanzado
   - Usar el validation checklist arriba
   - Capturar feedback en `docs/commercial/prospect-feedback-2026-05.md`

2. **Si la segmentación se confirma** (2-3 semanas después):
   - Cablear catálogo en código (`lib/modules/catalog.ts`)
   - Sidebar respeta `tenant_feature_flags`
   - Per-route module guards
   - Estimación: 1 sprint (5 días dev)

3. **Si la segmentación NO se confirma:**
   - Iterar la propuesta basándose en lo que dijeron los prospects
   - **No** cablear código hasta tener segmentación validada por
     ≥ 2 prospects independientes

4. **Independiente del cableado:**
   - Documento comercial (este `modules.md`) entra en uso inmediato
     para conversaciones Sales
   - Decks específicos por módulo en `Cowork/decks/n-pricing-m1.html`,
     `n-pricing-m2.html`, etc. (skill `/offering-deck`)

---

## Referencias

- Primitiva técnica: `tenant_feature_flags` en
  `supabase/migrations/20260606000001_metering_phase_5.sql`
- Sidebar actual: `appNavigation.ts:107-130` (taxonomía customer-centric)
- Adapter framework: `integrations/types.ts` +
  `server/integrations/bootstrap.ts`
- Roadmap general: `docs/roadmap-execution-summary.md`
- Estado por ola: `docs/ola-{6,7,8}-*.md`
