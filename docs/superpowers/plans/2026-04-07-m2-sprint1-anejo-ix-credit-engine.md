# M2 Sprint 1: Anejo IX Credit Risk Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Anejo IX credit risk engine that classifies deals into BdE segments, applies regulatory coverage tables, and integrates the credit cost into the FTP pricing waterfall — replacing the current flat PD×LGD calculation.

**Architecture:** New `utils/pricing/creditRiskEngine.ts` module follows the same pure-function pattern as `formulaEngine.ts` and `liquidityEngine.ts`. Anejo IX coverage tables live in `constants/anejoIX.ts`. The engine classifies deals by segment, computes Stage 1 EL (Expected Loss), and returns a `CreditRiskResult` that `pricingEngine.ts` maps into `FTPResult.regulatoryCost`. No external dependencies — pure TypeScript calculations.

**Tech Stack:** TypeScript, Vitest, existing N-Pricing patterns.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `constants/anejoIX.ts` | Create | Anejo IX segment definitions, coverage tables (Stage 1/2/3), guarantee haircuts |
| `utils/pricing/creditRiskEngine.ts` | Create | Core engine: segment classification, EL calculation, guarantee netting |
| `utils/__tests__/creditRiskEngine.test.ts` | Create | Unit tests for segment classification, coverage lookups, EL calculation |
| `types.ts` | Modify | Add `CreditRiskResult` interface, add `anejoSegment` field to `FTPResult` |
| `utils/pricingEngine.ts` | Modify | Replace `calculateCreditCost()` call with `calculateAnejoCreditRisk()` |
| `components/Calculator/PricingReceipt.tsx` | Modify | Update waterfall to show Anejo IX credit cost with segment label |
| `translations.ts` | Modify | Add ~10 keys for Anejo IX labels (en/es) |

---

### Task 1: Anejo IX Coverage Tables

**Files:**
- Create: `constants/anejoIX.ts`

- [ ] **Step 1: Create the Anejo IX constants file with segment definitions**

