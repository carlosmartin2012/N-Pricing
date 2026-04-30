/**
 * Budget reconciliation namespace (ES). Ola 9 Bloque C.
 */

import type { BudgetTranslationKeys } from './budget.en';

export const budgetEs: BudgetTranslationKeys = {
  view:                       'Comparativa presupuestaria',
  subtitle:                   'Supuestos de presupuesto vs precios realizados por periodo',
  periodLabel:                'Periodo',
  rateToleranceLabel:         'Tolerancia tasa (bps)',
  volumeToleranceLabel:       'Tolerancia volumen (%)',
  totalBudgeted:              'Volumen presupuestado',
  totalRealized:              'Volumen realizado',
  weightedDriftRate:          'Δ tasa ponderada',
  statusOnTrack:              'En banda',
  statusOverRate:             'Sobre tasa',
  statusUnderRate:            'Bajo tasa',
  statusOverVolume:           'Sobre volumen',
  statusUnderVolume:          'Bajo volumen',
  statusBudgetOnly:           'Solo presupuesto',
  statusRealizedOnly:         'Solo realizado',
  tableSegment:               'Segmento',
  tableProduct:               'Producto',
  tableCurrency:               'Divisa',
  tableBudgetedRate:          'Tasa presup.',
  tableRealizedRate:          'Tasa real.',
  tableDiffRate:              'Δ tasa',
  tableBudgetedVolume:        'Pres. €',
  tableRealizedVolume:        'Real. €',
  tableDiffVolumePct:         'Δ vol %',
  tableStatus:                'Estado',
  emptyState:                 'Sin supuestos de presupuesto configurados para este periodo.',
  loading:                    'Cargando…',
  retry:                      'Reintentar',
  errorLoading:               'No se pudo cargar la comparativa. Reintenta.',
};
