/**
 * Budget reconciliation namespace (EN). Ola 9 Bloque C.
 */

interface BudgetPack {
  [key: string]: string;
}

export const budgetEn: BudgetPack = {
  view:                       'Budget reconciliation',
  subtitle:                   'Budget assumptions vs realized pricing per period',
  periodLabel:                'Period',
  rateToleranceLabel:         'Rate tolerance (bps)',
  volumeToleranceLabel:       'Volume tolerance (%)',
  totalBudgeted:              'Budgeted volume',
  totalRealized:              'Realized volume',
  weightedDriftRate:           'Weighted Δ rate',
  statusOnTrack:              'On track',
  statusOverRate:             'Over rate',
  statusUnderRate:            'Under rate',
  statusOverVolume:           'Over volume',
  statusUnderVolume:          'Under volume',
  statusBudgetOnly:           'Budget only',
  statusRealizedOnly:         'Realized only',
  tableSegment:               'Segment',
  tableProduct:               'Product',
  tableCurrency:               'Ccy',
  tableBudgetedRate:          'Budget rate',
  tableRealizedRate:          'Realized rate',
  tableDiffRate:              'Δ rate',
  tableBudgetedVolume:        'Budget €',
  tableRealizedVolume:        'Realized €',
  tableDiffVolumePct:         'Δ vol %',
  tableStatus:                'Status',
  emptyState:                 'No budget assumptions configured for this period.',
  loading:                    'Loading…',
  retry:                      'Retry',
  errorLoading:               'Could not load comparison. Retry.',
};

export type BudgetTranslationKeys = typeof budgetEn;