```typescript
// constants/anejoIX.ts

/**
 * Anejo IX (Circular 4/2017, updated by Circular 6/2021)
 * Banco de España credit risk provisioning framework.
 * "Soluciones alternativas" — regulatory coverage percentages by segment and stage.
 */

export type AnejoSegment =
  | 'CONSTRUCTION'
  | 'CIVIL_WORKS'
  | 'LARGE_CORPORATE'
  | 'SME'
  | 'SELF_EMPLOYED'
  | 'MORTGAGE_LOW_LTV'
  | 'MORTGAGE_HIGH_LTV'
  | 'CONSUMER'
  | 'CREDIT_CARDS'
  | 'PUBLIC_SECTOR'
  | 'SPECIALIZED'
  | 'OTHER';

export interface AnejoSegmentDef {
  id: AnejoSegment;
  label: string;
  /** Stage 1 coverage (%) applied to net exposure */
  stage1Coverage: number;
  /** Stage 2 coverage (%) applied to net exposure */
  stage2Coverage: number;
}

/**
 * Coverage percentages per segment for Stage 1 and Stage 2.
 * Source: Circular 6/2021 (BOE-A-2021-21666), effective June 30, 2022.
 * Applied to gross book value not covered by effective guarantees.
 */
export const ANEJO_SEGMENTS: Record<AnejoSegment, AnejoSegmentDef> = {
  CONSTRUCTION:      { id: 'CONSTRUCTION',      label: 'Construcción y promoción', stage1Coverage: 1.9,  stage2Coverage: 30.0 },
  CIVIL_WORKS:       { id: 'CIVIL_WORKS',       label: 'Obra civil',              stage1Coverage: 2.0,  stage2Coverage: 18.8 },
  LARGE_CORPORATE:   { id: 'LARGE_CORPORATE',   label: 'Grandes empresas',        stage1Coverage: 0.6,  stage2Coverage: 15.0 },
  SME:               { id: 'SME',               label: 'PYMEs',                   stage1Coverage: 1.1,  stage2Coverage: 17.8 },
  SELF_EMPLOYED:     { id: 'SELF_EMPLOYED',      label: 'Empresarios individuales', stage1Coverage: 1.4, stage2Coverage: 16.0 },
  MORTGAGE_LOW_LTV:  { id: 'MORTGAGE_LOW_LTV',  label: 'Hipotecario (LTV ≤ 80%)', stage1Coverage: 0.7,  stage2Coverage: 18.0 },
  MORTGAGE_HIGH_LTV: { id: 'MORTGAGE_HIGH_LTV', label: 'Hipotecario (LTV > 80%)', stage1Coverage: 0.7,  stage2Coverage: 18.0 },
  CONSUMER:          { id: 'CONSUMER',           label: 'Crédito al consumo',      stage1Coverage: 1.8,  stage2Coverage: 20.2 },
  CREDIT_CARDS:      { id: 'CREDIT_CARDS',       label: 'Tarjetas de crédito',     stage1Coverage: 1.0,  stage2Coverage: 18.0 },
  PUBLIC_SECTOR:     { id: 'PUBLIC_SECTOR',      label: 'Sector público',          stage1Coverage: 0.0,  stage2Coverage: 3.0 },
  SPECIALIZED:       { id: 'SPECIALIZED',        label: 'Financiación especializada', stage1Coverage: 1.5, stage2Coverage: 20.0 },
  OTHER:             { id: 'OTHER',              label: 'Otros',                   stage1Coverage: 1.1,  stage2Coverage: 17.0 },
};

/**
 * Stage 3 coverage (%) by aging in default, per segment.
 * Keys are the minimum months overdue. Applied to net exposure.
 * Source: Circular 6/2021 doubtful aging schedule.
 */
export const STAGE3_AGING_COVERAGE: Record<AnejoSegment, Record<number, number>> = {
  CONSTRUCTION:      { 3: 25, 6: 50, 9: 60, 12: 75, 18: 85, 24: 95 },
  CIVIL_WORKS:       { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  LARGE_CORPORATE:   { 3: 25, 6: 35, 9: 50, 12: 60, 18: 75, 24: 90 },
  SME:               { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  SELF_EMPLOYED:     { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
  MORTGAGE_LOW_LTV:  { 3: 25, 6: 35, 9: 45, 12: 55, 18: 75, 24: 95 },
  MORTGAGE_HIGH_LTV: { 3: 25, 6: 40, 9: 50, 12: 60, 18: 80, 24: 95 },
  CONSUMER:          { 3: 25, 6: 45, 9: 60, 12: 75, 18: 90, 24: 100 },
  CREDIT_CARDS:      { 3: 25, 6: 45, 9: 60, 12: 75, 18: 90, 24: 100 },
  PUBLIC_SECTOR:     { 3: 10, 6: 20, 9: 30, 12: 40, 18: 60, 24: 80 },
  SPECIALIZED:       { 3: 25, 6: 45, 9: 55, 12: 67, 18: 80, 24: 95 },
  OTHER:             { 3: 25, 6: 40, 9: 55, 12: 67, 18: 80, 24: 95 },
};

/**
 * Guarantee haircuts by property type (for mortgage collateral).
 * Applied to appraisal value before netting against exposure.
 */
export const GUARANTEE_HAIRCUTS: Record<string, number> = {
  RESIDENTIAL_FINISHED: 0.25,
  COMMERCIAL_OFFICE:    0.30,
  URBAN_LAND:           0.35,
  OTHER_PROPERTY:       0.40,
};

/** LTV threshold for favorable mortgage segment classification */
export const MORTGAGE_LTV_THRESHOLD = 0.80;
```

- [ ] **Step 2: Commit**

```bash
git add constants/anejoIX.ts
git commit -m "feat(m2): add Anejo IX coverage tables and segment definitions

Circular 4/2017 updated by Circular 6/2021 (BOE-A-2021-21666).
Includes Stage 1/2/3 coverage by segment and guarantee haircuts."
```

---

### Task 2: CreditRiskResult Type

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add CreditRiskResult interface and anejoSegment to FTPResult**

Add before the `FTPResult` interface in `types.ts`:

```typescript
// ── Credit Risk (Anejo IX) ────────────────────────────────────────────────
export interface CreditRiskResult {
  anejoSegment: string;
  stage: 1 | 2 | 3;
  grossExposure: number;
  effectiveGuarantee: number;
  netExposure: number;
  coveragePct: number;
  el12m: number;
  creditCostAnnualPct: number;
}
```

Add a new field to the `FTPResult` interface:

```typescript
  anejoSegment?: string;
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (new type is additive, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(m2): add CreditRiskResult type and anejoSegment to FTPResult"
```

