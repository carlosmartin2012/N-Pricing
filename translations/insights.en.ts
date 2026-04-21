/**
 * Insights namespace (EN) — Analytics, Market Data, Behavioural Models,
 * Pricing Discipline.
 */

interface InsightsPack {
  [key: string]: string;
}

export const insightsEn: InsightsPack = {
  // Analytics dashboard
  insightsAnalyticsHeader: 'Portfolio analytics',
  insightsAnalyticsSegment: 'Segment breakdown',
  insightsAnalyticsProduct: 'Product breakdown',
  insightsAnalyticsMaturity: 'Maturity profile',
  insightsAnalyticsReturn: 'Return decomposition',

  // Pricing discipline
  insightsDisciplineHeader: 'Pricing discipline',
  insightsDisciplineVariance: 'Variance vs. target',
  insightsDisciplineToleranceBand: 'Tolerance band',
  insightsDisciplineException: 'Exception',
  insightsDisciplineCohortBreakdown: 'Cohort breakdown',
  insightsDisciplineOriginatorScorecard: 'Originator scorecard',

  // Yield curves / market data
  insightsMarketDataHeader: 'Yield curves',
  insightsMarketDataActiveCurve: 'Active curve',
  insightsMarketDataHistoric: 'Historic comparison',
  insightsMarketDataNSSFit: 'NSS fit preview',

  // Behavioural models
  insightsBehaviouralHeader: 'Behavioural models',
  insightsBehaviouralPrepaymentSpeed: 'Prepayment speed',
  insightsBehaviouralDepositRunoff: 'Deposit runoff',
  insightsBehaviouralCalibration: 'Calibration vs. observed',
};

export type InsightsTranslationKeys = typeof insightsEn;
