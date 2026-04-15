import type { CampaignLookup, CampaignStatus, PricingCampaign } from '../../types/channels';

/**
 * Pure campaign resolution. Returns campaigns that:
 *   - belong to the lookup entity
 *   - segment + productType + currency match
 *   - asOfDate is within active window
 *   - status ∈ {approved, active}
 *   - channel matches (NULL channel = all channels)
 *   - max_volume_eur is null OR not yet exhausted
 *
 * Multiple may apply; pick highest absolute discount unless the caller wants
 * to combine them. For Sprint 1 we return all matches and let the engine
 * decide via `pickBestForBorrower` (most negative rateDeltaBps wins —
 * largest discount to client).
 */

const ELIGIBLE: CampaignStatus[] = ['approved', 'active'];

export function findApplicableCampaigns(
  campaigns: PricingCampaign[],
  lookup: CampaignLookup,
): PricingCampaign[] {
  return campaigns.filter((c) => {
    if (c.entityId !== lookup.entityId) return false;
    if (c.segment !== lookup.segment) return false;
    if (c.productType !== lookup.productType) return false;
    if (c.currency !== lookup.currency) return false;
    if (!ELIGIBLE.includes(c.status)) return false;
    if (lookup.asOfDate < c.activeFrom || lookup.asOfDate > c.activeTo) return false;
    if (c.channel !== null && lookup.channel && c.channel !== lookup.channel) return false;
    if (c.channel !== null && !lookup.channel) return false;       // campaign is channel-restricted but caller didn't say
    if (c.maxVolumeEur !== null && c.consumedVolumeEur >= c.maxVolumeEur) return false;
    return true;
  });
}

/** Pick the most aggressive discount for the borrower (most negative delta). */
export function pickBestForBorrower(matches: PricingCampaign[]): PricingCampaign | null {
  if (matches.length === 0) return null;
  return matches.reduce((best, c) =>
    c.rateDeltaBps < best.rateDeltaBps ? c : best,
  );
}

/** Returns the remaining volume on the campaign in EUR. Inf if uncapped. */
export function remainingVolume(c: PricingCampaign): number {
  if (c.maxVolumeEur === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, c.maxVolumeEur - c.consumedVolumeEur);
}