---

### Task 3: Credit Risk Engine — Core

**Files:**
- Create: `utils/pricing/creditRiskEngine.ts`
- Test: `utils/__tests__/creditRiskEngine.test.ts`

- [ ] **Step 1: Write failing tests for segment classification**

```typescript
// utils/__tests__/creditRiskEngine.test.ts
import { describe, it, expect } from 'vitest';
import { classifyAnejoSegment } from '../pricing/creditRiskEngine';

describe('classifyAnejoSegment', () => {
  it('classifies residential mortgage with low LTV', () => {
    expect(classifyAnejoSegment('Mortgage', 'Retail', 0.65)).toBe('MORTGAGE_LOW_LTV');
  });

  it('classifies residential mortgage with high LTV', () => {
    expect(classifyAnejoSegment('Mortgage', 'Retail', 0.90)).toBe('MORTGAGE_HIGH_LTV');
  });

  it('classifies consumer credit', () => {
    expect(classifyAnejoSegment('Consumer Loan', 'Retail')).toBe('CONSUMER');
  });

  it('classifies credit cards', () => {
    expect(classifyAnejoSegment('Credit Card', 'Retail')).toBe('CREDIT_CARDS');
  });

  it('classifies large corporate', () => {
    expect(classifyAnejoSegment('Commercial Loan', 'Corporate')).toBe('LARGE_CORPORATE');
  });

  it('classifies SME', () => {
    expect(classifyAnejoSegment('Commercial Loan', 'SME')).toBe('SME');
  });

  it('classifies public sector', () => {
    expect(classifyAnejoSegment('Commercial Loan', 'Gov')).toBe('PUBLIC_SECTOR');
  });

  it('defaults to OTHER for unknown combinations', () => {
    expect(classifyAnejoSegment('Unknown', 'Unknown')).toBe('OTHER');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run utils/__tests__/creditRiskEngine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write failing tests for EL calculation**

Add to the same test file:

```typescript
import { calculateAnejoCreditRisk } from '../pricing/creditRiskEngine';
import type { CreditRiskResult } from '../../types';

describe('calculateAnejoCreditRisk', () => {
  it('calculates Stage 1 EL for a corporate loan', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Commercial Loan',
      clientType: 'Corporate',
      amount: 1_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    });

    expect(result.anejoSegment).toBe('LARGE_CORPORATE');
    expect(result.stage).toBe(1);
    expect(result.grossExposure).toBe(1_000_000);
    expect(result.effectiveGuarantee).toBe(0);
    expect(result.netExposure).toBe(1_000_000);
    expect(result.coveragePct).toBe(0.6);
    expect(result.el12m).toBe(6_000); // 1M × 0.6% = 6,000
    expect(result.creditCostAnnualPct).toBeCloseTo(0.6, 2);
  });

  it('calculates Stage 1 EL for a mortgage with low LTV', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Mortgage',
      clientType: 'Retail',
      amount: 200_000,
      ltvPct: 0.70,
      collateralType: 'RESIDENTIAL_FINISHED',
      collateralValue: 285_714, // amount / 0.70
    });

    expect(result.anejoSegment).toBe('MORTGAGE_LOW_LTV');
    expect(result.coveragePct).toBe(0.7);
    // Net exposure = 200,000 - min(285,714 × 0.75 × (0.80/0.70), 200,000)
    // Guarantee = min(285,714 × 0.75 × 1.0, 200,000) = min(214,285, 200,000) = 200,000
    // But coverage is on net exposure. With full guarantee coverage, net = 0.
    // Actually: guarantee = min(collateralValue × (1-haircut), amount) = min(214285, 200000) = 200000
    // net = 200000 - 200000 = 0, so EL = 0
    expect(result.netExposure).toBe(0);
    expect(result.el12m).toBe(0);
  });

  it('calculates EL for consumer credit (no collateral)', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Consumer Loan',
      clientType: 'Retail',
      amount: 30_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    });

    expect(result.anejoSegment).toBe('CONSUMER');
    expect(result.coveragePct).toBe(1.8);
    expect(result.el12m).toBe(540); // 30,000 × 1.8% = 540
    expect(result.creditCostAnnualPct).toBeCloseTo(1.8, 2);
  });

  it('returns zero for public sector', () => {
    const result = calculateAnejoCreditRisk({
      productType: 'Commercial Loan',
      clientType: 'Gov',
      amount: 5_000_000,
      ltvPct: 0,
      collateralType: 'None',
      collateralValue: 0,
    });

    expect(result.anejoSegment).toBe('PUBLIC_SECTOR');
    expect(result.coveragePct).toBe(0.0);
    expect(result.el12m).toBe(0);
  });
});
```

- [ ] **Step 4: Implement the credit risk engine**

```typescript
// utils/pricing/creditRiskEngine.ts

