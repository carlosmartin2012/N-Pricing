/**
 * Anejo IX Riesgo de Crédito translation pack — Spanish.
 * See `anejoCreditRisk.en.ts` for the canonical key set + JSDoc.
 */
import type { AnejoCreditRiskTranslationKeys } from './anejoCreditRisk.en';

export const anejoCreditRiskEs: AnejoCreditRiskTranslationKeys = {
  tooltip_formula_anejoCreditCost: 'Pérdida Esperada según Anejo IX (Circular 6/2021). Cobertura Stage 1 % aplicada sobre exposición neta tras recortes de garantía.',
  anejo_creditProvision: 'Provisión Crédito (Anejo IX)',
  anejo_segment: 'Segmento',
  creditRiskDetail: 'Detalle Riesgo de Crédito (Anejo IX)',
  creditMode: 'Modo',
  creditModeNative: 'Nativo (Soluciones Alt. BdE)',
  creditModeMirror: 'Espejo (IFRS 9 Externo)',
  creditCoverage: 'Cobertura (Stage 1)',
  creditScenarioWeighted: 'Ponderada por Escenarios',
  creditDay1Provision: 'Provisión Día 1',
  creditMigrationCost: 'Coste Migración / año',
  creditProbS2: 'P(→ Stage 2)',
  creditProbS3: 'P(S2 → Stage 3)',
  creditELLifetime: 'PE Vida',
  creditCapitalParams: 'Params Capital',
  modelBacktest: 'Backtest del Modelo',
  backtestDeals: 'Operaciones Testadas',
  observedDefaultRate: 'Tasa Mora Observada',
  predictedDefaultRate: 'Tasa Mora Predicha',
  elAccuracyRatio: 'Ratio Precisión PE',
  backtestBySegment: 'Precisión por Segmento',
  backtestNote: 'Backtest usa pérdidas simuladas para demostración. Conectar con API de historial de pérdidas para producción.',
};
