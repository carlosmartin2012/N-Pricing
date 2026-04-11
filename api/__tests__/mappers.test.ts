import { describe, expect, it } from 'vitest';
import type {
  AuditEntry,
  DealComment,
  DualLiquidityCurve,
  Notification,
  YieldCurvePoint,
} from '../../types';
import type { Group, Entity, EntityUser } from '../../types/entity';
import type { ReportRun, ReportSchedule } from '../../types/reportSchedule';
import {
  INITIAL_DEAL,
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_FTP_RATE_CARDS,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
} from '../../utils/seedData';
import { DEFAULT_ENTITY_ID, MOCK_ENTITIES, MOCK_GROUPS } from '../../utils/seedData.entities';
import {
  mapAuditFromDB,
  mapAuditToDB,
  mapBUFromDB,
  mapClientFromDB,
  mapDealCommentFromDB,
  mapDealFromDB,
  mapDealToDB,
  mapEntityFromDB,
  mapEntityToDB,
  mapEntityUserFromDB,
  mapGroupFromDB,
  mapGroupToDB,
  mapLiquidityCurveFromDB,
  mapModelFromDB,
  mapModelToDB,
  mapNotificationFromDB,
  mapProductFromDB,
  mapRateCardsFromDB,
  mapReportRunFromDB,
  mapReportScheduleFromDB,
  mapReportScheduleToDB,
  mapRuleFromDB,
  mapRuleToDB,
  mapRuleVersionFromDB,
  mapYieldCurveSnapshotFromDB,
} from '../mappers';

function normalizeDealForComparison() {
  const dbRow = mapDealToDB({
    ...INITIAL_DEAL,
    id: 'DL-MAPPER-001',
    entityId: DEFAULT_ENTITY_ID,
    version: 3,
  });
  return mapDealFromDB({
    ...dbRow,
    version: dbRow.version ?? 1,
  });
}

