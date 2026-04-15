import crypto from 'crypto';
import type {
  AlertSeverity,
  AlertChannelType,
  EmailChannelConfig,
  SlackChannelConfig,
  PagerDutyChannelConfig,
  WebhookChannelConfig,
  OpsgenieChannelConfig,
} from '../../types/phase0';

/**
 * Alert channel integrations. Each channel has two pieces:
 *
 *   1. A `buildPayload` pure function that converts the alert context into the
 *      JSON shape the target service expects. Pure = easy to unit test, no
 *      network side effects.
 *
 *   2. A `deliver` function that POSTs the payload with channel-appropriate
 *      headers. Delivery is wrapped by `dispatchAlert` which picks the right
 *      builder + delivery pair based on AlertRule.channelType.
 *
 * The email channel is left as a stub: email transport already exists elsewhere
 * (or will) and we just surface the payload shape so the worker can route it.
 */

// ---------------------------------------------------------------------------
// Alert context (input to all builders)
// ---------------------------------------------------------------------------

export interface AlertContext {
  ruleId: string;
  ruleName: string;
  entityId: string;
  entityName?: string;
  sli: string;
  severity: AlertSeverity;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  metricValue: number;
  windowSeconds: number;
  triggeredAt: string; // ISO timestamp
  runbookUrl?: string;
  requestIds?: string[]; // correlation hints
}

// ---------------------------------------------------------------------------
// Payload builders (pure, deterministic)
// ---------------------------------------------------------------------------

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return Number.isInteger(v) ? v.toString() : v.toPrecision(6);
}

function severityLabel(sev: AlertSeverity): string {
  switch (sev) {
    case 'critical': return 'CRITICAL';
    case 'page':     return 'PAGE';
    case 'warning':  return 'WARNING';
    case 'info':     return 'INFO';
  }
}

function slackColor(sev: AlertSeverity): string {
  switch (sev) {
    case 'critical': return '#8b0000';
    case 'page':     return '#d9534f';
    case 'warning':  return '#f0ad4e';
    case 'info':     return '#5bc0de';
  }
}

function pagerDutySeverity(sev: AlertSeverity): 'critical' | 'error' | 'warning' | 'info' {
  switch (sev) {
    case 'critical': return 'critical';
    case 'page':     return 'error';
    case 'warning':  return 'warning';
    case 'info':     return 'info';
  }
}

export function buildEmailPayload(config: EmailChannelConfig, ctx: AlertContext): {
  recipients: string[];
  subject: string;
  body: string;
} {
  return {
    recipients: config.recipients,
    subject: `[${severityLabel(ctx.severity)}] ${ctx.ruleName}`,
    body:
      `Alert rule "${ctx.ruleName}" triggered on entity ${ctx.entityName ?? ctx.entityId}.\n\n` +
      `SLI:      ${ctx.sli}\n` +
      `Measured: ${formatNumber(ctx.metricValue)} (window ${ctx.windowSeconds}s)\n` +
      `Threshold: ${ctx.operator} ${formatNumber(ctx.threshold)}\n` +
      `Triggered: ${ctx.triggeredAt}\n` +
      (ctx.runbookUrl ? `Runbook: ${ctx.runbookUrl}\n` : ''),
  };
}

export function buildSlackPayload(config: SlackChannelConfig, ctx: AlertContext): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    text: `:rotating_light: *[${severityLabel(ctx.severity)}] ${ctx.ruleName}*`,
    attachments: [{
      color: slackColor(ctx.severity),
      fields: [
        { title: 'Entity',    value: ctx.entityName ?? ctx.entityId, short: true },
        { title: 'SLI',       value: ctx.sli,                        short: true },
        { title: 'Measured',  value: formatNumber(ctx.metricValue),  short: true },
        { title: 'Threshold', value: `${ctx.operator} ${formatNumber(ctx.threshold)}`, short: true },
        { title: 'Window',    value: `${ctx.windowSeconds}s`,        short: true },
        { title: 'Triggered', value: ctx.triggeredAt,                short: true },
        ...(ctx.runbookUrl ? [{ title: 'Runbook', value: `<${ctx.runbookUrl}|Open>` }] : []),
      ],
    }],
  };
  if (config.channel) payload.channel = config.channel;
  return payload;
}

