/**
 * Pricing Discipline (Ola 2) translation pack — English.
 *
 * Extracted from the legacy `translations.ts` monolith on 2026-05-20 to
 * keep that file shrinking. Consumers can either use the namespace barrel
 * (`pricingDisciplineTranslations(lang).datePresetToday`) or keep calling
 * the legacy `getTranslations(lang).datePresetToday` — `getTranslations`
 * merges this pack in so existing keys keep working unchanged.
 */
export const pricingDisciplineEn = {
  pricingDiscipline: 'Pricing Discipline',
  pricingDisciplineDesc: 'Portfolio variance analysis, margin leakage and originator scorecards',
  datePresetToday: 'Today',
  datePresetWeek: 'Last 7d',
  datePresetMonth: 'Last 30d',
  datePresetQuarter: 'Quarter',
  datePresetCustom: 'Custom',
  inBand: 'In Band',
  outOfBand: 'Out of Band',
  totalLeakage: 'Total Leakage',
  leakageTrend: 'Leakage Trend',
  avgFtpVariance: 'Avg FTP Variance',
  avgRarocVariance: 'Avg RAROC Variance',
  toleranceBands: 'Tolerance Bands',
  addBand: 'Add Band',
  editBand: 'Edit Band',
  ftpTolerance: 'FTP Tolerance (bps)',
  rarocTolerance: 'RAROC Tolerance (pp)',
  marginTolerance: 'Margin Tolerance (bps)',
  bandPriority: 'Priority',
  effectiveFrom: 'Effective From',
  effectiveTo: 'Effective To',
  outliers: 'Outliers',
  topOutliers: 'Top Outliers',
  leakageByDimension: 'Leakage by Dimension',
  varianceDistribution: 'Variance Distribution',
  pricingException: 'Pricing Exception',
  exceptionReason: 'Exception Reason',
  exceptionDetail: 'Exception Detail',
  originatorScorecard: 'Originator Scorecard',
  cohortDrilldown: 'Cohort Drilldown',
};

export type PricingDisciplineTranslationKeys = typeof pricingDisciplineEn;
