# M2 — Credit Risk & Anejo IX Engine

## Spec for NEXUS-PRICE

**Fecha:** 7 de abril de 2026
**Autor:** NFQ Advisory
**Estado:** Draft v1

---

## 1. Objetivo

Motor de riesgo de crédito que calcula el **coste esperado de provisiones (EL)** para cada operación y lo integra en el waterfall de pricing. Coexiste con el motor IFRS 9 de la entidad (modo espejo) o funciona de forma autónoma con las soluciones alternativas del Banco de España (modo nativo).

**Problema que resuelve:** Hoy la mayoría de bancos españoles pricean operaciones sin incorporar el coste real de provisión Anejo IX. El spread de crédito en el pricing es un porcentaje fijo por segmento, no un cálculo dinámico basado en PD/LGD/EAD de la operación concreta. Esto genera:
- Operaciones pricedadas por debajo de su coste real de provisión
- Desalineación entre pricing y dotación IFRS 9
- Incapacidad de cuantificar el impacto de cambios macro en el pricing

**Output principal:** Para cada operación, M2 produce:

```
EL_pricing = EL_12m (Stage 1)   →  coste anual de provisión esperado
EL_lifetime                     →  coste total de provisión over life
Day_1_provision                 →  dotación día 1 (Stage 1 ECL at origination)
Migration_cost                  →  coste esperado de migración a Stage 2/3
Capital_charge_credit           →  cargo de capital por riesgo de crédito (vía CapitalEngine)
```

Estos outputs alimentan el waterfall de M5 (Pricing Calculator):
```
FTP base rate
+ Liquidity Premium
+ Strategic Spread
+ EL_pricing (anual)           ← M2
+ Capital Charge (credit RWA)  ← M2 → M3 (CapitalEngine)
+ OpEx
+ Regulatory charges
= Floor Price
```

---

## 2. Modos de operación

### 2.1 Modo espejo (entidades con motor IFRS 9 propio)

Consume parámetros del motor interno del banco vía API:

| Parámetro | Fuente | Granularidad |
|-----------|--------|-------------|
| PD 12m | Motor IFRS 9 del banco | Rating grade x segmento |
| PD lifetime (term structure) | Motor IFRS 9 | Rating x tenor x escenario |
| LGD | Motor IFRS 9 | Tipo garantía x seniority |
| CCF | Motor IFRS 9 | Tipo producto x commitment |
| Escenarios macro | Motor IFRS 9 / Planificación | 3-4 escenarios con pesos |
| Stage actual | Motor IFRS 9 | Por operación (cartera existente) |

**Ventaja:** Garantiza que pricing y provisión hablan exactamente el mismo idioma. El banco no necesita mantener dos juegos de parámetros.

**API contract (input):**
```typescript
interface CreditParamsFromBank {
  pd12m: number;                    // PD a 12 meses (0.0005 = 5 bps)
  pdTermStructure: PdTermPoint[];   // Curva PD acumulativa por periodo
  lgd: number;                      // LGD (0.40 = 40%)
  ccf: number;                      // CCF para off-balance (0.40 = 40%)
  stage: 1 | 2 | 3;                // Stage IFRS 9 actual (para cartera existente)
  internalRating: string;           // Rating interno del banco
  scenarios: MacroScenario[];       // Escenarios con pesos
}

interface PdTermPoint {
  periodMonths: number;   // 12, 24, 36, ...
  cumulativePd: number;   // PD acumulativa hasta ese periodo
}

interface MacroScenario {
  id: string;             // 'base' | 'optimistic' | 'pessimistic' | 'severe'
  weight: number;         // 0.50, 0.25, 0.20, 0.05
  pdAdjustmentFactor: number;  // multiplicador sobre PD TTC → PIT
}
```

### 2.2 Modo nativo (soluciones alternativas BdE)

Implementa out-of-the-box los parámetros de la Circular 4/2017 (actualizada por Circular 6/2021). No requiere motor IFRS 9 externo.

