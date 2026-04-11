import type { Page, Route } from '@playwright/test';
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
  deals: MockDealRow[];
  notifications: Array<Record<string, unknown>>;
  systemConfig: Record<string, unknown>;
}

interface MockApiOptions {
  audit?: Array<Record<string, unknown>>;
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

function createState(options: MockApiOptions = {}): MockState {
  return {
    audit: options.audit ? [...options.audit] : [],
    deals: MOCK_DEALS.map((deal) => makeDealRow(deal)),
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

    if (path === '/deals' && method === 'GET') {
      await fulfillDeals(route, url, state);
      return;
    }
    if (path === '/deals/light' && method === 'GET') {
      await route.fulfill(
        json(
          state.deals.map((deal) => ({
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
      await route.fulfill(json({ data: state.deals, total: state.deals.length }));
      return;
    }
    if (path === '/deals/cursor' && method === 'GET') {
      await route.fulfill(json({ data: state.deals, cursor: null, hasMore: false }));
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

    await route.fulfill(json({ ok: true }));
  });
}