import {
  ANEJO_SEGMENTS,
  GUARANTEE_HAIRCUTS,
  MORTGAGE_LTV_THRESHOLD,
  type AnejoSegment,
} from '../../constants/anejoIX';
import type { CreditRiskResult } from '../../types';

export interface CreditRiskInput {
  productType: string;
  clientType: string;
  amount: number;
  ltvPct: number;
  collateralType: string;
  collateralValue: number;
}

/**
 * Classify a deal into its Anejo IX segment based on product type, client type, and LTV.
 */
export function classifyAnejoSegment(
  productType: string,
  clientType: string,
  ltvPct: number = 0,
): AnejoSegment {
  const product = productType.toLowerCase();
  const client = clientType.toLowerCase();

  if (client === 'gov' || client === 'public' || client === 'institution') return 'PUBLIC_SECTOR';

  if (product.includes('mortgage') || product.includes('hipoteca')) {
    return ltvPct > MORTGAGE_LTV_THRESHOLD ? 'MORTGAGE_HIGH_LTV' : 'MORTGAGE_LOW_LTV';
  }
  if (product.includes('card') || product.includes('tarjeta')) return 'CREDIT_CARDS';
  if (product.includes('consumer') || product.includes('consumo') || product.includes('personal')) return 'CONSUMER';
  if (product.includes('construction') || product.includes('promotor') || product.includes('promotion')) return 'CONSTRUCTION';
  if (product.includes('civil') || product.includes('infrastructure')) return 'CIVIL_WORKS';
  if (product.includes('project') || product.includes('specialized') || product.includes('shipping')) return 'SPECIALIZED';

  if (client === 'sme' || client === 'pyme') return 'SME';
  if (client === 'corporate') return 'LARGE_CORPORATE';
  if (client === 'retail') return 'CONSUMER';
  if (client === 'self_employed' || client === 'autonomo') return 'SELF_EMPLOYED';

  return 'OTHER';
}

/**
 * Calculate effective guarantee value after applying Anejo IX haircuts.
 */
function calculateEffectiveGuarantee(
  collateralType: string,
  collateralValue: number,
  grossExposure: number,
): number {
  if (!collateralType || collateralType === 'None' || collateralValue <= 0) return 0;

  const haircut = GUARANTEE_HAIRCUTS[collateralType] ?? 0.40;
  const adjustedValue = collateralValue * (1 - haircut);

  return Math.min(adjustedValue, grossExposure);
}

/**
 * Calculate Anejo IX credit risk (Stage 1 EL) for a deal.
 * Uses "soluciones alternativas" (BdE coverage percentages).
 */