El modo nativo usa las **soluciones alternativas** del Banco de España, que son coberturas fijas por segmento y stage. Esto permite a entidades sin modelos internos avanzados pricear con parámetros regulatorios validados.

---

## 3. Segmentos de riesgo (Anejo IX)

| # | Segmento | ID interno | Productos típicos |
|---|----------|-----------|-------------------|
| 1 | Construcción y promoción inmobiliaria | `CONSTRUCTION` | Promotor, suelo, obra nueva |
| 2 | Obra civil | `CIVIL_WORKS` | Infraestructuras, concesiones |
| 3 | Grandes empresas | `LARGE_CORPORATE` | Facturación > 50M EUR |
| 4 | PYMEs | `SME` | Facturación < 50M EUR |
| 5 | Empresarios individuales | `SELF_EMPLOYED` | Autónomos |
| 6 | Hipotecario residencial LTV <= 80% | `MORTGAGE_LOW_LTV` | Hipoteca vivienda habitual |
| 7 | Hipotecario residencial LTV > 80% | `MORTGAGE_HIGH_LTV` | Hipoteca alto LTV |
| 8 | Crédito al consumo | `CONSUMER` | Préstamos personales |
| 9 | Tarjetas de crédito | `CREDIT_CARDS` | Revolving, tarjetas |
| 10 | Sector público | `PUBLIC_SECTOR` | Administraciones, entes públicos |
| 11 | Financiación especializada | `SPECIALIZED` | Project finance, shipping, aviación |
| 12 | Otros | `OTHER` | Resto |

**Mapping automático:** M2 clasifica cada operación en su segmento a partir de `productType`, `clientType`, `collateralType` y `ltvPct` del deal. Reglas configurables.

---

## 4. Soluciones alternativas — Coberturas por segmento y stage

### 4.1 Stage 1 — Riesgo Normal

| Segmento | Cobertura (%) |
|----------|--------------|
| Construcción y promoción | 1.9% |
| Obra civil | 2.0% |
| Grandes empresas | 0.6% |
| PYMEs | 1.1% |
| Empresarios individuales | 1.4% |
| Hipotecario residencial | 0.7% |
| Crédito al consumo | 1.8% |
| Tarjetas de crédito | 1.0% |
| Sector público | 0.0% |
| Financiación especializada | 1.5% |

Se aplica sobre el **valor contable bruto no cubierto por garantías eficaces**.

### 4.2 Stage 2 — Vigilancia Especial

| Segmento | Cobertura (%) |
|----------|--------------|
| Construcción y promoción | 30.0% |
| Obra civil | 18.8% |
| Grandes empresas | 15.0% |
| PYMEs | 17.8% |
| Empresarios individuales | 16.0% |
| Hipotecario residencial | 18.0% |
| Crédito al consumo | 20.2% |
| Tarjetas de crédito | 18.0% |
| Sector público | 3.0% |
| Financiación especializada | 20.0% |

### 4.3 Stage 3 — Dudoso (por antigüedad en mora)

Coberturas crecientes con el tiempo en default. Aplicadas sobre exposición neta de garantías eficaces.

| Antigüedad | Hipot. Resid. | Consumo | Tarjetas | PYMEs | Grandes Emp. | Construcción |
|------------|--------------|---------|----------|-------|-------------|-------------|
| > 3 meses | 25% | 25% | 25% | 25% | 25% | 25% |
| > 6 meses | 35% | 45% | 45% | 40% | 35% | 50% |
| > 9 meses | 45% | 60% | 60% | 55% | 50% | 60% |
| > 12 meses | 55% | 75% | 75% | 67% | 60% | 75% |
| > 18 meses | 75% | 90% | 90% | 80% | 75% | 85% |
| > 24 meses | 95% | 100% | 100% | 95% | 90% | 95% |

**Fuente:** Circular 6/2021 (BOE-A-2021-21666), tablas del Anejo IX actualizado.

---

## 5. Tratamiento de garantías

### 5.1 Tipos de garantías eficaces

