# N-Pricing: Metodologia de Pricing FTP

> Documentacion funcional del motor de Funds Transfer Pricing.
>
> **Implementacion**: `utils/pricingEngine.ts` (orquestador principal), `utils/pricing/` (modulos: curveUtils, formulaEngine, liquidityEngine), `utils/pricingConstants.ts` (tablas regulatorias), `utils/rarocEngine.ts` (motor RAROC).

## 1. Concepto general

El **Funds Transfer Pricing (FTP)** es el mecanismo mediante el cual una institucion financiera asigna un coste/ingreso interno de transferencia a cada operacion. Separa el margen comercial del riesgo de tipo de interes y liquidez, permitiendo medir la rentabilidad real de cada linea de negocio.

```
Tasa Cliente = FTP + Margen Comercial
FTP = Tasa Base + Prima de Liquidez + Costes Regulatorios + Ajustes
```

## 2. Los 19 Componentes (Gaps)

### Gap 1: Seleccion de Formula por Producto

Cada producto tiene una formula FTP especifica segun su naturaleza:

| Producto | Base Rate | Liquidity Premium | Signo |
|----------|-----------|-------------------|-------|
| Activos largo plazo (>12M) | BR[min(BM,RM)] | LP(BM) | +1 |
| Activos corto plazo (<12M) | BR(DTM) | 50%LP(DTM) + 50%LP(1Y) | +1 |
| Activos colateralizados | BR(DTM) | (1-HC)·SecLP + HC·UnsecLP | +1 |
| Pasivos (depositos) | BR(BM) | LP(BM) | -1 |
| Fuera de balance | BR(DTM) | LP(DTM) | +1 |

**Ejemplo**: Un prestamo hipotecario a 20 anos con colateral soberano (haircut 5%):
- Base Rate = Curva swap interpolada a 20Y = 3.85%
- LP = 95% × LP_secured(20Y) + 5% × LP_unsecured(20Y) = 0.42%
- FTP = 3.85% + 0.42% = 4.27%

### Gap 2: Prima de Liquidez (LP)

La LP refleja el coste de financiacion a plazo. Se calcula interpolando en la curva de liquidez dual:

- **Curva unsecured**: Coste de financiacion mayorista sin colateral
- **Curva secured**: Coste con colateral (repos, covered bonds)

Cada punto de la curva tiene:
- `wholesaleSpread`: spread de mercado observable
- `termLP`: prima gestionada con floors aplicados

**Blended LP**: Para depositos con ratio SDR alto, se mezcla LP interna con wholesale:
```
BlendedLP = ExternalPct × WholesaleSpread + InternalPct × TermPremium
```
Se aplica suavizado rolling de 2 puntos.

### Gap 3: Liquidity Recharge (LR)

Asignacion del coste del buffer HQLA a cada unidad de negocio:

```
LR = TotalBufferCostBps × RiskAppetiteAddon × BU_Allocation_Weight
```

- `TotalBufferCostBps`: ~22 bps (coste del colchon HQLA total)
- `RiskAppetiteAddon`: 1.3x (margen de apetito al riesgo)
- `BU_Allocation_Weight`: 0-1 segun consumo de liquidez de cada BU

### Gap 4: Cargo por LCR (CLC — Credit Liquidity Cost)

Coste derivado de mantener activos liquidos para cumplir el LCR:

```
CLC = OutflowFactor × HQLA_Cost_BPS / 100
```

**Tabla de outflow** (Basilea III):

| Producto | Estabilidad | Outflow Factor |
|----------|-------------|---------------|
| Deposito CASA retail | Estable | 5% |
| Deposito CASA retail | Semi-estable | 10% |
| Deposito CASA retail | No estable | 20% |
| Deposito plazo corporate | Operacional | 25% |
| Deposito plazo corporate | No operacional | 40% |
| Deposito institucional | Financiero | 100% |
| Linea credito committed | Corporate | 10% |
| Linea credito committed | Financiero | 40% |

Para lineas de credito con importes no dispuestos:
```
CLC_ajustado = CLC × (1 + UndrawnRatio × 0.1)
```

### Gap 5: Cargo por NSFR

**Activos** (Required Stable Funding):
```
NSFRCharge = RSF_Factor × NSFR_Base_Cost_BPS / 100
```

| Tipo activo | RSF Factor |
|-------------|-----------|
| Prestamo corp <1Y | 50% |
| Prestamo corp >1Y, RW≤35% | 65% |
| Prestamo corp >1Y, RW>35% | 85% |
| Hipoteca RW≤35% | 65% |
| Credito consumo | 85% |

**Pasivos** (Available Stable Funding — beneficio):
```
NSFRBenefit = -(1 - ASF_Factor) × NSFR_Base_Cost_BPS / 100
```

| Tipo pasivo | ASF Factor |
|-------------|-----------|
| Deposito estable | 95% |
| Deposito semi-estable | 90% |
| Deposito no estable | 80% |
| Wholesale <6M | 0% |

### Gap 6: RAROC y Capital Income