export function calculateAnejoCreditRisk(input: CreditRiskInput): CreditRiskResult {
  const segment = classifyAnejoSegment(input.productType, input.clientType, input.ltvPct);
  const segmentDef = ANEJO_SEGMENTS[segment];

  const grossExposure = input.amount;
  const effectiveGuarantee = calculateEffectiveGuarantee(
    input.collateralType,
    input.collateralValue,
    grossExposure,
  );
  const netExposure = Math.max(0, grossExposure - effectiveGuarantee);

  const coveragePct = segmentDef.stage1Coverage;
  const el12m = netExposure * (coveragePct / 100);
  const creditCostAnnualPct = grossExposure > 0 ? (el12m / grossExposure) * 100 : 0;

  return {
    anejoSegment: segment,
    stage: 1,
    grossExposure,
    effectiveGuarantee,
    netExposure,
    coveragePct,
    el12m,
    creditCostAnnualPct,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run utils/__tests__/creditRiskEngine.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add utils/pricing/creditRiskEngine.ts utils/__tests__/creditRiskEngine.test.ts
git commit -m "feat(m2): implement Anejo IX credit risk engine with segment classification

Classifies deals into 12 BdE segments, applies Stage 1 coverage
from soluciones alternativas (Circular 6/2021), nets guarantees
with property-type haircuts."
```

---

### Task 4: Integrate into Pricing Engine

**Files:**
- Modify: `utils/pricingEngine.ts`

- [ ] **Step 1: Replace calculateCreditCost with Anejo IX engine**

In `utils/pricingEngine.ts`, add the import at the top (near the other pricing imports):

```typescript
import { calculateAnejoCreditRisk } from './pricing/creditRiskEngine';
```

Then replace lines ~269-273 (the credit cost section):

```typescript
// OLD:
// const clientRating = getClientRating(deal.clientId, clients);
// const creditCost = calculateCreditCost(clientRating);
// const regulatoryCost = creditCost;

// NEW:
const anejoResult = calculateAnejoCreditRisk({
  productType: deal.productType,
  clientType: deal.clientType,
  amount: deal.amount,
  ltvPct: deal.haircutPct ? (deal.amount / (deal.amount / (1 - deal.haircutPct / 100))) : 0,
  collateralType: deal.collateralType || 'None',
  collateralValue: deal.collateralType && deal.collateralType !== 'None'
    ? deal.amount / Math.max(deal.haircutPct || 1, 1) * 100
    : 0,
});
const regulatoryCost = anejoResult.creditCostAnnualPct / 100;
```

And in the return object, add `anejoSegment`:

```typescript
    anejoSegment: anejoResult.anejoSegment,
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 254+ tests PASS (existing tests use `regulatoryCost` which is still populated)

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add utils/pricingEngine.ts
git commit -m "feat(m2): integrate Anejo IX credit risk into pricing waterfall

Replaces flat PD×LGD calculation with segment-aware Anejo IX
coverage. regulatoryCost now reflects BdE soluciones alternativas."
```

---

### Task 5: Update PricingReceipt to Show Segment

**Files:**
- Modify: `components/Calculator/PricingReceipt.tsx`
- Modify: `translations.ts`

- [ ] **Step 1: Add translation keys for Anejo IX**

In `translations.ts`, add to the `en` section (near the existing tooltip keys):

```typescript
// ── Anejo IX Credit Risk ────────────────────────────────────
tooltip_formula_anejoCreditCost: 'Expected Loss per Anejo IX (Circular 6/2021). Coverage % applied to net exposure after guarantee haircuts.',
anejo_creditProvision: 'Credit Provision (Anejo IX)',
anejo_segment: 'Segment',
```

And the corresponding `es` section:

```typescript
tooltip_formula_anejoCreditCost: 'Pérdida Esperada según Anejo IX (Circular 6/2021). Cobertura % aplicada sobre exposición neta tras recortes de garantía.',
anejo_creditProvision: 'Provisión Crédito (Anejo IX)',
anejo_segment: 'Segmento',
```

- [ ] **Step 2: Update the waterfall display**

In `PricingReceipt.tsx`, update the Expected Loss WaterfallItem (around line 450):

Replace:
```tsx
<WaterfallItem label="Expected Loss (Credit)" value={result.regulatoryCost} isAdd color="text-rose-400" formula={t.tooltip_raroc_expectedLoss} />
```

With:
```tsx
<WaterfallItem
  label={`${t.anejo_creditProvision}${result.anejoSegment ? ` · ${result.anejoSegment.replace(/_/g, ' ')}` : ''}`}
  value={result.regulatoryCost}
  isAdd
  color="text-rose-400"
  formula={t.tooltip_formula_anejoCreditCost}
/>
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Both PASS

- [ ] **Step 4: Commit**

```bash
git add components/Calculator/PricingReceipt.tsx translations.ts
git commit -m "feat(m2): show Anejo IX segment in pricing waterfall

Waterfall now displays the BdE segment classification alongside
the credit provision line. Updated tooltip with Anejo IX reference."
```

---

### Task 6: Build and Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run full verification**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

Expected: typecheck clean, all tests pass, build succeeds

- [ ] **Step 2: Deploy to Vercel**

```bash
npx vercel --prod --yes
npx vercel alias <deployment-url> nfq-pricing.vercel.app
```

- [ ] **Step 3: Final commit with all changes**

If any files are uncommitted:
```bash
git add -A && git status
git commit -m "chore(m2): sprint 1 complete — Anejo IX credit risk engine"
```