export function buildPagerDutyPayload(config: PagerDutyChannelConfig, ctx: AlertContext): Record<string, unknown> {
  return {
    routing_key: config.routingKey,
    event_action: 'trigger',
    dedup_key: `alert_rule_${ctx.ruleId}_${ctx.entityId}`,
    payload: {
      summary: `[${severityLabel(ctx.severity)}] ${ctx.ruleName} on ${ctx.entityName ?? ctx.entityId}`,
      severity: pagerDutySeverity(ctx.severity),
      source: 'n-pricing',
      component: `sli:${ctx.sli}`,
      group: 'n-pricing.slo',
      class: 'observability',
      custom_details: {
        ruleId:      ctx.ruleId,
        entityId:    ctx.entityId,
        metricValue: ctx.metricValue,
        threshold:   ctx.threshold,
        operator:    ctx.operator,
        window:      ctx.windowSeconds,
        requestIds:  ctx.requestIds ?? [],
      },
    },
  };
}

export function buildWebhookPayload(
  config: WebhookChannelConfig,
  ctx: AlertContext,
): { body: Record<string, unknown>; signature: string | null } {
  const body: Record<string, unknown> = {
    event: 'alert.triggered',
    alertRuleId: ctx.ruleId,
    entityId: ctx.entityId,
    name: ctx.ruleName,
    sli: ctx.sli,
    severity: ctx.severity,
    triggeredAt: ctx.triggeredAt,
    metricValue: ctx.metricValue,
    threshold: ctx.threshold,
    operator: ctx.operator,
    window: `${ctx.windowSeconds}s`,
  };
  const signature = config.secret
    ? `sha256=${crypto.createHmac('sha256', config.secret).update(JSON.stringify(body)).digest('hex')}`
    : null;
  return { body, signature };
}

export function buildOpsgeniePayload(config: OpsgenieChannelConfig, ctx: AlertContext): Record<string, unknown> {
  return {
    message: `[${severityLabel(ctx.severity)}] ${ctx.ruleName}`,
    alias: `n-pricing-${ctx.ruleId}-${ctx.entityId}`,
    priority: ctx.severity === 'critical' ? 'P1' : ctx.severity === 'page' ? 'P2' : 'P3',
    source: 'n-pricing',
    tags: [ctx.sli, ctx.severity],
    details: {
      entityId: ctx.entityId,
      metricValue: formatNumber(ctx.metricValue),
      threshold: `${ctx.operator} ${formatNumber(ctx.threshold)}`,
      window: `${ctx.windowSeconds}s`,
    },
    ...(config.team ? { responders: [{ name: config.team, type: 'team' }] } : {}),
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  status: 'sent' | 'failed';
  statusCode?: number;
  error?: string;
  payload: unknown;
}

export type ChannelDispatcher = (
  channelType: AlertChannelType,
  config: unknown,
  ctx: AlertContext,
) => Promise<DeliveryResult>;

/**
 * Default dispatcher — uses global fetch (Node ≥ 18). Kept as a named export
 * so tests can inject a mock easily.
 */
export async function dispatchAlert(
  channelType: AlertChannelType,
  config: unknown,
  ctx: AlertContext,
): Promise<DeliveryResult> {
  try {
    switch (channelType) {
      case 'email': {
        const payload = buildEmailPayload(config as EmailChannelConfig, ctx);
        // Actual email transport lives outside Phase 0 — we mark as sent and
        // surface the payload so the worker can log it.
        return { status: 'sent', payload };
      }
      case 'slack': {
        const slackCfg = config as SlackChannelConfig;
        const payload = buildSlackPayload(slackCfg, ctx);
        const r = await fetch(slackCfg.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) return { status: 'failed', statusCode: r.status, error: await r.text().catch(() => ''), payload };
        return { status: 'sent', statusCode: r.status, payload };
      }
      case 'pagerduty': {
        const payload = buildPagerDutyPayload(config as PagerDutyChannelConfig, ctx);
        const r = await fetch('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) return { status: 'failed', statusCode: r.status, error: await r.text().catch(() => ''), payload };
        return { status: 'sent', statusCode: r.status, payload };
      }
      case 'webhook': {
        const webhookCfg = config as WebhookChannelConfig;
        const { body, signature } = buildWebhookPayload(webhookCfg, ctx);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(webhookCfg.headers ?? {}),
        };
        if (signature) headers['x-signature'] = signature;
        const r = await fetch(webhookCfg.url, {
          method: webhookCfg.method ?? 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!r.ok) return { status: 'failed', statusCode: r.status, error: await r.text().catch(() => ''), payload: body };
        return { status: 'sent', statusCode: r.status, payload: body };
      }
      case 'opsgenie': {
        const opsCfg = config as OpsgenieChannelConfig;
        const payload = buildOpsgeniePayload(opsCfg, ctx);
        const r = await fetch('https://api.opsgenie.com/v2/alerts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GenieKey ${opsCfg.apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        if (!r.ok) return { status: 'failed', statusCode: r.status, error: await r.text().catch(() => ''), payload };
        return { status: 'sent', statusCode: r.status, payload };
      }
    }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'unknown dispatch error',
      payload: null,
    };
  }
}