**Formula RAROC**:
```
GrossRevenue = EAD × InterestSpread + FeeIncome
COF = EAD × FTP_Rate
OpCost = OutstandingAmt × OpCostPct
CapitalIncome = TotalRegCapital × RiskFreeRate

RiskAdjustedReturn = GrossRevenue - COF - ECL - OpCost + CapitalIncome

CreditRiskCapital = RWA × MinRegCapitalReq%
Pillar2Capital = EAD × Pillar2Charge%
OpRiskCapital = EAD × OpRiskCharge%
TotalRegCapital = CreditRiskCap + Pillar2Cap + OpRiskCap

RAROC = RiskAdjustedReturn / TotalRegCapital × 100
EVA = RAROC - HurdleRate
EconomicProfit = RiskAdjustedReturn - TotalRegCapital × HurdleRate%
```

**Niveles de aprobacion por RAROC**:

| RAROC | Nivel |
|-------|-------|
| ≥15% | Auto-aprobado |
| 10-15% | L1 Manager |
| 5-10% | L2 Committee |
| <5% | Rechazado |

### Gap 7: Bootstrap Zero Coupon

Convierte la curva par yield a tasas zero coupon para descontar flujos loan-level:
- Corto plazo (<12M): zero ≈ par (interes simple)
- Largo plazo: bootstrap iterativo con capitalizacion semestral

### Gap 8: LP Secured (Colateral)

Para operaciones con colateral:
```
LP = (1 - Haircut%) × SecuredLP + Haircut% × UnsecuredLP
```

Haircuts tipicos: Soberano 2-5%, Corporativo 10-15%, Cash 0%, Inmobiliario 20-40%.

### Gap 9: Tenors Efectivos (DTM, RM, BM)

- **DTM** (Duration to Maturity): plazo contractual en meses
- **RM** (Repricing Maturity): meses hasta proximo repricing
  - Fixed → RM = DTM
  - Monthly → RM = 1
  - Quarterly → RM = 3
- **BM** (Behavioral Maturity): madurez conductual del modelo
  - Override manual siempre prevalece
  - NMD Parametric: `BM = CoreRatio × 60 + (1-CoreRatio) × 1`
  - NMD Caterpillar: media ponderada de tramos de replicacion
  - Prepayment CPR: `BM = DTM × (1 - CPR × PenaltyExempt × 0.5)`

### Gap 10: Ajuste de Divisa (Basis)

Coste de swap cross-currency con escalado por tenor:
```
CurrencyAdj = BasisSpread × (0.5 + 0.5 × min(1, DTM/60))
```

| Divisa | Basis Spread |
|--------|-------------|
| EUR | -1.00% |
| GBP | -0.30% |
| JPY | -2.50% |
| CHF | -1.80% |

### Gap 11: Incentivacion

Subsidios/recargos por producto y segmento con vigencia temporal:
```
Incentive = SubsidyBps / 100  (si producto+segmento+fecha coinciden)
```

### Gap 12: Modulacion SDR

Para depositos, la LP se modula por el Stable Deposit Ratio:
```
LP_final = LP_base × max(0.5, 1 - max(0, SDR - Floor) × Multiplier)
```

Ejemplo: SDR=75%, Floor=60%, Multiplier=0.8 → Modulator = max(0.5, 1 - 0.15 × 0.8) = 0.88

### Gap 13: Portfolio Analytics

KPIs agregados por BU: LP neta (activos - pasivos), madurez media ponderada, % depositos estables, asignacion LR.

### Gap 14: Clasificacion de Estabilidad de Depositos

Auto-clasificacion cuando no se proporciona explicitamente:
- Operacional → Estable
- Retail/SME → Semi-estable
- Resto → No estable

### Gap 15: Repricing Maturity distinto de DTM

RM se resuelve independientemente del DTM contractual. Un prestamo a 5Y con repricing trimestral tiene DTM=60 pero RM=3.

### Gap 16: EAD (Exposure at Default)

EAD puede diferir del importe dispuesto. Si no se especifica, EAD = Amount.
Se usa en el calculo RAROC para capital regulatorio.

## 3. Flujo de calculo completo

```
1. Resolver tenors efectivos (DTM, RM, BM) ← modelos conductuales
2. Matchear deal con regla de pricing ← scoring por BU/producto/segmento/tenor
3. Determinar formula (Gap 1) ← regla o inferencia por producto
4. Calcular Base Rate + LP (Gaps 2, 8)
5. Ajuste de divisa (Gap 10)
6. Clasificar estabilidad depositos (Gap 14)
7. Calcular costes regulatorios: LCR (Gap 4), NSFR (Gap 5)
8. Calcular Liquidity Recharge (Gap 3)
9. Modulacion SDR para depositos (Gap 12)
10. Coste crediticio: PD × LGD por rating
11. Coste operacional (bps)
12. Capital charge: RW × K% × (ROE - Rf)
13. Ajustes ESG (transition + physical grids)
13b. Greenium / Movilizacion (Gap 17)
13c. DNSH Capital Discount (Gap 18)
13d. ISF Pillar I Overlay (Gap 19)
14. Strategic spread (regla + conductual)
15. Incentivacion (Gap 11)
16. Agregar:
    - FloorPrice = FTP + Credit + OpCost + ESG + Greenium + Strategic + LR + Incentive
    - EffectiveCapitalCharge = CapitalCharge - DNSHAdj - ISFAdj
    - TechnicalPrice = FloorPrice + EffectiveCapitalCharge
    - TargetPrice = TechnicalPrice + Buffer
    - FinalClientRate = FTP + MarginTarget
17. Calcular RAROC y nivel de aprobacion
18. Generar asiento contable
```