| Tipo | ID | Tratamiento en provisión |
|------|-----|--------------------------|
| Hipotecaria inmobiliaria | `MORTGAGE` | Reduce base de exposición según LTV y tipo inmueble |
| Pignoraticia financiera | `FINANCIAL_PLEDGE` | Deducción casi total (depósitos, valores) |
| Personal / aval | `PERSONAL_GUARANTEE` | Reclasifica exposición al perfil del garante |
| Pública (ICO, CESCE, FEI) | `PUBLIC_GUARANTEE` | Reclasifica porción garantizada a sector público |

### 5.2 Haircuts por tipo de inmueble (garantía hipotecaria)

Aplicados sobre el valor de referencia (tasación):

| Tipo de inmueble | Haircut sobre tasación |
|------------------|----------------------|
| Vivienda terminada | 25% |
| Local comercial / oficinas | 30% |
| Suelo urbano / urbanizable | 35% |
| Otros inmuebles | 40% |

### 5.3 Recortes por LTV

Para hipotecas residenciales:

| LTV | Tratamiento |
|-----|-------------|
| <= 80% | Segmento favorable (`MORTGAGE_LOW_LTV`). Valor de garantía = min(Tasación × (1 - haircut), Deuda) |
| > 80% | Segmento desfavorable (`MORTGAGE_HIGH_LTV`). La porción que excede 80% LTV no tiene beneficio de garantía |

### 5.4 Antigüedad de tasación

| Antigüedad de tasación | Factor de ajuste |
|----------------------|------------------|
| < 1 año | 100% (sin descuento adicional) |
| 1-2 años | 95% |
| 2-3 años | 90% |
| > 3 años | Requiere retasación. Aplicar HPI acumulado como proxy |

### 5.5 Cálculo de exposición neta

```
Exposicion_bruta = Outstanding + CCF × Undrawn_commitment

Garantia_eficaz = min(
  Valor_tasacion × (1 - Haircut_inmueble) × Factor_antiguedad × min(1, 0.80 / LTV),
  Exposicion_bruta
)

Exposicion_neta = Exposicion_bruta - Garantia_eficaz

Provision = Exposicion_neta × Coverage_pct[segment][stage]
```

---

## 6. Clasificación en stages (SICR triggers)

### 6.1 Stage 1 → Stage 2 (Vigilancia Especial)

Triggers cuantitativos:
- **> 30 DPD** (backstop regulatorio)
- **Delta PD significativo**: PD actual / PD at origination > umbral configurable (típico: 2.5x para investment grade, 2.0x para speculative)
- **Downgrade de rating**: >= 3 notches desde origination

Triggers cualitativos:
- Refinanciación / reestructuración activa
- Inclusión en watchlist
- Deterioro significativo de la situación económica del deudor
- Indicadores sectoriales/geográficos adversos
- Forward-looking: deterioro macro que afecta al segmento

### 6.2 Stage 2 → Stage 3 (Dudoso)

- **> 90 DPD** (backstop)
- Concurso de acreedores
- Duda razonable sobre el cobro total
- Deterioro severo que hace probable el impago

### 6.3 Impacto en pricing de nueva producción

Para **operaciones nuevas**, M2 calcula:
1. **EL Stage 1** = PD_12m × LGD × EAD (provisión anual esperada)
2. **Probabilidad de migración a Stage 2** en el horizonte de la operación
3. **Coste esperado de migración** = P(S2) × [Coverage_S2 - Coverage_S1] × EAD + P(S3) × [Coverage_S3_avg - Coverage_S1] × EAD
4. **Day 1 provision** = EL Stage 1 (impacto en P&L día de alta)
5. **EL lifetime** para comparar con el spread de crédito cobrado

```
Credit_cost_annual = EL_12m + Amortized_migration_cost

Migration_cost = SUM over t=1..T [
  P(migrate_to_S2 at t) × (Coverage_S2 - Coverage_S1) × EAD(t) × DF(t)
  + P(migrate_to_S3 at t) × (Coverage_S3(t) - Coverage_S1) × EAD(t) × DF(t)
]
```