describe('api/mappers', () => {
  it('round-trips deals through the public mapper contract', () => {
    const mapped = normalizeDealForComparison();

    expect(mapped).toMatchObject({
      id: 'DL-MAPPER-001',
      clientId: INITIAL_DEAL.clientId,
      productType: INITIAL_DEAL.productType,
      amount: INITIAL_DEAL.amount,
      entityId: DEFAULT_ENTITY_ID,
      version: 3,
    });
  });

  it('round-trips behavioural models', () => {
    const model = MOCK_BEHAVIOURAL_MODELS[0];
    const mapped = mapModelFromDB(mapModelToDB(model));

    expect(mapped).toEqual(model);
  });

  it('round-trips rules', () => {
    const rule = MOCK_RULES[0];
    const mapped = mapRuleFromDB({ ...mapRuleToDB(rule), id: rule.id });

    expect(mapped).toMatchObject({
      id: rule.id,
      businessUnit: rule.businessUnit,
      product: rule.product,
      segment: rule.segment,
      tenor: rule.tenor,
      baseMethod: rule.baseMethod,
      baseReference: rule.baseReference,
      spreadMethod: rule.spreadMethod,
      liquidityReference: rule.liquidityReference,
      strategicSpread: rule.strategicSpread,
    });
  });

  it('maps liquidity curves from snake_case payloads', () => {
    const row = {
      currency: 'EUR',
      curve_type: 'secured',
      last_update: '2026-04-11',
      points: [{ tenor: '1Y', wholesaleSpread: 20, termLP: 30 }],
    };

    const mapped = mapLiquidityCurveFromDB(row);

    expect(mapped).toEqual<DualLiquidityCurve>({
      currency: 'EUR',
      curveType: 'secured',
      lastUpdate: '2026-04-11',
      points: [{ tenor: '1Y', wholesaleSpread: 20, termLP: 30 }],
    });
  });

  it('maps yield curve snapshots from DB rows', () => {
    const points: YieldCurvePoint[] = [{ tenor: '1Y', rate: 3.25 }];
    const mapped = mapYieldCurveSnapshotFromDB({
      id: 7,
      currency: 'USD',
      as_of_date: '2026-04-11',
      grid_data: points,
    });

    expect(mapped).toEqual({
      id: 7,
      currency: 'USD',
      asOfDate: '2026-04-11',
      gridData: points,
    });
  });

  it('round-trips audit payloads with defaults on read', () => {
    const entry: AuditEntry = {
      id: 'audit-1',
      timestamp: '2026-04-11T08:00:00.000Z',
      userEmail: 'demo@nfq.es',
      userName: 'Demo User',
      action: 'PRICE_DEAL',
      module: 'CALCULATOR',
      description: 'Deal priced',
      details: { source: 'unit-test' },
    };

    const mapped = mapAuditFromDB({ id: 99, ...mapAuditToDB(entry) });

    expect(mapped).toMatchObject({
      userEmail: entry.userEmail,
      userName: entry.userName,
      action: entry.action,
      module: entry.module,
      description: entry.description,
      details: entry.details,
    });
  });

  it('fills audit defaults when DB rows are partial', () => {
    const mapped = mapAuditFromDB({});

    expect(mapped).toMatchObject({
      userEmail: 'unknown@system.com',
      userName: 'System User',
      action: 'UNKNOWN_ACTION',
      module: 'SYSTEM',
      description: 'No description provided',
      details: {},
    });
  });

  it('passes through master data records without mutation', () => {
    expect(mapClientFromDB(MOCK_CLIENTS[0])).toEqual(MOCK_CLIENTS[0]);
    expect(mapBUFromDB(MOCK_BUSINESS_UNITS[0])).toEqual(MOCK_BUSINESS_UNITS[0]);
    expect(mapProductFromDB(MOCK_PRODUCT_DEFS[0])).toEqual(MOCK_PRODUCT_DEFS[0]);
  });

  it('round-trips groups and entities', () => {
    const group = MOCK_GROUPS[0] as Group;
    const entity = MOCK_ENTITIES[0] as Entity;

    expect(
      mapGroupFromDB({
        ...mapGroupToDB(group),
        id: group.id,
        created_at: group.createdAt,
      }),
    ).toEqual(group);

    expect(
      mapEntityFromDB({
        ...mapEntityToDB(entity),
        id: entity.id,
        created_at: entity.createdAt,
      }),
    ).toEqual(entity);
  });

  it('maps entity users from DB rows', () => {
    const mapped = mapEntityUserFromDB({
      entity_id: DEFAULT_ENTITY_ID,
      user_id: 'demo@nfq.es',
      role: 'Admin',
      default_bu_id: 'BU-001',
      is_primary_entity: true,
    });

    expect(mapped).toEqual<EntityUser>({
      entityId: DEFAULT_ENTITY_ID,
      userId: 'demo@nfq.es',
      role: 'Admin',
      defaultBuId: 'BU-001',
      isPrimaryEntity: true,
    });
  });

  it('applies entity defaults for optional DB columns', () => {
    const mapped = mapEntityFromDB({
      ...mapEntityToDB(MOCK_ENTITIES[0] as Entity),
      id: MOCK_ENTITIES[0].id,
      created_at: MOCK_ENTITIES[0].createdAt,
      legal_name: undefined,
      timezone: undefined,
      approval_matrix: undefined,
      sdr_config: undefined,
      lr_config: undefined,
      is_active: undefined,
    });

    expect(mapped.legalName).toBe('');
    expect(mapped.timezone).toBe('Europe/Madrid');
    expect(mapped.approvalMatrix).toEqual({});
    expect(mapped.sdrConfig).toEqual({});
    expect(mapped.lrConfig).toEqual({});
    expect(mapped.isActive).toBe(true);
  });

  it('round-trips report schedules', () => {
    const schedule: ReportSchedule = {
      id: 'rs-1',
      entityId: DEFAULT_ENTITY_ID,
      name: 'Daily FTP',
      reportType: 'pricing_analytics',
      frequency: 'daily',
      format: 'pdf',
      recipients: ['demo@nfq.es'],
      config: { section: 'summary' },
      isActive: true,
      lastRunAt: null,
      nextRunAt: '2026-04-12T06:00:00.000Z',
      createdBy: 'demo@nfq.es',
      createdAt: '2026-04-11T06:00:00.000Z',
    };

    const mapped = mapReportScheduleFromDB({
      ...mapReportScheduleToDB(schedule),
      id: schedule.id,
      last_run_at: schedule.lastRunAt,
      next_run_at: schedule.nextRunAt,
      created_at: schedule.createdAt,
    });

    expect(mapped).toEqual(schedule);
  });

  it('maps report runs from DB rows', () => {
    const mapped = mapReportRunFromDB({
      id: 'rr-1',
      schedule_id: 'rs-1',
      entity_id: DEFAULT_ENTITY_ID,
      status: 'completed',
      output_url: 'https://example.com/report.pdf',
      error_message: null,
      started_at: '2026-04-11T06:00:00.000Z',
      completed_at: '2026-04-11T06:02:00.000Z',
    });

    expect(mapped).toEqual<ReportRun>({
      id: 'rr-1',
      scheduleId: 'rs-1',
      entityId: DEFAULT_ENTITY_ID,
      status: 'completed',
      outputUrl: 'https://example.com/report.pdf',
      errorMessage: null,
      startedAt: '2026-04-11T06:00:00.000Z',
      completedAt: '2026-04-11T06:02:00.000Z',
    });
  });

  it('maps deal comments and notifications from DB rows', () => {
    const comment = mapDealCommentFromDB({
      id: 1,
      deal_id: 'DL-1',
      user_email: 'demo@nfq.es',
      user_name: 'Demo User',
      action: 'COMMENT',
      comment: 'Looks good',
      created_at: '2026-04-11T06:00:00.000Z',
    });
    const notification = mapNotificationFromDB({
      id: 2,
      recipient_email: 'demo@nfq.es',
      sender_email: 'system@nfq.es',
      type: 'APPROVAL_REQUEST',
      title: 'Ready',
      message: 'Portfolio refreshed',
      deal_id: 'DL-1',
      is_read: false,
      created_at: '2026-04-11T06:00:00.000Z',
    });

    expect(comment).toEqual<DealComment>({
      id: 1,
      dealId: 'DL-1',
      userEmail: 'demo@nfq.es',
      userName: 'Demo User',
      action: 'COMMENT',
      comment: 'Looks good',
      createdAt: '2026-04-11T06:00:00.000Z',
    });
    expect(notification).toEqual<Notification>({
      id: 2,
      recipientEmail: 'demo@nfq.es',
      senderEmail: 'system@nfq.es',
      type: 'APPROVAL_REQUEST',
      title: 'Ready',
      message: 'Portfolio refreshed',
      dealId: 'DL-1',
      isRead: false,
      createdAt: '2026-04-11T06:00:00.000Z',
    });
  });

  it('returns rate cards only for array payloads', () => {
    expect(mapRateCardsFromDB(MOCK_FTP_RATE_CARDS)).toEqual(MOCK_FTP_RATE_CARDS);
    expect(mapRateCardsFromDB({ id: 'invalid' })).toEqual([]);
  });

  it('maps rule versions from snake_case rows', () => {
    const rule = MOCK_RULES[0];
    const mapped = mapRuleVersionFromDB({
      ...mapRuleToDB(rule),
      id: 101,
      rule_id: rule.id,
      version: 4,
      formula_spec: { baseRateKey: 'DTM', lpFormula: 'LP_DTM' },
      effective_from: '2026-04-11',
      effective_to: '2026-06-30',
      changed_by: 'demo@nfq.es',
      change_reason: 'Refresh curve methodology',
      created_at: '2026-04-11T09:00:00.000Z',
    });

    expect(mapped).toEqual({
      id: 101,
      ruleId: rule.id,
      version: 4,
      businessUnit: rule.businessUnit,
      product: rule.product,
      segment: rule.segment,
      tenor: rule.tenor,
      baseMethod: rule.baseMethod,
      baseReference: rule.baseReference,
      spreadMethod: rule.spreadMethod,
      liquidityReference: rule.liquidityReference,
      strategicSpread: rule.strategicSpread,
      formulaSpec: { baseRateKey: 'DTM', lpFormula: 'LP_DTM' },
      effectiveFrom: '2026-04-11',
      effectiveTo: '2026-06-30',
      changedBy: 'demo@nfq.es',
      changeReason: 'Refresh curve methodology',
      createdAt: '2026-04-11T09:00:00.000Z',
    });
  });
});
