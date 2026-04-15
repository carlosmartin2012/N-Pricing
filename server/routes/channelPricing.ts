import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { pool, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { consume } from '../../utils/channels/tokenBucket';
import { findApplicableCampaigns, pickBestForBorrower } from '../../utils/channels/campaignMatcher';
import { recorderFromPool } from '../../utils/metering/usageRecorder';
import { calculatePricing } from '../../utils/pricingEngine';
import type { Transaction, ApprovalMatrixConfig } from '../../types';
import type { PricingCampaign, ChannelType } from '../../types/channels';

/**
 * Channel pricing API.
 *
 * Auth model differs from the rest of /api: callers present an API key
 * (`x-channel-key`) bound to a row in channel_api_keys. No JWT required —
 * channels often run from kiosk or mobile app contexts that don't have a
 * user session.
 *
 * Per request:
 *   1. Look up key (sha256 lookup against channel_api_keys.key_hash).
 *   2. Token-bucket rate limit per key (rpm + burst from the row).
 *   3. Run pricing engine on the deal payload, applying any matching
 *      pricing_campaigns delta.
 *   4. Log the request to channel_request_log (best effort).
 */

const router = Router();
const meter = recorderFromPool(pool);

interface KeyRow {
  id: string;
  entity_id: string;
  channel: ChannelType;
  rate_limit_rpm: number;
  rate_limit_burst: number;
  daily_quota: number | null;
  is_active: boolean;
  revoked_at: string | null;
}

interface ChannelAuthContext {
  apiKeyId: string;
  entityId: string;
  channel: ChannelType;
  rateLimitRpm: number;
  rateLimitBurst: number;
  dailyQuota: number | null;
}

// Augment Request locally — channel routes attach `channelAuth`.
interface ChannelRequest extends Request {
  channelAuth?: ChannelAuthContext;
}

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function channelAuthMiddleware(req: ChannelRequest, res: Response, next: NextFunction): Promise<void> {
  const headerVal = req.headers['x-channel-key'];
  const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!raw || typeof raw !== 'string' || raw.length < 16) {
    res.status(401).json({ code: 'channel_key_missing', message: 'x-channel-key header required' });
    return;
  }
  try {
    const row = await queryOne<KeyRow>(
      `SELECT id, entity_id, channel, rate_limit_rpm, rate_limit_burst, daily_quota, is_active, revoked_at
       FROM channel_api_keys
       WHERE key_hash = $1
       LIMIT 1`,
      [hashKey(raw)],
    );
    if (!row || !row.is_active || row.revoked_at) {
      res.status(403).json({ code: 'channel_key_invalid', message: 'API key invalid or revoked' });
      return;
    }
    req.channelAuth = {
      apiKeyId: row.id,
      entityId: row.entity_id,
      channel: row.channel,
      rateLimitRpm: row.rate_limit_rpm,
      rateLimitBurst: row.rate_limit_burst,
      dailyQuota: row.daily_quota,
    };
    next();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
}

function rateLimitMiddleware(req: ChannelRequest, res: Response, next: NextFunction): void {
  const auth = req.channelAuth;
  if (!auth) {
    res.status(500).json({ code: 'rate_limit_no_context' });
    return;
  }
  const result = consume(auth.apiKeyId, {
    capacity: auth.rateLimitBurst,
    refillPerSec: auth.rateLimitRpm / 60,
  });
  res.setHeader('x-rate-limit-remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
    res.status(429).json({
      code: 'rate_limited',
      message: `Channel rate limit exceeded; retry in ${result.retryAfterMs}ms`,
    });
    return;
  }
  next();
}

router.use(channelAuthMiddleware);
router.use(rateLimitMiddleware);

interface QuotePayload {
  deal: Transaction;
  approvalMatrix?: Partial<ApprovalMatrixConfig>;
  asOfDate?: string;
}

interface CampaignRow {
  id: string;
  entity_id: string;
  code: string;
  name: string;
  segment: string;
  product_type: string;
  currency: string;
  channel: ChannelType | null;
  rate_delta_bps: string | number;
  max_volume_eur: string | number | null;
  consumed_volume_eur: string | number;
  active_from: string;
  active_to: string;
  status: PricingCampaign['status'];
  version: number;
  parent_version_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapCampaignRow(r: CampaignRow): PricingCampaign {
  return {
    id: r.id,
    entityId: r.entity_id,
    code: r.code,
    name: r.name,
    segment: r.segment,
    productType: r.product_type,
    currency: r.currency,
    channel: r.channel,
    rateDeltaBps: Number(r.rate_delta_bps),
    maxVolumeEur: r.max_volume_eur != null ? Number(r.max_volume_eur) : null,
    consumedVolumeEur: Number(r.consumed_volume_eur),
    activeFrom: r.active_from,
    activeTo: r.active_to,
    status: r.status,
    version: r.version,
    parentVersionId: r.parent_version_id,
    createdBy: r.created_by,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.post('/quote', async (req: ChannelRequest, res) => {
  const t0 = performance.now();
  const auth = req.channelAuth!;
  const requestId = req.requestId ?? crypto.randomUUID();
  let statusCode = 200;
  try {
    const body = req.body as QuotePayload | undefined;
    if (!body?.deal) {
      statusCode = 400;
      res.status(400).json({ code: 'invalid_payload', message: 'deal required' });
      return;
    }
    const asOfDate = (body.asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(body.asOfDate))
      ? body.asOfDate
      : new Date().toISOString().slice(0, 10);

    // Load campaigns scoped to entity. Engine context loading is out of scope
    // here — channels assume the standard entity pricing context already lives
    // in the engine's defaults / config tables; this endpoint reuses them via
    // calculatePricing(deal, approval, undefined, ...).
    const campaignRows = await pool.query<CampaignRow>(
      `SELECT * FROM pricing_campaigns
       WHERE entity_id = $1 AND status IN ('approved','active')`,
      [auth.entityId],
    );
    const campaigns = campaignRows.rows.map(mapCampaignRow);

    const matches = findApplicableCampaigns(campaigns, {
      entityId: auth.entityId,
      segment: String((body.deal as unknown as Record<string, unknown>).segment ?? body.deal.clientType ?? ''),
      productType: String(body.deal.productType ?? ''),
      currency: String(body.deal.currency ?? 'EUR'),
      channel: auth.channel,
      asOfDate,
    });
    const winner = pickBestForBorrower(matches);

    const approval: ApprovalMatrixConfig = {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
      ...body.approvalMatrix,
    };
    const baseResult = calculatePricing(body.deal, approval) as unknown as Record<string, unknown>;
    const baseRate = Number(baseResult.finalClientRate ?? 0);
    const adjustedRate = winner ? baseRate + winner.rateDeltaBps / 10_000 : baseRate;

    void meter.insert(auth.entityId, 'channel_quote', 1, {
      channel: auth.channel,
      campaign_id: winner?.id ?? null,
    });

    res.json({
      requestId,
      asOfDate,
      base: baseResult,
      campaign: winner,
      finalClientRate: adjustedRate,
    });
  } catch (err) {
    statusCode = 500;
    res.status(500).json({ error: safeError(err), requestId });
  } finally {
    const durationMs = Math.round(performance.now() - t0);
    pool.query(
      `INSERT INTO channel_request_log
        (entity_id, api_key_id, channel, endpoint, status_code, duration_ms, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [auth.entityId, auth.apiKeyId, auth.channel, '/channel/quote', statusCode, durationMs, requestId],
    ).catch(() => { /* best effort */ });
    pool.query(
      `UPDATE channel_api_keys SET last_used_at = NOW() WHERE id = $1`,
      [auth.apiKeyId],
    ).catch(() => { /* best effort */ });
  }
});

export default router;
