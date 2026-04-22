import type { Page, Route } from '@playwright/test';
import type { Transaction } from '../types';
import { DEFAULT_ENTITY_ID, MOCK_ENTITIES, MOCK_ENTITY_USERS, MOCK_GROUPS } from '../utils/seedData.entities';
import {
  INITIAL_DEAL,
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_FTP_RATE_CARDS,
  MOCK_GREENIUM_GRID,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
  MOCK_TRANSITION_GRID,
  MOCK_USERS,
  MOCK_YIELD_CURVE,
} from '../utils/seedData';
import {
  backtestBehavioralModel,
  backtestLGDModel,
  backtestPDModel,
} from '../utils/pricing/modelInventory';
import { optimizeMarginForTargetRaroc } from '../utils/pricing/inverseOptimizer';
import { runPortfolioReview } from '../utils/pricing/portfolioReviewAgent';
import { resolveDelegation } from '../utils/pricing/delegationEngine';
import { buildWaterfallExplanation } from '../utils/waterfallExplainer';
import {
  mapDealToDB,
  mapEntityToDB,
  mapGroupToDB,
  mapModelToDB,
  mapRuleToDB,
} from '../utils/supabase/mappers';

type MockDealRow = ReturnType<typeof mapDealToDB> & {
  created_at: string;
  updated_at: string;
};

interface MockState {
  audit: Array<Record<string, unknown>>;
  alertRules: Array<Record<string, unknown>>;
  deals: MockDealRow[];
  recentMetrics: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  systemConfig: Record<string, unknown>;
}

interface MockApiOptions {
  audit?: Array<Record<string, unknown>>;
  alertRules?: Array<Record<string, unknown>>;
  deals?: Transaction[];
  recentMetrics?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  systemConfigOverrides?: Record<string, unknown>;
}

const nowIso = () => new Date().toISOString();

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function noContent(status = 204) {
  return {
    status,
    contentType: 'application/json',
    body: '',
  };
}

function parseBody(route: Route): unknown {
  const payload = route.request().postData();
  if (!payload) return {};
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return {};
  }
}

function makeDealRow(deal = INITIAL_DEAL): MockDealRow {
  const timestamp = nowIso();
  return {
    ...mapDealToDB(deal),
    id: deal.id ?? 'DL-E2E-SEED',
    entity_id: deal.entityId ?? DEFAULT_ENTITY_ID,
    version: deal.version ?? 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function defaultSystemConfig(): Record<string, unknown> {
  return {
    approval_matrix:
      MOCK_ENTITIES[0]?.approvalMatrix ?? {
        autoApprovalThreshold: 15,
        l1Threshold: 10,
        l2Threshold: 5,
      },
    approval_tasks: [],
    greenium_grid: MOCK_GREENIUM_GRID,
    incentivisation_rules: [],
    liquidity_curves: MOCK_LIQUIDITY_CURVES,
    lr_config: MOCK_ENTITIES[0]?.lrConfig ?? null,
    market_data_sources: [],
    methodology_change_requests: [],
    methodology_versions: [],
    physical_grid: MOCK_PHYSICAL_GRID,
    portfolio_snapshots: [],
    pricing_dossiers: [],
    raroc_inputs: null,
    rate_cards: MOCK_FTP_RATE_CARDS,
    sdr_config: MOCK_ENTITIES[0]?.sdrConfig ?? null,
    shocks: { interestRate: 0, liquiditySpread: 0 },
    transition_grid: MOCK_TRANSITION_GRID,
  };
}

function defaultAlertRules(): Array<Record<string, unknown>> {
  return [
    {
      id: 'alert-latency-1',
      entity_id: DEFAULT_ENTITY_ID,
      name: 'Latency Guardrail',
      metric_name: 'pricing_latency_ms',
      operator: 'gte',
      threshold: 250,
      recipients: ['treasury@nfq.es'],
      is_active: true,
      last_triggered_at: null,
      created_at: nowIso(),
    },
    {
      id: 'alert-errors-1',
      entity_id: DEFAULT_ENTITY_ID,
      name: 'Pricing Error Spike',
      metric_name: 'error_count',
      operator: 'gte',
      threshold: 3,
      recipients: ['ops@nfq.es'],
      is_active: false,
      last_triggered_at: null,
      created_at: nowIso(),
    },
  ];
}

function defaultRecentMetrics(): Array<Record<string, unknown>> {
  return [
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'pricing_latency_ms', metric_value: 32, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'pricing_latency_ms', metric_value: 48, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'pricing_latency_ms', metric_value: 58, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'pricing_latency_ms', metric_value: 160, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'pricing_latency_ms', metric_value: 200, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'error_count', metric_value: 1, recorded_at: nowIso() },
    { entity_id: DEFAULT_ENTITY_ID, metric_name: 'error_count', metric_value: 1, recorded_at: nowIso() },
  ];
}

function percentileCont(values: number[], percentile: number): number | null {
  if (!values.length) return null;
  if (values.length === 1) return values[0] ?? null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex] ?? sorted[0] ?? 0;
  const upper = sorted[upperIndex] ?? sorted[sorted.length - 1] ?? lower;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (index - lowerIndex);
}

