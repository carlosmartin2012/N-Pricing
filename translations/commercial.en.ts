/**
 * Commercial namespace (EN) — Customer 360, Campaigns, TargetGrid.
 *
 * Keys here belong to the forward-facing commercial views (the "Commercial"
 * sidebar bucket). Kept disjoint from the monolithic `translations.ts` on
 * purpose: only NEW keys are added here so the monolith can shrink
 * incrementally in future PRs without breaking any consumer.
 *
 * See translations/README.md for the full migration plan.
 */

interface CommercialPack {
  [key: string]: string;
}

export const commercialEn: CommercialPack = {
  // Customer list / filter
  commercialCustomersHeader: 'Customer Pricing',
  commercialSearchCustomers: 'Search clients…',
  commercialNoMatches: 'No clients match.',
  commercialSelectPrompt: 'Select a client to see their relationship.',
  commercialImportPositions: 'Import positions (CSV)',

  // Campaigns
  commercialCampaignsHeader: 'Pricing Campaigns',
  commercialCampaignsEmpty: 'No active campaigns. Create one to roll out a product-level delta.',
  commercialCampaignNew: 'New campaign',
  commercialCampaignStateDraft: 'Draft',
  commercialCampaignStateActive: 'Active',
  commercialCampaignStatePaused: 'Paused',
  commercialCampaignStateArchived: 'Archived',

  // TargetGrid
  commercialTargetGridHeader: 'Target Grid',
  commercialTargetGridSubtitle: 'Official rate card derived from the current pricing methodology',
  commercialTargetGridTableMode: 'Table',
  commercialTargetGridHeatmapMode: 'Heatmap',

  // Customer 360 shared banners
  commercialCustomerTabsHint: 'Switch between Snapshot, LTV projection, Timeline and Next-Best-Action tabs.',
  commercialAsOfLabel: 'as of',
  commercialHorizonLabel: 'horizon',
};

export type CommercialTranslationKeys = typeof commercialEn;
