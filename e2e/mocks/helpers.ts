/**
 * Mock state + pure helpers for E2E Playwright fixtures.
 *
 * Extracted from `e2e/mockApi.ts` (2026-05-14) to slim the dispatcher file
 * and group "data shaping" concerns separately from "route handling". No
 * behaviour change — the dispatcher imports these by name. Tests continue
 * importing `registerApiMocks` from `e2e/mockApi.ts` (entry point).
 */

import type { Route } from '@playwright/test';
import { DEFAULT_ENTITY_ID, MOCK_ENTITIES } from '../../utils/seedData.entities';
import { buildDemoWorkspaceData } from '../../utils/demoWorkspaceData';
import {
  INITIAL_DEAL,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_FTP_RATE_CARDS,
  MOCK_GREENIUM_GRID,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_TRANSITION_GRID,
} from '../../utils/seedData';
import { mapDealToDB } from '../../utils/supabase/mappers';
import type { AttributionDecision } from '../../types/attributions';
import type { MockApiOptions, MockDealRow, MockState } from './types';

export const nowIso = () => new Date().toISOString();

export function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

export function noContent(status = 204) {
  return {
    status,
    contentType: 'application/json',
    body: '',
  };
}

export function parseBody(route: Route): unknown {
  const payload = route.request().postData();
  if (!payload) return {};
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return {};
  }
}

export function makeDealRow(deal = INITIAL_DEAL): MockDealRow {
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

export function defaultSystemConfig(): Record<string, unknown> {
  const demoWorkspace = buildDemoWorkspaceData({
    approvalMatrix:
      MOCK_ENTITIES[0]?.approvalMatrix ?? {
        autoApprovalThreshold: 15,
        l1Threshold: 10,
        l2Threshold: 5,
      },
  });

  return {
    approval_matrix:
      MOCK_ENTITIES[0]?.approvalMatrix ?? {
        autoApprovalThreshold: 15,
        l1Threshold: 10,
        l2Threshold: 5,
      },
    approval_tasks: demoWorkspace.approvalTasks,
    greenium_grid: MOCK_GREENIUM_GRID,
    incentivisation_rules: [],
    liquidity_curves: MOCK_LIQUIDITY_CURVES,
    lr_config: MOCK_ENTITIES[0]?.lrConfig ?? null,
    market_data_sources: demoWorkspace.marketDataSources,
    methodology_change_requests: [],
    methodology_versions: demoWorkspace.methodologyVersions,
    physical_grid: MOCK_PHYSICAL_GRID,
    portfolio_snapshots: demoWorkspace.portfolioSnapshots,
    pricing_dossiers: demoWorkspace.pricingDossiers,
    raroc_inputs: null,
    rate_cards: MOCK_FTP_RATE_CARDS,
    sdr_config: MOCK_ENTITIES[0]?.sdrConfig ?? null,
    shocks: { interestRate: 0, liquiditySpread: 0 },
    transition_grid: MOCK_TRANSITION_GRID,
  };
}

export function defaultAlertRules(): Array<Record<string, unknown>> {
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

export function defaultRecentMetrics(): Array<Record<string, unknown>> {
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

export function percentileCont(values: number[], percentile: number): number | null {
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

export function buildObservabilitySummary(entityId: string, state: MockState) {
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

export function defaultAttributionDecisions(): AttributionDecision[] {
  return [
    {
      id: 'd1',
      entityId: 'demo-entity',
      dealId: 'ABC-1234',
      requiredLevelId: 'office',
      decidedByLevelId: null,
      decidedByUser: null,
      decision: 'escalated',
      reason: null,
      pricingSnapshotHash: 'h-1',
      routingMetadata: { deviationBps: -7.2, rarocPp: 13.8, volumeEur: 80_000, scope: {} },
      decidedAt: nowIso(),
    },
    {
      id: 'd2',
      entityId: 'demo-entity',
      dealId: 'ABC-1240',
      requiredLevelId: 'zone',
      decidedByLevelId: null,
      decidedByUser: null,
      decision: 'escalated',
      reason: null,
      pricingSnapshotHash: 'h-2',
      routingMetadata: { deviationBps: -12, rarocPp: 11.5, volumeEur: 320_000, scope: {} },
      decidedAt: nowIso(),
    },
  ];
}

export function createState(options: MockApiOptions = {}): MockState {
  return {
    audit: options.audit ? [...options.audit] : [],
    alertRules: options.alertRules ? [...options.alertRules] : defaultAlertRules(),
    attributionDecisions: options.attributionDecisions
      ? [...options.attributionDecisions]
      : defaultAttributionDecisions(),
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

export function nextDealId(currentCount: number): string {
  return `DL-E2E-${String(currentCount + 1).padStart(4, '0')}`;
}

export function findDealIndex(deals: MockDealRow[], id?: string | null): number {
  if (!id) return -1;
  return deals.findIndex((deal) => deal.id === id);
}

export function withDealDefaults(payload: Partial<MockDealRow>, fallbackId: string): MockDealRow {
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

export function statefulDealId(clientId: string): string {
  return `DL-${clientId}-REL`;
}

export function buildCustomerRelationship(clientId: string) {
  const client = MOCK_CLIENTS.find((item) => item.id === clientId) ?? MOCK_CLIENTS[0];
  const positions = [
    {
      id: `${clientId}-pos-1`,
      entityId: DEFAULT_ENTITY_ID,
      clientId,
      productId: 'loan',
      productType: 'Loan',
      category: 'Asset',
      dealId: statefulDealId(clientId),
      amount: 4_200_000,
      currency: 'EUR',
      marginBps: 185,
      startDate: '2025-01-01',
      maturityDate: '2029-01-01',
      status: 'Active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: `${clientId}-pos-2`,
      entityId: DEFAULT_ENTITY_ID,
      clientId,
      productId: 'deposit',
      productType: 'Deposit',
      category: 'Liability',
      dealId: null,
      amount: 1_800_000,
      currency: 'EUR',
      marginBps: 35,
      startDate: '2025-06-01',
      maturityDate: null,
      status: 'Active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
  const latest = {
    id: `${clientId}-metrics-latest`,
    entityId: DEFAULT_ENTITY_ID,
    clientId,
    period: '2026-Q2',
    computedAt: nowIso(),
    nimBps: 190,
    feesEur: 53_000,
    evaEur: 150_000,
    shareOfWalletPct: 0.45,
    relationshipAgeYears: 4.75,
    npsScore: 52,
    activePositionCount: positions.length,
    totalExposureEur: positions.reduce((sum, position) => sum + position.amount, 0),
    source: 'computed',
    detail: {},
  };
  return {
    client,
    positions,
    metrics: { latest, history: [latest] },
    applicableTargets: [],
    derived: {
      activePositionCount: positions.length,
      totalExposureEur: latest.totalExposureEur,
      productTypesHeld: Array.from(new Set(positions.map((position) => position.productType))),
      relationshipAgeYears: latest.relationshipAgeYears,
      isMultiProduct: true,
    },
  };
}