---

## 7. Forward-looking y escenarios macro

### 7.1 Variables macroeconómicas (España)

| Variable | ID | Fuente típica |
|----------|-----|--------------|
| PIB real (crecimiento) | `GDP_GROWTH` | BdE / BCE proyecciones |
| Tasa de paro | `UNEMPLOYMENT` | EPA / BdE |
| Euribor 12M | `EURIBOR_12M` | Mercado / BCE forward |
| Índice de precios de vivienda (HPI) | `HPI` | INE / BdE |
| IPC (inflación) | `CPI` | INE |

### 7.2 Escenarios

| Escenario | Peso típico | Descripción |
|-----------|-------------|-------------|
| Base | 50-60% | Proyección central del banco |
| Optimista | 20-25% | Escenario favorable |
| Pesimista | 20-25% | Escenario adverso (ICAAP) |
| Severo (opcional) | 5-10% | Cola de distribución |

### 7.3 Ajuste PD TTC → PIT

En **modo nativo**, el ajuste forward-looking se aplica como factor multiplicativo sobre las coberturas base:

```
Coverage_adjusted = Coverage_base × Scenario_factor

EL_weighted = SUM over scenarios [ weight_i × Coverage_adjusted_i × EAD ]
```

Donde `Scenario_factor` se calibra históricamente regresando tasas de impago observadas contra variables macro.

En **modo espejo**, el ajuste ya viene incorporado en los PD PIT que suministra el banco.

---

## 8. Integración con M3 (CapitalEngine)

M2 calcula los parámetros de crédito que M3 necesita para el cargo de capital:

```
M2 produce: PD, LGD, EAD, Maturity, Collateral info
     ↓
M3 (CapitalEngine) calcula:
  - RWA_IRB = f(PD, LGD, R, M, EAD)  [fórmula Basel IRB]
  - RWA_SA = EAD × RW(exposure_class, rating, LTV)
  - TREA = max(RWA_IRB, Floor% × RWA_SA)
  - Capital_charge = TREA × Total_capital_ratio × Cost_of_equity / EAD
     ↓
M5 (Pricing Calculator) incluye Capital_charge en el waterfall
```

### 8.1 Fórmula IRB (referencia)

```
K = LGD × N[(1/(1-R))^0.5 × G(PD) + (R/(1-R))^0.5 × G(0.999)] - PD × LGD
    × [(1 + (M - 2.5) × b) / (1 - 1.5 × b)]

b = [0.11852 - 0.05478 × ln(PD)]²

RW = K × 12.5 × 1.06
RWA = RW × EAD
```

### 8.2 Output floor CRR3 (phase-in)

| Año | Floor | Cap sobre incremento RWA |
|-----|-------|--------------------------|
| 2025 | 50.0% | 25% |
| 2026 | 55.0% | 25% |
| 2027 | 60.0% | 25% |
| 2028 | 65.0% | Phase-out |
| 2029 | 67.5% | Expira 31/12/2029 |
| 2030+ | 72.5% | Sin cap |

### 8.3 Stack de capital (bancos españoles típico)

| Buffer | % |
|--------|---|
| CET1 mínimo | 4.50% |
| Buffer de conservación | 2.50% |
| P2R (Pilar 2) | 1.00-3.00% (SREP) |
| Contracíclico (BdE) | 0.00-0.50% |
| Sistémico (O-SII) | 0.25-1.00% |
| Buffer de gestión | 0.50-1.50% |
| **Total típico** | **10.50-14.00%** |

---

## 9. Arquitectura del cálculo

