import { describe, it, expect } from 'vitest';
import {
  buildEmailPayload,
  buildSlackPayload,
  buildPagerDutyPayload,
  buildWebhookPayload,
  buildOpsgeniePayload,
  type AlertContext,
} from '../../server/integrations/alertChannels';

const ctx: AlertContext = {
  ruleId: '00000000-0000-0000-0000-00000000abcd',
  ruleName: 'Pricing error spike',
  entityId: '00000000-0000-0000-0000-000000000010',
  entityName: 'NFQ Spain',
  sli: 'pricing_error_rate',
  severity: 'page',
  operator: 'lt',
  threshold: 0.005,
  metricValue: 0.018,
  windowSeconds: 300,
  triggeredAt: '2026-04-15T10:27:31Z',
  runbookUrl: 'https://runbooks.internal/error-rate',
  requestIds: ['req-1', 'req-2'],
};

describe('buildEmailPayload', () => {
  it('wraps recipients, subject and body', () => {
    const out = buildEmailPayload({ recipients: ['a@x.com', 'b@x.com'] }, ctx);
    expect(out.recipients).toEqual(['a@x.com', 'b@x.com']);
    expect(out.subject).toContain('[PAGE]');
    expect(out.subject).toContain('Pricing error spike');
    expect(out.body).toContain('NFQ Spain');
    expect(out.body).toContain('pricing_error_rate');
    expect(out.body).toContain('runbook');
  });

  it('renders without runbook URL when missing', () => {
    const noRunbook = { ...ctx, runbookUrl: undefined };
    const out = buildEmailPayload({ recipients: ['a@x.com'] }, noRunbook);
    expect(out.body).not.toContain('Runbook');
  });
});

describe('buildSlackPayload', () => {
  it('includes severity-coloured attachment and required fields', () => {
    const out = buildSlackPayload({ webhookUrl: 'ignored' }, ctx) as Record<string, unknown>;
    expect(out.text).toContain('[PAGE]');
    const attachments = out.attachments as Array<{ color: string; fields: Array<{ title: string; value: string }> }>;
    expect(attachments[0].color).toBe('#d9534f');
    const titles = attachments[0].fields.map((f) => f.title);
    expect(titles).toContain('Entity');
    expect(titles).toContain('SLI');
    expect(titles).toContain('Threshold');
  });

  it('sets channel override when provided', () => {
    const out = buildSlackPayload({ webhookUrl: 'u', channel: '#ops' }, ctx) as Record<string, unknown>;
    expect(out.channel).toBe('#ops');
  });
});

describe('buildPagerDutyPayload', () => {
  it('produces a trigger event with a deterministic dedup key', () => {
    const out = buildPagerDutyPayload({ routingKey: 'rk' }, ctx);
    expect(out.routing_key).toBe('rk');
    expect(out.event_action).toBe('trigger');
    expect(out.dedup_key).toBe(
      `alert_rule_${ctx.ruleId}_${ctx.entityId}`,
    );
    const payload = out.payload as Record<string, unknown>;
    expect(payload.severity).toBe('error'); // page → error
    expect(payload.source).toBe('n-pricing');
    const details = payload.custom_details as { requestIds: string[] };
    expect(details.requestIds).toEqual(['req-1', 'req-2']);
  });

  it('maps critical to critical and warning to warning', () => {
    const critical = buildPagerDutyPayload({ routingKey: 'rk' }, { ...ctx, severity: 'critical' });
    const warning = buildPagerDutyPayload({ routingKey: 'rk' }, { ...ctx, severity: 'warning' });
    expect((critical.payload as { severity: string }).severity).toBe('critical');
    expect((warning.payload  as { severity: string }).severity).toBe('warning');
  });
});

describe('buildWebhookPayload', () => {
  it('produces a signed payload when secret is given', () => {
    const { body, signature } = buildWebhookPayload(
      { url: 'https://hook.example', secret: 's3cret' },
      ctx,
    );
    expect(body.event).toBe('alert.triggered');
    expect(body.alertRuleId).toBe(ctx.ruleId);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('leaves signature null when no secret', () => {
    const { signature } = buildWebhookPayload({ url: 'https://hook.example' }, ctx);
    expect(signature).toBeNull();
  });

  it('includes window in seconds form', () => {
    const { body } = buildWebhookPayload({ url: 'u' }, ctx);
    expect(body.window).toBe('300s');
  });
});

describe('buildOpsgeniePayload', () => {
  it('maps severity to priority and includes team responder when configured', () => {
    const crit = buildOpsgeniePayload({ apiKey: 'k' }, { ...ctx, severity: 'critical' });
    expect(crit.priority).toBe('P1');
    const withTeam = buildOpsgeniePayload({ apiKey: 'k', team: 'Pricing Ops' }, ctx);
    expect(withTeam.responders).toEqual([{ name: 'Pricing Ops', type: 'team' }]);
  });

  it('omits responders when no team configured', () => {
    const out = buildOpsgeniePayload({ apiKey: 'k' }, ctx);
    expect(out.responders).toBeUndefined();
  });
});