function buildObservabilitySummary(entityId: string, state: MockState) {
  const latencyValues = state.recentMetrics
    .filter(
      (metric) =>
        String(metric.entity_id ?? '') === entityId &&
        String(metric.metric_name ?? '') === 'pricing_latency_ms',
    )
    .map((metric) => Number(metric.metric_value ?? 0))
    .filter((value) => Number.isFinite(value));
  const errorEvents24h = state.recentMetrics
    .filter(
      (metric) =>
        String(metric.entity_id ?? '') === entityId &&
        String(metric.metric_name ?? '') === 'error_count',
    )
    .reduce((sum, metric) => sum + Number(metric.metric_value ?? 0), 0);

  return {
    entityId,
    pricingLatencyP50Ms: percentileCont(latencyValues, 0.5),
    pricingLatencyP95Ms: percentileCont(latencyValues, 0.95),
    latencySampleCount24h: latencyValues.length,
    errorEvents24h,
    dealCount: state.deals.filter((deal) => String(deal.entity_id ?? '') === entityId).length,
    activeAlertRules: state.alertRules.filter(
      (rule) => String(rule.entity_id ?? '') === entityId && rule.is_active === true,
    ).length,
  };
}

function createState(options: MockApiOptions = {}): MockState {
  return {
    audit: options.audit ? [...options.audit] : [],
    alertRules: options.alertRules ? [...options.alertRules] : defaultAlertRules(),
    deals: (options.deals ?? MOCK_DEALS).map((deal) => makeDealRow(deal)),
    recentMetrics: options.recentMetrics ? [...options.recentMetrics] : defaultRecentMetrics(),
    notifications: options.notifications
      ? [...options.notifications]
      : [
          {
            id: 1,
            recipient_email: 'demo@nfq.es',
            sender_email: 'system@nfq.es',
            type: 'APPROVAL_REQUEST',
            title: 'Demo workspace ready',
            message: 'Seed data loaded for the demo user.',
            deal_id: null,
            is_read: false,
            created_at: nowIso(),
          },
        ],
    systemConfig: {
      ...defaultSystemConfig(),
      ...options.systemConfigOverrides,
    },
  };
}

function nextDealId(currentCount: number): string {
  return `DL-E2E-${String(currentCount + 1).padStart(4, '0')}`;
}

function findDealIndex(deals: MockDealRow[], id?: string | null): number {
  if (!id) return -1;
  return deals.findIndex((deal) => deal.id === id);
}

function withDealDefaults(payload: Partial<MockDealRow>, fallbackId: string): MockDealRow {
  const timestamp = nowIso();
  return {
    ...payload,
    id: String(payload.id ?? fallbackId),
    entity_id: String(payload.entity_id ?? DEFAULT_ENTITY_ID),
    version: Number(payload.version ?? 1),
    created_at: String(payload.created_at ?? timestamp),
    updated_at: timestamp,
  } as MockDealRow;
}

async function fulfillDeals(route: Route, url: URL, state: MockState) {
  const entityId = url.searchParams.get('entity_id');
  const rows = entityId
    ? state.deals.filter((deal) => String(deal.entity_id ?? '') === entityId)
    : state.deals;
  await route.fulfill(json(rows));
}

async function fulfillConfig(
  route: Route,
  path: string,
  method: string,
  body: unknown,
  state: MockState,
): Promise<boolean> {
  if (path === '/config/clients' && method === 'GET') {
    await route.fulfill(json(MOCK_CLIENTS));
    return true;
  }
  if (path === '/config/products' && method === 'GET') {
    await route.fulfill(json(MOCK_PRODUCT_DEFS));
    return true;
  }
  if (path === '/config/business-units' && method === 'GET') {
    await route.fulfill(json(MOCK_BUSINESS_UNITS));
    return true;
  }
  if (path === '/config/users' && method === 'GET') {
    await route.fulfill(json(MOCK_USERS));
    return true;
  }
  if (path === '/config/rules' && method === 'GET') {
    await route.fulfill(json(MOCK_RULES.map((rule) => ({ ...mapRuleToDB(rule), id: rule.id }))));
    return true;
  }
  if (/^\/config\/(clients|products|business-units|users|rules)(\/[^/]+)?$/.test(path)) {
    await route.fulfill(method === 'DELETE' ? noContent() : json(body));
    return true;
  }
  if (/^\/config\/rules\/[^/]+\/versions$/.test(path)) {
    await route.fulfill(method === 'GET' ? json([]) : json({ ok: true }));
    return true;
  }
  if (/^\/config\/system-config\/[^/]+$/.test(path)) {
    const key = path.split('/').pop() ?? '';
    if (method === 'GET') {
      await route.fulfill(json({ value: state.systemConfig[key] ?? null }));
      return true;
    }
    if (method === 'POST') {
      state.systemConfig[key] = (body as { value?: unknown }).value ?? null;
      await route.fulfill(json({ ok: true }));
      return true;
    }
  }
  return false;
}