### 9.1 Flujo de datos

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Deal Input      │────▶│  M2 - Credit     │────▶│  M5 - Pricing   │
│  (from M5)       │     │  Risk Engine     │     │  Waterfall      │
│                  │     │                  │     │                 │
│  - clientId      │     │  1. Classify     │     │  + EL_annual    │
│  - productType   │     │     segment      │     │  + Day1 prov.   │
│  - amount        │     │  2. Get PD/LGD   │     │  + Capital chg  │
│  - tenor         │     │  3. Apply        │     │                 │
│  - collateral    │     │     guarantees   │     └─────────────────┘
│  - ltvPct        │     │  4. Calc ECL     │
│  - rating        │     │  5. Calc         │────▶┌─────────────────┐
│                  │     │     migration    │     │  M3 - Capital   │
└─────────────────┘     │  6. Forward-     │     │  Engine         │
                        │     looking adj  │     │  (RWA, floor)   │
┌─────────────────┐     │  7. Output       │     └─────────────────┘
│  Parameters      │────▶│     credit cost  │
│  (config/API)    │     └──────────────────┘
│                  │
│  - PD tables     │
│  - LGD tables    │
│  - Anejo IX      │
│    coverages     │
│  - Guarantee     │
│    haircuts      │
│  - Macro         │
│    scenarios     │
└─────────────────┘
```

### 9.2 Interface de salida

```typescript
interface CreditRiskResult {
  // Clasificación
  anejoSegment: AnejoSegment;
  stage: 1 | 2 | 3;
  stageReason?: string;

  // Parámetros utilizados
  pd12m: number;
  pdLifetime: number;
  lgd: number;
  ead: number;
  ccf: number;

  // Garantías
  grossExposure: number;
  effectiveGuarantee: number;
  netExposure: number;
  guaranteeType: GuaranteeType | null;
  ltvPct: number;
  guaranteeHaircut: number;

  // ECL
  el12m: number;              // EL a 12 meses (Stage 1)
  elLifetime: number;         // EL lifetime
  day1Provision: number;      // Dotación día 1
  coveragePctApplied: number; // % de cobertura aplicado (Anejo IX o modelo)

  // Coste de migración
  migrationCostAnnual: number;   // Coste anualizado de migración esperada
  pMigrateS2: number;            // Prob. de migrar a Stage 2
  pMigrateS3: number;            // Prob. de migrar a Stage 3

  // Para waterfall de pricing
  creditCostAnnualBps: number;   // (el12m + migrationCostAnnual) / ead × 10000
  day1ProvisionBps: number;      // day1Provision / ead × 10000

  // Para M3 (CapitalEngine)
  capitalParams: {
    pd: number;           // PD ajustada (floor-applied)
    lgd: number;          // LGD para IRB
    ead: number;
    maturityYears: number;
    exposureClass: string; // CORPORATE, RETAIL_MORTGAGE, etc.
    collateralType: string;
  };

