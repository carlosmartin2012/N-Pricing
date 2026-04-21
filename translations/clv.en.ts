/**
 * CLV + 360º temporal namespace (EN).
 *
 * First sample of the namespaced pattern. See translations/README.md for the
 * full migration plan.
 */

interface ClvPack {
  [key: string]: string;
}

export const clvEn: ClvPack = {
  // Navigation
  clvCustomerTab: 'Customers',
  clvSnapshotTab: 'Snapshot',
  clvProjectionTab: 'LTV projection',
  clvTimelineTab: 'Timeline',
  clvNbaTab: 'Next-Best-Action',

  // LTV card
  clvProjectionTitle: 'Customer Lifetime Value',
  clvCompute: 'Compute CLV',
  clvRecompute: 'Recompute',
  clvComputing: 'Computing…',
  clvPoint: 'CLV (point)',
  clvBand: 'CLV p5 / p95',
  clvShareOfWalletGap: 'Share of wallet gap',
  clvBreakdownNii: 'NII',
  clvBreakdownCrosssell: 'Crosssell',
  clvBreakdownFees: 'Fees',
  clvBreakdownChurnCost: 'Churn cost',
  clvHazardRenewal: 'Hazard & renewal',
  clvChurnLambda: 'Churn λ',
  clvRenewalProb: 'Renewal',
  clvShareEst: 'SoW est.',
  clvNoSnapshot: 'No CLV snapshot yet — trigger a compute to project value for the next horizon.',

  // Timeline
  clvTimelineTitle: 'Relationship timeline',
  clvTimelineEmpty: 'No events yet. Events from pricing, CRM and ops will appear here as the relationship unfolds.',

  // NBA
  clvNbaTitle: 'Next-Best-Action',
  clvNbaGenerate: 'Generate NBA',
  clvNbaGenerating: 'Generating…',
  clvNbaConsume: 'Mark consumed',
  clvNbaConfidence: 'confidence',
  clvNbaEmpty: 'No open recommendations. Generate to rank products by expected ΔCLV.',

  // LTV impact panel
  clvImpactTitle: 'ΔCLV preview',
  clvImpactBefore: 'Before',
  clvImpactAfter: 'After',
  clvImpactDelta: 'ΔCLV',
  clvImpactNii: 'NII',
  clvImpactCrosssell: 'Crosssell',
  clvImpactChurnReduction: 'Churn red.',
  clvImpactCapitalOpportunity: 'Capital opp.',
  clvImpactSelectClient: 'Select a client to see CLV impact.',
  clvImpactIncompleteDeal: 'Complete product + amount + rate to preview ΔCLV.',
  clvImpactComputing: 'computing…',

  // Empty-state / initialize banner
  clvBannerTitleNoData: 'Customer 360 not yet populated',
  clvBannerBodyNoData: 'This client has no positions on file. Import positions from your core banking CSV or run the CLV demo seed to see the full picture.',
  clvBannerImportCta: 'Import positions (CSV)',
  clvBannerSeedHint: 'Tip: `npm run seed:clv-demo` inserts 3 demo clients with positions, metrics and LTV precomputed.',

  clvBannerTitleNoSnapshot: 'CLV not computed yet',
  clvBannerBodyNoSnapshot: 'This client has positions but no LTV snapshot. One click runs the engine and ranks 2-3 Next-Best-Action candidates.',
  clvBannerInitializeCta: 'Initialize CLV for this client',
  clvBannerInitializing: 'Computing CLV + NBA…',
  clvBannerInitializeError: 'Initialization failed. Retry or contact ops.',
};

export type ClvTranslationKeys = typeof clvEn;