export async function registerApiMocks(page: Page, options?: MockApiOptions): Promise<void> {
  const state = createState(options);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/\.(tsx?|jsx?|css|json|png|svg|ico|woff2?)(\?.*)?$/.test(url.pathname)) {
      await route.fallback();
      return;
    }
    const method = request.method();
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const body = parseBody(route);

    if (path === '/health') {
      await route.fulfill(json({ ok: true, ts: nowIso() }));
      return;
    }

    if (path === '/gemini/chat' && method === 'POST') {
      const requestBody = body as {
        contents?: Array<{ parts?: Array<{ text?: string }> }>;
      };
      const lastPrompt =
        requestBody.contents?.at(-1)?.parts?.map((part) => part.text ?? '').join(' ').trim() ||
        'Explain the current pricing setup.';
      const answer = [
        'Mock Gemini review: ',
        `I analyzed "${lastPrompt}". `,
        'The current pricing setup remains inside a governed mock flow with active market context and deal coverage.',
      ];
      const sseBody = answer
        .map((text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`)
        .concat('data: [DONE]\n\n')
        .join('');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody,
      });
      return;
    }

    if (path === '/audit' && method === 'GET') {
      await route.fulfill(json(state.audit));
      return;
    }
    if (path === '/audit' && method === 'POST') {
      state.audit.unshift({
        id: `audit-${state.audit.length + 1}`,
        timestamp: nowIso(),
        ...(body as Record<string, unknown>),
      });
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (path === '/audit/paginated' && method === 'GET') {
      await route.fulfill(json({ data: state.audit, total: state.audit.length }));
      return;
    }

    if (path === '/observability/summary' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id') ?? DEFAULT_ENTITY_ID;
      await route.fulfill(json(buildObservabilitySummary(entityId, state)));
      return;
    }
    if (path === '/observability/metrics/recent' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id') ?? DEFAULT_ENTITY_ID;
      const metricName = url.searchParams.get('metric_name') ?? '';
      const limit = Number(url.searchParams.get('limit') ?? '50');
      const rows = state.recentMetrics
        .filter(
          (metric) =>
            String(metric.entity_id ?? '') === entityId &&
            String(metric.metric_name ?? '') === metricName,
        )
        .slice(0, limit);
      await route.fulfill(json(rows));
      return;
    }
    if (path === '/observability/alert-rules' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id');
      const rows = entityId
        ? state.alertRules.filter((rule) => String(rule.entity_id ?? '') === entityId)
        : state.alertRules;
      await route.fulfill(json(rows));
      return;
    }
    if (path === '/observability/alert-rules' && method === 'POST') {
      const payload = body as Record<string, unknown>;
      const row = {
        id: String((payload.id as string | undefined) ?? `alert-${state.alertRules.length + 1}`),
        created_at: nowIso(),
        ...payload,
      };
      const index = state.alertRules.findIndex((rule) => String(rule.id ?? '') === String(row.id));
      if (index >= 0) state.alertRules[index] = row;
      else state.alertRules.unshift(row);
      await route.fulfill(json(row));
      return;
    }
    if (/^\/observability\/alert-rules\/[^/]+\/toggle$/.test(path) && method === 'PATCH') {
      const alertId = path.split('/')[3] ?? '';
      state.alertRules = state.alertRules.map((rule) =>
        String(rule.id ?? '') === alertId
          ? { ...rule, is_active: Boolean((body as { is_active?: boolean }).is_active) }
          : rule,
      );
      const row = state.alertRules.find((rule) => String(rule.id ?? '') === alertId);
      await route.fulfill(json(row ?? { error: 'Not found' }, row ? 200 : 404));
      return;
    }
    if (/^\/observability\/alert-rules\/[^/]+$/.test(path) && method === 'DELETE') {
      const alertId = path.split('/')[3] ?? '';
      state.alertRules = state.alertRules.filter((rule) => String(rule.id ?? '') !== alertId);
      await route.fulfill(json({ ok: true }));
      return;
    }

    if (path === '/deals' && method === 'GET') {
      await fulfillDeals(route, url, state);
      return;
    }
    if (path === '/deals/light' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id');
      const rows = entityId
        ? state.deals.filter((deal) => String(deal.entity_id ?? '') === entityId)
        : state.deals;
      await route.fulfill(
        json(
          rows.map((deal) => ({
            id: deal.id ?? '',
            status: deal.status ?? '',
            client_id: deal.client_id ?? '',
            product_type: deal.product_type ?? '',
            amount: deal.amount ?? 0,
            currency: deal.currency ?? 'USD',
            entity_id: deal.entity_id ?? DEFAULT_ENTITY_ID,
            created_at: deal.created_at,
          })),
        ),
      );
      return;
    }
    if (path === '/deals/paginated' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id');
      const rows = entityId
        ? state.deals.filter((deal) => String(deal.entity_id ?? '') === entityId)
        : state.deals;
      await route.fulfill(json({ data: rows, total: rows.length }));
      return;
    }
    if (path === '/deals/cursor' && method === 'GET') {
      const entityId = url.searchParams.get('entity_id');
      const rows = entityId
        ? state.deals.filter((deal) => String(deal.entity_id ?? '') === entityId)
        : state.deals;
      await route.fulfill(json({ data: rows, cursor: null, hasMore: false }));
      return;
    }
    if (path === '/deals/upsert' && method === 'POST') {
      const row = withDealDefaults(
        body as Partial<MockDealRow>,
        nextDealId(state.deals.length),
      );
      const index = findDealIndex(state.deals, row.id);
      if (index >= 0) state.deals[index] = row;
      else state.deals.unshift(row);
      await route.fulfill(json(row));
      return;
    }
    if (path === '/deals/batch-upsert' && method === 'POST') {
      const rows = Array.isArray(body)
        ? body.map((deal, index) =>
            withDealDefaults(
              deal as Partial<MockDealRow>,
              nextDealId(state.deals.length + index),
            ),
          )
        : [];
      for (const row of rows) {
        const index = findDealIndex(state.deals, row.id);
        if (index >= 0) state.deals[index] = row;
        else state.deals.unshift(row);
      }
      await route.fulfill(json(rows));
      return;
    }
    if (/^\/deals\/[^/]+\/lock-update$/.test(path) && method === 'PATCH') {
      const dealId = path.split('/')[2] ?? '';
      const payload = (body as { deal?: Partial<MockDealRow> }).deal ?? {};
      const row = withDealDefaults(payload, dealId);
      row.id = dealId;
      const index = findDealIndex(state.deals, dealId);
      if (index >= 0) state.deals[index] = row;
      else state.deals.unshift(row);
      await route.fulfill(json({ conflict: false, deal: row }));
      return;
    }
    if (/^\/deals\/[^/]+\/transition$/.test(path) && method === 'PATCH') {
      const dealId = path.split('/')[2] ?? '';
      const index = findDealIndex(state.deals, dealId);
      if (index >= 0) {
        state.deals[index] = {
          ...state.deals[index],
          status:
            (body as { newStatus?: MockDealRow['status'] }).newStatus ??
            state.deals[index].status ??
            'Pending',
          updated_at: nowIso(),
        };
        await route.fulfill(json(state.deals[index]));
        return;
      }
      await route.fulfill(json({ error: 'Not found' }, 404));
      return;
    }
    if (/^\/deals\/[^/]+\/rename$/.test(path) && method === 'POST') {
      const dealId = path.split('/')[2] ?? '';
      const nextId = String((body as { nextId?: string }).nextId ?? '');
      const index = findDealIndex(state.deals, dealId);
      if (index >= 0 && nextId) {
        state.deals[index] = {
          ...state.deals[index],
          id: nextId,
          updated_at: nowIso(),
        };
        await route.fulfill(json(state.deals[index]));
        return;
      }
      await route.fulfill(json({ error: 'Not found' }, 404));
      return;
    }
    if (/^\/deals\/[^/]+\/versions$/.test(path)) {
      await route.fulfill(method === 'GET' ? json([]) : json({ ok: true }));
      return;
    }
    if (/^\/deals\/[^/]+\/comments$/.test(path)) {
      await route.fulfill(method === 'GET' ? json([]) : json({ ok: true }));
      return;
    }
    if (/^\/deals\/[^/]+\/pricing-results$/.test(path) && method === 'POST') {
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (/^\/deals\/[^/]+\/pricing-history$/.test(path) && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (/^\/deals\/[^/]+$/.test(path) && method === 'DELETE') {
      const dealId = path.split('/')[2] ?? '';
      state.deals = state.deals.filter((deal) => deal.id !== dealId);
      await route.fulfill(noContent());
      return;
    }

    if (path.startsWith('/config/')) {
      if (await fulfillConfig(route, path, method, body, state)) return;
    }

    if (path === '/config/notifications' && method === 'GET') {
      const email = url.searchParams.get('email');
      const rows = email
        ? state.notifications.filter((item) => item.recipient_email === email)
        : state.notifications;
      await route.fulfill(json(rows));
      return;
    }
    if (path === '/config/notifications' && method === 'POST') {
      state.notifications.unshift({
        id: state.notifications.length + 1,
        recipient_email: String((body as { recipient?: string }).recipient ?? 'demo@nfq.es'),
        sender_email: String((body as { sender?: string }).sender ?? 'system@nfq.es'),
        type: String((body as { type?: string }).type ?? 'APPROVAL_REQUEST'),
        title: String((body as { title?: string }).title ?? 'Notification'),
        message: String((body as { message?: string }).message ?? ''),
        deal_id: (body as { dealId?: string | null }).dealId ?? null,
        is_read: false,
        created_at: nowIso(),
      });
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (path === '/config/notifications/unread-count' && method === 'GET') {
      const email = url.searchParams.get('email');
      const count = state.notifications.filter(
        (item) => (email == null || item.recipient_email === email) && item.is_read !== true,
      ).length;
      await route.fulfill(json({ count }));
      return;
    }
    if (path === '/config/notifications/read-all' && method === 'PATCH') {
      const email = String((body as { email?: string }).email ?? '');
      state.notifications = state.notifications.map((item) =>
        !email || item.recipient_email === email ? { ...item, is_read: true } : item,
      );
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (/^\/config\/notifications\/\d+\/read$/.test(path) && method === 'PATCH') {
      const notificationId = Number(path.split('/')[3]);
      state.notifications = state.notifications.map((item) =>
        Number(item.id) === notificationId ? { ...item, is_read: true } : item,
      );
      await route.fulfill(json({ ok: true }));
      return;
    }

    if (path === '/market-data/models' && method === 'GET') {
      await route.fulfill(json(MOCK_BEHAVIOURAL_MODELS.map((model) => mapModelToDB(model))));
      return;
    }
    if (path === '/market-data/models' && method === 'POST') {
      await route.fulfill(json(body));
      return;
    }
    if (/^\/market-data\/models\/[^/]+$/.test(path) && method === 'DELETE') {
      await route.fulfill(noContent());
      return;
    }
    if (path === '/market-data/yield-curves' && method === 'GET') {
      await route.fulfill(
        json([
          {
            id: 1,
            currency: 'USD',
            as_of_date: new Date().toISOString().slice(0, 10),
            grid_data: MOCK_YIELD_CURVE,
          },
        ]),
      );
      return;
    }
    if (path === '/market-data/yield-curves' && method === 'POST') {
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (path === '/market-data/yield-curves/history' && method === 'GET') {
      await route.fulfill(
        json([
          {
            id: 1,
            currency: 'USD',
            as_of_date: new Date().toISOString().slice(0, 10),
            grid_data: MOCK_YIELD_CURVE,
          },
        ]),
      );
      return;
    }
    if (path === '/market-data/yield-curve-history' && method === 'GET') {
      await route.fulfill(
        json([
          {
            snapshot_date: new Date().toISOString().slice(0, 10),
            points: MOCK_YIELD_CURVE,
          },
        ]),
      );
      return;
    }
    if (path === '/market-data/yield-curve-history' && method === 'POST') {
      await route.fulfill(json({ ok: true }));
      return;
    }
    if (path === '/market-data/liquidity-curves' && method === 'GET') {
      await route.fulfill(
        json(
          MOCK_LIQUIDITY_CURVES.map((curve) => ({
            currency: curve.currency,
            curve_type: curve.curveType,
            last_update: curve.lastUpdate,
            points: curve.points,
          })),
        ),
      );
      return;
    }

    if (path === '/entities/groups' && method === 'GET') {
      await route.fulfill(json(MOCK_GROUPS.map((group) => ({ ...mapGroupToDB(group), created_at: group.createdAt }))));
      return;
    }
    if (path === '/entities/entities' && method === 'GET') {
      await route.fulfill(json(MOCK_ENTITIES.map((entity) => ({ ...mapEntityToDB(entity), created_at: entity.createdAt }))));
      return;
    }
    if (/^\/entities\/groups\/[^/]+$/.test(path) && method === 'GET') {
      const group = MOCK_GROUPS.find((item) => item.id === path.split('/')[3]) ?? MOCK_GROUPS[0];
      await route.fulfill(json({ ...mapGroupToDB(group), created_at: group.createdAt }));
      return;
    }
    if (/^\/entities\/entities\/[^/]+$/.test(path) && method === 'GET') {
      const entity = MOCK_ENTITIES.find((item) => item.id === path.split('/')[3]) ?? MOCK_ENTITIES[0];
      await route.fulfill(json({ ...mapEntityToDB(entity), created_at: entity.createdAt }));
      return;
    }
    if (/^\/entities\/(groups|entities)$/.test(path) && method === 'POST') {
      await route.fulfill(json(body));
      return;
    }
    if (path === '/entities/entity-users' && method === 'GET') {
      const email = url.searchParams.get('email');
      const entityId = url.searchParams.get('entity_id');
      let rows = MOCK_ENTITY_USERS;
      if (email) rows = rows.filter((item) => item.userId === email);
      if (entityId) rows = rows.filter((item) => item.entityId === entityId);
      await route.fulfill(
        json(
          rows.map((item) => ({
            entity_id: item.entityId,
            user_id: item.userId,
            role: item.role,
            default_bu_id: item.defaultBuId ?? null,
            is_primary_entity: item.isPrimaryEntity,
          })),
        ),
      );
      return;
    }
    if (path === '/entities/entity-users' && method === 'POST') {
      await route.fulfill(json({ ok: true }));
      return;
    }

    if (path === '/pricing/delegation-check' && method === 'POST') {
      const input = (body as { input: Parameters<typeof resolveDelegation>[0] }).input;
      await route.fulfill(json(resolveDelegation(input)));
      return;
    }
    if (path === '/pricing/inverse-optimize' && method === 'POST') {
      const payload = body as {
        deal: Parameters<typeof optimizeMarginForTargetRaroc>[0]['deal'];
        targetRaroc: number;
        approvalMatrix?: Parameters<typeof optimizeMarginForTargetRaroc>[0]['approvalMatrix'];
      };
      await route.fulfill(
        json(
          optimizeMarginForTargetRaroc({
            deal: payload.deal,
            targetRaroc: Number(payload.targetRaroc ?? 0),
            approvalMatrix: payload.approvalMatrix ?? {
              autoApprovalThreshold: 15,
              l1Threshold: 10,
              l2Threshold: 5,
            },
          }),
        ),
      );
      return;
    }
    if (path === '/pricing/explain-waterfall' && method === 'POST') {
      const payload = body as { deal: unknown; result: unknown; language?: string };
      const language = payload.language === 'en' ? 'en' : 'es';
      const markdown = buildWaterfallExplanation(
        payload.deal as Parameters<typeof buildWaterfallExplanation>[0],
        payload.result as Parameters<typeof buildWaterfallExplanation>[1],
        { language },
      );
      await route.fulfill(
        json({
          markdown,
          systemPrompt: 'You are a pricing copilot focused on clear FTP explanations.',
        }),
      );
      return;
    }
    if (path === '/pricing/portfolio-review' && method === 'POST') {
      const payload = body as {
        portfolio?: Parameters<typeof runPortfolioReview>[0];
        asOfDate?: string;
      };
      await route.fulfill(
        json(runPortfolioReview(payload.portfolio ?? [], payload.asOfDate)),
      );
      return;
    }
    if (path === '/pricing/mrm-backtest' && method === 'POST') {
      const payload = body as {
        category?: string;
        modelId?: string;
        observations?: Parameters<typeof backtestPDModel>[1];
      };
      const category = payload.category ?? 'BEHAVIORAL';
      const modelId = payload.modelId ?? 'MODEL-E2E';
      const observations = payload.observations ?? [];
      const result =
        category === 'PD'
          ? backtestPDModel(modelId, observations)
          : category === 'LGD'
            ? backtestLGDModel(modelId, observations)
            : backtestBehavioralModel(
                modelId,
                category as Parameters<typeof backtestBehavioralModel>[1],
                observations,
              );
      await route.fulfill(json(result));
      return;
    }

    if (path === '/gemini/chat' && method === 'POST') {
      await route.fulfill(
        json({
          candidates: [
            {
              content: {
                parts: [{ text: 'Mock Gemini response for E2E validation.' }],
              },
            },
          ],
        }),
      );
      return;
    }

    // ── Target Grid endpoints ──
    if (path === '/target-grid/snapshots' && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (/^\/target-grid\/snapshots\/[^/]+$/.test(path) && method === 'GET') {
      await route.fulfill(json(null));
      return;
    }
    if (path === '/target-grid/snapshots' && method === 'POST') {
      await route.fulfill(json(body));
      return;
    }
    if (path === '/target-grid/cells' && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (path === '/target-grid/diff' && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (path === '/target-grid/templates' && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (/^\/target-grid\/templates(\/[^/]+)?$/.test(path) && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      await route.fulfill(method === 'DELETE' ? noContent() : json(body));
      return;
    }

    // ── Pricing Discipline endpoints ──
    if (path === '/discipline/kpis' && method === 'GET') {
      await route.fulfill(json({
        totalDeals: 0,
        inBandCount: 0,
        inBandPct: 0,
        outOfBandCount: 0,
        totalLeakageEur: 0,
        leakageTrend: 0,
        avgFtpVarianceBps: 0,
        avgRarocVariancePp: 0,
      }));
      return;
    }
    if (path === '/discipline/variances' && method === 'GET') {
      await route.fulfill(json({ data: [], total: 0 }));
      return;
    }
    if (path === '/discipline/tolerance-bands' && method === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (/^\/discipline\/tolerance-bands(\/[^/]+)?$/.test(path) && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      await route.fulfill(method === 'DELETE' ? noContent() : json(body));
      return;
    }
    if (path === '/discipline/cohort-breakdown' && method === 'GET') {
      await route.fulfill(json({ cohort: {}, deals: [], summary: {} }));
      return;
    }
    if (path === '/discipline/originator-scorecard' && method === 'GET') {
      await route.fulfill(json(null));
      return;
    }
    if (/^\/discipline\/exceptions(\/[^/]+)?$/.test(path)) {
      if (method === 'GET') {
        await route.fulfill(json([]));
        return;
      }
      await route.fulfill(method === 'DELETE' ? noContent() : json(body));
      return;
    }

    // ---------- CLV + 360º temporal (Phase 6) ----------
    const clvMatch = path.match(/^\/clv\/clients\/([^/]+)\/(timeline|ltv|nba)(?:\/generate|\/recompute)?$/);
    if (clvMatch) {
      const clientId = clvMatch[1];
      const kind = clvMatch[2];
      if (kind === 'timeline' && method === 'GET') {
        await route.fulfill(json([
          { id: 'evt-1', entityId: DEFAULT_ENTITY_ID, clientId, eventType: 'deal_booked', eventTs: '2026-03-01T10:00:00Z', source: 'pricing', dealId: null, positionId: null, amountEur: 500_000, payload: {}, createdBy: null, createdAt: '2026-03-01T10:00:00Z' },
          { id: 'evt-2', entityId: DEFAULT_ENTITY_ID, clientId, eventType: 'contact',     eventTs: '2026-04-05T14:00:00Z', source: 'crm',     dealId: null, positionId: null, amountEur: null, payload: { subject: 'Review meeting' }, createdBy: null, createdAt: '2026-04-05T14:00:00Z' },
        ]));
        return;
      }
      if (kind === 'timeline' && method === 'POST') {
        await route.fulfill(json({ id: 'evt-new', entityId: DEFAULT_ENTITY_ID, clientId, eventType: (body as { eventType?: string })?.eventType ?? 'contact', eventTs: nowIso(), source: 'manual', dealId: null, positionId: null, amountEur: null, payload: {}, createdBy: null, createdAt: nowIso() }));
        return;
      }
      if (kind === 'ltv' && method === 'GET') {
        await route.fulfill(json([
          {
            id: 'snap-1', entityId: DEFAULT_ENTITY_ID, clientId, asOfDate: '2026-04-15',
            horizonYears: 10, discountRate: 0.08,
            clvPointEur: 1_250_000, clvP5Eur: 980_000, clvP95Eur: 1_520_000,
            churnHazardAnnual: 0.08, renewalProb: 0.65,
            shareOfWalletEst: 0.45, shareOfWalletGap: 0.55,
            breakdown: { niiEur: 900_000, crosssellEur: 220_000, feesEur: 180_000, churnCostEur: 50_000, perPosition: [] },
            assumptions: { asOfDate: '2026-04-15', horizonYears: 10, discountRate: 0.08, churnHazardAnnual: 0.08, renewalProb: 0.65, crosssellProbPerYear: 0.12, capitalAllocationRate: 0.08, rarocByProduct: {}, shareOfWalletEst: 0.45, churnCostPerEur: 0.015 },
            assumptionsHash: 'a'.repeat(64),
            engineVersion: 'mock',
            computedAt: nowIso(),
            computedBy: 'mock',
          },
        ]));
        return;
      }
      if (kind === 'ltv' && method === 'POST') {
        await route.fulfill(json({
          id: 'snap-new', entityId: DEFAULT_ENTITY_ID, clientId, asOfDate: new Date().toISOString().slice(0, 10),
          horizonYears: 10, discountRate: 0.08,
          clvPointEur: 1_300_000, clvP5Eur: 1_020_000, clvP95Eur: 1_580_000,
          churnHazardAnnual: 0.08, renewalProb: 0.65,
          shareOfWalletEst: 0.48, shareOfWalletGap: 0.52,
          breakdown: { niiEur: 950_000, crosssellEur: 230_000, feesEur: 180_000, churnCostEur: 60_000, perPosition: [] },
          assumptions: { asOfDate: new Date().toISOString().slice(0, 10), horizonYears: 10, discountRate: 0.08, churnHazardAnnual: 0.08, renewalProb: 0.65, crosssellProbPerYear: 0.12, capitalAllocationRate: 0.08, rarocByProduct: {}, shareOfWalletEst: 0.48, churnCostPerEur: 0.015 },
          assumptionsHash: 'b'.repeat(64),
          engineVersion: 'mock',
          computedAt: nowIso(),
          computedBy: 'mock',
        }));
        return;
      }
      if (kind === 'nba' && method === 'GET') {
        await route.fulfill(json([
          {
            id: 'nba-1', entityId: DEFAULT_ENTITY_ID, clientId,
            recommendedProduct: 'FX_Hedging', recommendedRateBps: 40, recommendedVolumeEur: 1_500_000, recommendedCurrency: 'EUR',
            expectedClvDeltaEur: 320_000, confidence: 0.78,
            reasonCodes: ['product_gap_core', 'renewal_window_open'], rationale: 'FX_Hedging ticket €1.5M → ΔCLV 2.1% · renewal window open · core product gap',
            source: 'engine', generatedAt: nowIso(), consumedAt: null, consumedBy: null,
          },
        ]));
        return;
      }
      if (kind === 'nba' && method === 'POST') {
        await route.fulfill(json([{
          id: 'nba-new', entityId: DEFAULT_ENTITY_ID, clientId,
          recommendedProduct: 'Corporate_Loan', recommendedRateBps: 420, recommendedVolumeEur: 2_000_000, recommendedCurrency: 'EUR',
          expectedClvDeltaEur: 410_000, confidence: 0.82,
          reasonCodes: ['share_of_wallet_low', 'nim_below_target'], rationale: 'Corporate_Loan ticket €2M → ΔCLV 2.7% · lifts NIM toward target · share-of-wallet expansion',
          source: 'engine', generatedAt: nowIso(), consumedAt: null, consumedBy: null,
        }]));
        return;
      }
    }
    if (/^\/clv\/nba\/[^/]+\/consume$/.test(path) && method === 'PATCH') {
      await route.fulfill(json({ id: 'nba-1', consumedAt: nowIso(), consumedBy: 'demo@nfq.es' }));
      return;
    }
    // Cross-client firmwide pipeline feed — powers /pipeline.
    if (path === '/clv/nba' && method === 'GET') {
      const statusParam = url.searchParams.get('status') ?? 'open';
      const open = [
        {
          id: 'pnba-1', entityId: DEFAULT_ENTITY_ID, clientId: 'DEMO-ACME-001',
          clientName: 'Acme Industrial SA', clientSegment: 'Large Corporate', clientRating: 'A',
          recommendedProduct: 'FX_Hedging', recommendedRateBps: 40, recommendedVolumeEur: 1_500_000, recommendedCurrency: 'EUR',
          expectedClvDeltaEur: 320_000, confidence: 0.82,
          reasonCodes: ['product_gap_core', 'renewal_window_open'],
          rationale: 'FX_Hedging €1.5M → ΔCLV 2.1% · renewal window open · core product gap',
          source: 'engine', generatedAt: nowIso(), consumedAt: null, consumedBy: null,
        },
        {
          id: 'pnba-2', entityId: DEFAULT_ENTITY_ID, clientId: 'DEMO-BETASOLAR-002',
          clientName: 'Beta Solar Energy SL', clientSegment: 'Mid-market', clientRating: 'BBB',
          recommendedProduct: 'ESG_Green_Loan', recommendedRateBps: 360, recommendedVolumeEur: 3_000_000, recommendedCurrency: 'EUR',
          expectedClvDeltaEur: 410_000, confidence: 0.75,
          reasonCodes: ['regulatory_incentive_available', 'nim_below_target'],
          rationale: 'ESG_Green_Loan €3M → ΔCLV 4.6% · regulatory incentive · NIM lift',
          source: 'engine', generatedAt: nowIso(), consumedAt: null, consumedBy: null,
        },
      ];
      const consumed = [
        {
          id: 'pnba-3', entityId: DEFAULT_ENTITY_ID, clientId: 'DEMO-GAMMAHEALTH-003',
          clientName: 'Gamma Healthcare Group', clientSegment: 'Mid-market', clientRating: 'BB',
          recommendedProduct: 'Trade_Finance', recommendedRateBps: 300, recommendedVolumeEur: 800_000, recommendedCurrency: 'EUR',
          expectedClvDeltaEur: 90_000, confidence: 0.55,
          reasonCodes: ['capacity_underused'],
          rationale: 'Trade finance €800K → ΔCLV 1.2% · capacity underused',
          source: 'engine', generatedAt: nowIso(), consumedAt: nowIso(), consumedBy: 'demo@nfq.es',
        },
      ];
      if (statusParam === 'consumed') {
        await route.fulfill(json(consumed));
      } else if (statusParam === 'all') {
        await route.fulfill(json([...open, ...consumed]));
      } else {
        await route.fulfill(json(open));
      }
      return;
    }
    // FTP Reconciliation — controller view (Phase 6.9).
    if (path === '/reconciliation/summary' && method === 'GET') {
      const period = url.searchParams.get('asOf') ?? new Date().toISOString().slice(0, 7);
      const matched = {
        dealId: 'D-MATCH-001', clientId: 'C-1', clientName: 'Acme Industrial SA',
        businessUnit: 'BU_CORP', productType: 'Corporate_Loan',
        bu:       { dealId: 'D-MATCH-001', amountEur: 5_000_000, currency: 'EUR', ratePct: 4.250, postedAt: '2026-04-12' },
        treasury: { dealId: 'D-MATCH-001', amountEur: 5_000_000, currency: 'EUR', ratePct: 4.250, postedAt: '2026-04-12' },
        matchStatus: 'matched', amountDeltaEur: 0, rateDeltaPct: 0, hint: null,
      };
      const amountMis = {
        dealId: 'D-AMT-002', clientId: 'C-2', clientName: 'Beta Solar Energy SL',
        businessUnit: 'BU_MID', productType: 'ESG_Green_Loan',
        bu:       { dealId: 'D-AMT-002', amountEur: 3_000_000, currency: 'EUR', ratePct: 3.6, postedAt: '2026-04-15' },
        treasury: { dealId: 'D-AMT-002', amountEur: 3_002_500, currency: 'EUR', ratePct: 3.6, postedAt: '2026-04-15' },
        matchStatus: 'amount_mismatch', amountDeltaEur: 2500, rateDeltaPct: 0,
        hint: 'Amount delta €2500 — expected tolerance €1',
      };
      const buOnly = {
        dealId: 'D-BU-003', clientId: 'C-3', clientName: 'Gamma Healthcare Group',
        businessUnit: 'BU_MID', productType: 'Trade_Finance',
        bu:       { dealId: 'D-BU-003', amountEur: 800_000, currency: 'EUR', ratePct: 3.0, postedAt: '2026-04-14' },
        treasury: null,
        matchStatus: 'bu_only', amountDeltaEur: 0, rateDeltaPct: 0,
        hint: 'Treasury mirror missing — open Treasury Ops',
      };
      const pairs = [matched, amountMis, buOnly];
      await route.fulfill(json({
        summary: {
          asOfPeriod: period,
          computedAt: nowIso(),
          totalEntries: 3,
          matched: 1,
          unmatched: 2,
          unknown: 0,
          amountMismatchEur: 2500,
          maxSingleDeltaEur: 2500,
          byStatus: {
            matched: 1, amount_mismatch: 1, rate_mismatch: 0, currency_mismatch: 0,
            bu_only: 1, treasury_only: 0, unknown: 0,
          },
        },
        pairs,
      }));
      return;
    }
    if (path === '/reconciliation/entries' && method === 'GET') {
      await route.fulfill(json({ asOfPeriod: new Date().toISOString().slice(0, 7), pairs: [] }));
      return;
    }
    if (path === '/clv/preview-ltv-impact' && method === 'POST') {
      await route.fulfill(json({
        before: { clvPointEur: 1_250_000, clvP5Eur: 980_000, clvP95Eur: 1_520_000 },
        impact: {
          clvBeforeEur: 1_250_000, clvAfterEur: 1_350_000,
          deltaClvEur: 100_000, deltaClvPct: 0.08,
          breakdown: { directNiiEur: 60_000, crosssellUpliftEur: 20_000, churnReductionEur: 15_000, capitalOpportunityEur: 5_000 },
        },
        assumptions: { asOfDate: new Date().toISOString().slice(0, 10), horizonYears: 10, discountRate: 0.08, churnHazardAnnual: 0.08, renewalProb: 0.65, crosssellProbPerYear: 0.12, capitalAllocationRate: 0.08, rarocByProduct: {}, shareOfWalletEst: 0.5, churnCostPerEur: 0.015 },
      }));
      return;
    }

    await route.fulfill(json({ ok: true }));
  });
}