  // Trazabilidad
  mode: 'mirror' | 'native';
  parameterVersion: string;
  scenariosUsed: { id: string; weight: number }[];
  calculationTimestamp: string;
}
```

---

## 10. Productos con tratamiento específico

### 10.1 Hipoteca (fija, variable, mixta)

- Segmento por LTV (<=80% vs >80%)
- Garantía hipotecaria con haircuts por tipo inmueble y antigüedad tasación
- Prepago modelado vía CPR (integración con M1 behavioral models)
- Bonificaciones cruzadas: si hay nómina/seguros vinculados, ajuste de PD por fidelización

### 10.2 Tarjetas revolving

- Segmento `CREDIT_CARDS`
- EAD = Drawn + CCF × (Limit - Drawn); CCF = 40% (SA) ajustable
- Tratamiento específico de TAE conforme jurisprudencia TS (sentencias usura)
- Stage 2 trigger adicional: utilización > 90% del límite de forma persistente

### 10.3 Líneas de crédito y compromisos no dispuestos

- CCF aplicado sobre porción no dispuesta
- CCF = 10% (incondicional cancelable, phase-in hasta 2029) / 40% (resto)
- EL calculado sobre EAD completo (dispuesto + CCF × no dispuesto)
- Contingent liquidity charge adicional en M1 (FTP)

### 10.4 Avales y garantías emitidas

- CCF = 100% (sustituto directo de crédito) / 50% (performance bonds)
- Exposición off-balance convertida a on-balance equivalente
- PD del deudor principal, no del beneficiario

### 10.5 Financiación especializada (Slotting)

- Para entidades sin modelo IRB aprobado: Slotting categories (Strong/Good/Satisfactory/Weak)
- Supervisory risk weights: 50% / 70% / 115% / 250%
- Provisión via solución alternativa segmento `SPECIALIZED` o PD implícita del slot

---

## 11. Parámetros configurables

### 11.1 Por entidad (multi-tenant)

| Parámetro | Tipo | Default |
|-----------|------|---------|
| Modo operación | `mirror` / `native` | `native` |
| Enfoque capital (SA/F-IRB/A-IRB) | por exposure class | `SA` |
| Cost of equity | % | 11.0% |
| Total capital ratio | % | 12.5% |
| P2R (SREP) | % | 1.50% |
| Buffer contracíclico | % | 0.00% |
| Buffer O-SII | % | 0.50% |
| Management buffer | % | 1.00% |
| Umbral SICR (delta PD) | multiplicador | 2.5x |
| Escenarios macro + pesos | configuración | 3 escenarios |

### 11.2 Por segmento (override)

| Parámetro | Tipo |
|-----------|------|
| PD override (modo nativo) | % por rating grade |
| LGD override | % por tipo garantía |
| Coverage override Stage 1/2 | % (si difiere de Anejo IX) |
| Haircut inmueble override | % |

---

## 12. Referencias regulatorias

| Referencia | Contenido |
|-----------|-----------|
| Circular 4/2017 BdE | Marco general Anejo IX |
| Circular 6/2021 BdE (BOE-A-2021-21666) | Actualización coberturas y tablas |
| IFRS 9 / NIIF 9 | Marco ECL (12m y lifetime) |
| EBA GL/2017/06 | Directrices sobre definición de default |
| CRR3 (Regulation 2024/1623) | Output floor, input floors, SA risk weights |
| EBA GL/2022/14 | IRRBB y CSRBB |
| BCBS CRE31 | Fórmulas IRB |

---

## 13. Dependencias con otros módulos

| Módulo | M2 consume | M2 produce |
|--------|-----------|------------|
| **M1** (FTP Engine) | Behavioral maturity (BM), curva FTP | - |
| **M3** (CapitalEngine) | - | PD, LGD, EAD, exposure class → para cálculo RWA |
| **M5** (Pricing Calculator) | Deal params | creditCostAnnualBps, day1ProvisionBps, capitalParams |
| **M8** (Governance) | - | Cambios de parámetros requieren aprobación |
| **M10** (Model Governance) | - | Backtesting de PD/LGD predichos vs observados |

---

## 14. Implementación incremental sugerida

### Sprint 1 (4 semanas): Modo nativo básico
- Tablas de coberturas Anejo IX (Stage 1/2/3)
- Clasificación automática de segmento
- Cálculo de EL Stage 1 para nueva producción
- Integración en waterfall de pricing (creditCostAnnualBps)

### Sprint 2 (4 semanas): Garantías y LTV
- Motor de garantías eficaces (hipotecaria, pignoraticia, personal, pública)
- Haircuts por tipo inmueble y antigüedad tasación
- Exposición neta con ajuste LTV
- Split hipotecario <=80% / >80%

### Sprint 3 (4 semanas): Forward-looking y migración
- Escenarios macro configurables
- Ajuste PD TTC → PIT
- Cálculo de coste de migración Stage 1 → 2 → 3
- Day 1 provision
- EL lifetime

### Sprint 4 (4 semanas): Modo espejo + integración M3
- API para consumir PD/LGD/EAD del banco
- Conector con CapitalEngine (M3) para RWA
- Output floor aplicado en capital charge
- Reconciliación provisión vs capital

### Sprint 5 (4 semanas): Productos específicos + backtesting
- Tratamiento tarjetas revolving
- Líneas de crédito y compromisos
- Slotting para financiación especializada
- Backtesting básico (PD predicha vs observada)
