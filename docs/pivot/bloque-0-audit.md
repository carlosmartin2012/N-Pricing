# Bloque 0 — Preflight Audit Results

> Done: 2026-04-13. Read against commit 4b8a50f.

## VintageAnalysis.tsx (589 LOC) — ✅ REAL

- Consumes `deals` + computes cohorts by `startDate` quarter / year.
- Calls `calculatePricing()` from real engine for re-pricing each vintage.
- No `Math.random`, no simulated data, no mock.
- Uses `calculatePricing` + `buildPricingContext` with real `marketData` / `rules`.
- **Conclusion:** production-quality. Keep in Pricing Performance sub-section
  of renamed Analytics nav.

## PricingAnalytics.tsx (360 LOC) — ✅ REAL

- Portfolio-wide pricing analytics: actual vs. theoretical margin, drift,
  capital allocation by segment.
- Uses `pricingContext` + `calculatePricing` for every deal.
- No mock data.
- **Conclusion:** real aggregator. Natural home: Pricing Performance sub-section.

## BacktestingDashboard.tsx (381 LOC) — 🟡 HYBRID

- Uses `calculateFullCreditRisk` (real engine) for each booked deal — that
  path is genuine.
- Comment on L80 says "Generate simulated backtest records" — **misleading**:
  the records are recomputed from real inputs, not simulated.
- However, ex-post P&L comparison would ideally also use
  `deal_realizations` (Bloque F table). Today it only compares expected vs.
  refreshed-with-current-params — not vs. realized.
- **Conclusion:** production-acceptable MVP. Post-Bloque F, enrich with
  `deal_realizations` join for true backtest (ex-ante vs. ex-post).

## AI_LAB audit (GeminiAssistant.tsx + GenAIChat.tsx)

- Generic chat over `/api/gemini/chat`.
- `genAIChatUtils.ts::streamGeminiResponse` — generic stream, no
  capability scoping.
- **Conclusion:** sandbox that now coexists with the 3 focused AI utilities
  in `utils/ai/`. Bloque C refocus is complementary, not replacement.

## Alquid URL pattern — 🔴 STILL TBD

`constants/alquidDeepLinks.ts` holds `/alm/maturity-ladder` etc. as
placeholders. Requires pilot/Alquid team confirmation before turning on
`VITE_NPRICING_DEPRECATE_ALM`.

## Overall

No surprises. Inventory in `PIVOT_PLAN.md §2` is accurate. Ready to proceed.