## 4. Modelos Conductuales

### NMD Replication (Parametric)
Para depositos a la vista sin vencimiento contractual:
- **Core Ratio**: % del saldo considerado estable (30-80%)
- **Beta Factor**: sensibilidad a tipos de mercado
- **Decay Rate**: velocidad de salida del saldo no estable
- BM = CoreRatio × 60M + (1-CoreRatio) × 1M

### NMD Replication (Caterpillar)
Perfil de replicacion por tramos ponderados:
```
Tramo 1: 40% a 1M
Tramo 2: 30% a 1Y
Tramo 3: 20% a 3Y
Tramo 4: 10% a 5Y
```
BM = media ponderada de los tenors de cada tramo.

### Prepayment CPR
Para hipotecas con opcion de amortizacion anticipada:
- **CPR**: tasa de prepago condicional anualizada (%)
- **Penalty Exempt**: % de prepago exento de penalizacion
- BM = DTM × (1 - CPR% × PenaltyExempt% × 0.5)

## 5. Sistema de Reglas

El motor matchea cada operacion con la regla mas especifica usando scoring:

| Criterio | Puntuacion |
|----------|-----------|
| Business Unit match | +10 |
| Producto match | +10 |
| Segmento match | +5 |
| Tenor match | +5 |

**Maxima puntuacion posible**: 30 puntos.

Si no hay regla que matchee:
- Tipo fijo → Matched Maturity
- Tipo variable → Moving Average

Condiciones de tenor soportadas: `<12M`, `>36M`, `12-36M`, `Any`.

## 6. Ajustes ESG

### Riesgo de Transicion
| Clasificacion | Ajuste tipico |
|---------------|--------------|
| Green | -15 bps (incentivo) |
| Neutral | 0 bps |
| Amber | +5 a +10 bps |
| Brown | +10 a +25 bps |

### Riesgo Fisico
| Nivel | Ajuste tipico |
|-------|--------------|
| Low | 0 bps |
| Medium | +5 bps |
| High | +15 a +20 bps |

### Gap 17: Greenium / Movilizacion

Descuento estrategico para operaciones con formato green verificado. Se busca en la GreeniumGrid por tipo de formato:

| Formato | Ajuste tipico |
|---------|--------------|
| Green Bond (EU GBS) | -20 bps |
| Green Loan (LMA GLP) | -15 bps |
| Sustainability-Linked | -10 bps |
| Social Bond | -8 bps |

```
GreeniumAdj = GreeniumGrid[greenFormat].adjustmentBps / 100
```

El ajuste es negativo (incentivo) y se suma al floor price, reduciendo el coste total.

**Referencia**: Marcos Rodriguez — los bps de descuento por formato Green ya son practica de mercado estandar.

### Gap 18: Descuento de Capital DNSH

Reduccion del capital charge para operaciones que cumplen el principio DNSH (Do No Significant Harm) del Reglamento de Taxonomia (Art. 17):

```
DNSHCapitalAdj = CapitalCharge × (1 - DNSH_CAPITAL_DISCOUNT_FACTOR)
EffectiveCapitalCharge = CapitalCharge - DNSHCapitalAdj
```

- `DNSH_CAPITAL_DISCOUNT_FACTOR`: 0.85 (descuento del 15% sobre el capital charge)
- Solo se aplica si `dnshCompliant = true`

**Referencia**: Martin Sanz — descuentos en cost of capital por cumplimiento DNSH.

### Gap 19: ESG Pillar I — Infrastructure Supporting Factor

El ISF (Art. 501a CRR2) permite reducir la ponderacion de riesgo en un 25% para exposiciones de infraestructura que cumplan criterios de elegibilidad:

```
ISF_RW_Factor = 0.75
ISF_CapitalCharge = (RW × ISF_RW_Factor / 100) × K% × max(0, ROE − Rf)
Pillar1Adj = CapitalCharge - ISF_CapitalCharge
```

**Criterios de elegibilidad** (simplificados):
- Operaciones de Project Finance o infraestructura
- Activos que generan flujos predecibles
- Deal marcado como `isfEligible = true`

**Referencia**: Marcos Rodriguez — impacto de overlays en rating / modelos IRB (fisico, transicion, ambiental) + medidas Pillar I ESG (ej. ISF en Project Finance).
