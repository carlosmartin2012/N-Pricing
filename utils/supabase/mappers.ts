import type {
  AuditEntry,
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  DealComment,
  FtpRateCard,
  GeneralRule,
  Notification,
  ProductDefinition,
  RuleVersion,
  Transaction,
} from '../../types';
import type { Entity, EntityUser, Group } from '../../types/entity';
import type { ReportRun, ReportSchedule } from '../../types/reportSchedule';
import { nowIso } from './shared';

type DealRow = {
  id?: string;
  status?: Transaction['status'];
  client_id: string;
  client_type: string;
  business_unit: string;
  funding_business_unit: string;
  business_line: string;
  product_type: string;
  currency: string;
  amount: number;
  start_date: string;
  duration_months: number;
  amortization: Transaction['amortization'];
  repricing_freq: Transaction['repricingFreq'];
  margin_target: number;
  behavioural_model_id?: string;
  risk_weight: number;
  capital_ratio: number;
  target_roe: number;
  operational_cost_bps: number;
  lcr_outflow_pct?: number;
  category: Transaction['category'];
  drawn_amount?: number;
  undrawn_amount?: number;
  is_committed?: boolean;
  lcr_classification?: Transaction['lcrClassification'];
  deposit_type?: Transaction['depositType'];
  behavioral_maturity_override?: number;
  transition_risk: Transaction['transitionRisk'];
  physical_risk: Transaction['physicalRisk'];
  green_format?: Transaction['greenFormat'];
  dnsh_compliant?: boolean;
  isf_eligible?: boolean;
  liquidity_spread?: number;
  _liquidity_premium_details?: number;
  _clc_charge_details?: number;
  client_rating?: string | null;
  ltv_pct?: number | string | null;
  ifrs9_stage?: number | string | null;
  entity_id?: string;
  version?: number;
};

type AuditEntryWrite = Omit<AuditEntry, 'id' | 'timestamp'> & {
  timestamp?: string;
};

type AuditEntryRow = {
  id?: string | number;
  timestamp?: string;
  user_email?: string;
  user_name?: string;
  action?: string;
  module?: AuditEntry['module'];
  description?: string;
  details?: AuditEntry['details'];
};

type BehaviouralModelRow = {
  id: string;
  name: string;
  type: BehaviouralModel['type'];
  nmd_method?: BehaviouralModel['nmdMethod'];
  description: string;
  core_ratio?: number;
  decay_rate?: number;
  beta_factor?: number;
  replication_profile?: BehaviouralModel['replicationProfile'];
  cpr?: number;
  penalty_exempt?: number;
};

type GeneralRuleRow = {
  id: number;
  business_unit: string;
  product: string;
  segment: string;
  tenor: string;
  base_method: string;
  base_reference?: string;
  spread_method: string;
  liquidity_reference?: string;
  strategic_spread: number;
};

type RuleVersionRow = GeneralRuleRow & {
  rule_id: number;
  version: number;
  formula_spec?: RuleVersion['formulaSpec'];
  effective_from: string;
  effective_to?: string;
  changed_by?: string;
  change_reason?: string;
  created_at: string;
};

type DealCommentRow = {
  id: number;
  deal_id: string;
  user_email: string;
  user_name?: string;
  action: DealComment['action'];
  comment: string;
  created_at: string;
};

type NotificationRow = {
  id: number;
  recipient_email: string;
  sender_email?: string;
  type: Notification['type'];
  title: string;
  message?: string;
  deal_id?: string;
  is_read: boolean;
  created_at: string;
};

type GroupRow = {
  id: string;
  name: string;
  short_code: string;
  country: string;
  base_currency: string;
  config?: Group['config'];
  is_active?: boolean;
  created_at: string;
};

type EntityRow = {
  id: string;
  group_id: string;
  name: string;
  legal_name?: string;
  short_code: string;
  country: string;
  base_currency: string;
  timezone?: string;
  approval_matrix?: Entity['approvalMatrix'];
  sdr_config?: Entity['sdrConfig'];
  lr_config?: Entity['lrConfig'];
  is_active?: boolean;
  created_at: string;
};

type EntityUserRow = {
  entity_id: string;
  user_id: string;
  role: EntityUser['role'];
  default_bu_id?: string | null;
  is_primary_entity?: boolean;
};

type ReportScheduleRow = {
  id: string;
  entity_id: string;
  name: string;
  report_type: ReportSchedule['reportType'];
  frequency: ReportSchedule['frequency'];
  format: ReportSchedule['format'];
  recipients?: string[];
  config?: Record<string, unknown>;
  is_active?: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string;
  created_at: string;
};

type ReportRunRow = {
  id: string;
  schedule_id: string;
  entity_id: string;
  status: ReportRun['status'];
  output_url: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export const mapDealToDB = (deal: Transaction) => ({
  id: deal.id || undefined,
  status: deal.status,
  client_id: deal.clientId,
  client_type: deal.clientType,
  business_unit: deal.businessUnit,
  funding_business_unit: deal.fundingBusinessUnit,
  business_line: deal.businessLine,
  product_type: deal.productType,
  currency: deal.currency,
  amount: deal.amount,
  start_date: deal.startDate,
  duration_months: deal.durationMonths,
  amortization: deal.amortization,
  repricing_freq: deal.repricingFreq,
  margin_target: deal.marginTarget,
  behavioural_model_id: deal.behaviouralModelId,
  risk_weight: deal.riskWeight,
  capital_ratio: deal.capitalRatio,
  target_roe: deal.targetROE,
  operational_cost_bps: deal.operationalCostBps,
  lcr_outflow_pct: deal.lcrOutflowPct,
  category: deal.category,
  drawn_amount: deal.drawnAmount,
  undrawn_amount: deal.undrawnAmount,
  is_committed: deal.isCommitted,
  lcr_classification: deal.lcrClassification,
  deposit_type: deal.depositType,
  behavioral_maturity_override: deal.behavioralMaturityOverride,
  transition_risk: deal.transitionRisk,
  physical_risk: deal.physicalRisk,
  green_format: deal.greenFormat,
  dnsh_compliant: deal.dnshCompliant,
  isf_eligible: deal.isfEligible,
  liquidity_spread: deal.liquiditySpread,
  _liquidity_premium_details: deal._liquidityPremiumDetails,
  _clc_charge_details: deal._clcChargeDetails,
  client_rating: deal.clientRating,
  ltv_pct: deal.ltvPct,
  ifrs9_stage: deal.ifrs9Stage,
  entity_id: deal.entityId,
  version: deal.version,
  updated_at: nowIso(),
});

export const mapDealFromDB = (row: Record<string, unknown>): Transaction => {
  const dealRow = row as DealRow;

  return ({
  id: dealRow.id,
  status: dealRow.status,
  clientId: dealRow.client_id,
  clientType: dealRow.client_type,
  businessUnit: dealRow.business_unit,
  fundingBusinessUnit: dealRow.funding_business_unit,
  businessLine: dealRow.business_line,
  productType: dealRow.product_type,
  currency: dealRow.currency,
  amount: dealRow.amount,
  startDate: dealRow.start_date,
  durationMonths: dealRow.duration_months,
  amortization: dealRow.amortization,
  repricingFreq: dealRow.repricing_freq,
  marginTarget: dealRow.margin_target,
  behaviouralModelId: dealRow.behavioural_model_id,
  riskWeight: dealRow.risk_weight,
  capitalRatio: dealRow.capital_ratio,
  targetROE: dealRow.target_roe,
  operationalCostBps: dealRow.operational_cost_bps,
  lcrOutflowPct: dealRow.lcr_outflow_pct,
  category: dealRow.category,
  drawnAmount: dealRow.drawn_amount,
  undrawnAmount: dealRow.undrawn_amount,
  isCommitted: dealRow.is_committed,
  lcrClassification: dealRow.lcr_classification,
  depositType: dealRow.deposit_type,
  behavioralMaturityOverride: dealRow.behavioral_maturity_override,
  transitionRisk: dealRow.transition_risk,
  physicalRisk: dealRow.physical_risk,
  greenFormat: dealRow.green_format,
  dnshCompliant: dealRow.dnsh_compliant,
  isfEligible: dealRow.isf_eligible,
  liquiditySpread: dealRow.liquidity_spread,
  _liquidityPremiumDetails: dealRow._liquidity_premium_details,
  _clcChargeDetails: dealRow._clc_charge_details,
  clientRating: dealRow.client_rating ?? undefined,
  ltvPct: dealRow.ltv_pct != null && Number.isFinite(Number(dealRow.ltv_pct)) ? Number(dealRow.ltv_pct) : undefined,
  ifrs9Stage: (() => {
    const raw = dealRow.ifrs9_stage != null ? Number(dealRow.ifrs9_stage) : NaN;
    return raw === 1 || raw === 2 || raw === 3 ? raw : undefined;
  })(),
  entityId: dealRow.entity_id,
  version: dealRow.version ?? 1,
});
};

export const mapAuditToDB = (entry: AuditEntryWrite) => ({
  user_email: entry.userEmail,
  user_name: entry.userName,
  action: entry.action,
  module: entry.module,
  description: entry.description,
  details: entry.details,
  timestamp: entry.timestamp || nowIso(),
});

export const mapAuditFromDB = (row: Record<string, unknown>): AuditEntry => {
  const auditRow = row as AuditEntryRow;

  return ({
    id: String(auditRow.id || `audit-${crypto.randomUUID()}`),
    timestamp: auditRow.timestamp || nowIso(),
    userEmail: auditRow.user_email || 'unknown@system.com',
    userName: auditRow.user_name || 'System User',
    action: auditRow.action || 'UNKNOWN_ACTION',
    module: auditRow.module || 'SYSTEM',
    description: auditRow.description || 'No description provided',
    details: auditRow.details || {},
  });
};

export const mapModelToDB = (model: BehaviouralModel) => ({
  id: model.id,
  name: model.name,
  type: model.type,
  nmd_method: model.nmdMethod,
  description: model.description,
  core_ratio: model.coreRatio,
  decay_rate: model.decayRate,
  beta_factor: model.betaFactor,
  replication_profile: model.replicationProfile,
  cpr: model.cpr,
  penalty_exempt: model.penaltyExempt,
});

export const mapModelFromDB = (row: Record<string, unknown>): BehaviouralModel => {
  const modelRow = row as BehaviouralModelRow;

  return ({
    id: modelRow.id,
    name: modelRow.name,
    type: modelRow.type,
    nmdMethod: modelRow.nmd_method,
    description: modelRow.description,
    coreRatio: modelRow.core_ratio,
    decayRate: modelRow.decay_rate,
    betaFactor: modelRow.beta_factor,
    replicationProfile: modelRow.replication_profile,
    cpr: modelRow.cpr,
    penaltyExempt: modelRow.penalty_exempt,
  });
};

export const mapRuleToDB = (rule: GeneralRule) => ({
  id: rule.id || undefined,
  business_unit: rule.businessUnit,
  product: rule.product,
  segment: rule.segment,
  tenor: rule.tenor,
  base_method: rule.baseMethod,
  base_reference: rule.baseReference,
  spread_method: rule.spreadMethod,
  liquidity_reference: rule.liquidityReference,
  strategic_spread: rule.strategicSpread,
});

export const mapRuleFromDB = (row: Record<string, unknown>): GeneralRule => {
  const ruleRow = row as GeneralRuleRow;

  return ({
    id: ruleRow.id,
    businessUnit: ruleRow.business_unit,
    product: ruleRow.product,
    segment: ruleRow.segment,
    tenor: ruleRow.tenor,
    baseMethod: ruleRow.base_method,
    baseReference: ruleRow.base_reference,
    spreadMethod: ruleRow.spread_method,
    liquidityReference: ruleRow.liquidity_reference,
    strategicSpread: ruleRow.strategic_spread,
  });
};

export const mapRuleVersionFromDB = (row: Record<string, unknown>): RuleVersion => {
  const versionRow = row as RuleVersionRow;

  return ({
    id: versionRow.id,
    ruleId: versionRow.rule_id,
    version: versionRow.version,
    businessUnit: versionRow.business_unit,
    product: versionRow.product,
    segment: versionRow.segment,
    tenor: versionRow.tenor,
    baseMethod: versionRow.base_method,
    baseReference: versionRow.base_reference,
    spreadMethod: versionRow.spread_method,
    liquidityReference: versionRow.liquidity_reference,
    strategicSpread: versionRow.strategic_spread,
    formulaSpec: versionRow.formula_spec,
    effectiveFrom: versionRow.effective_from,
    effectiveTo: versionRow.effective_to,
    changedBy: versionRow.changed_by,
    changeReason: versionRow.change_reason,
    createdAt: versionRow.created_at,
  });
};

export const mapClientFromDB = (row: ClientEntity | Record<string, unknown>): ClientEntity => ({ ...(row as unknown as ClientEntity) });
export const mapBUFromDB = (row: BusinessUnit | Record<string, unknown>): BusinessUnit => ({ ...(row as unknown as BusinessUnit) });
export const mapProductFromDB = (row: ProductDefinition | Record<string, unknown>): ProductDefinition => ({ ...(row as unknown as ProductDefinition) });

export const mapDealCommentFromDB = (row: Record<string, unknown>): DealComment => {
  const commentRow = row as DealCommentRow;

  return ({
    id: commentRow.id,
    dealId: commentRow.deal_id,
    userEmail: commentRow.user_email,
    userName: commentRow.user_name,
    action: commentRow.action,
    comment: commentRow.comment,
    createdAt: commentRow.created_at,
  });
};

export const mapNotificationFromDB = (row: Record<string, unknown>): Notification => {
  const notificationRow = row as NotificationRow;

  return ({
    id: notificationRow.id,
    recipientEmail: notificationRow.recipient_email,
    senderEmail: notificationRow.sender_email,
    type: notificationRow.type,
    title: notificationRow.title,
    message: notificationRow.message,
    dealId: notificationRow.deal_id,
    isRead: notificationRow.is_read,
    createdAt: notificationRow.created_at,
  });
};

export const mapRateCardsFromDB = (cards: unknown): FtpRateCard[] =>
  Array.isArray(cards) ? (cards as FtpRateCard[]) : [];

// --- Entity mappers ---

export const mapGroupFromDB = (row: Record<string, unknown>): Group => {
  const groupRow = row as GroupRow;

  return ({
    id: groupRow.id,
    name: groupRow.name,
    shortCode: groupRow.short_code,
    country: groupRow.country,
    baseCurrency: groupRow.base_currency,
    config: groupRow.config ?? {},
    isActive: groupRow.is_active ?? true,
    createdAt: groupRow.created_at,
  });
};

export const mapGroupToDB = (group: Partial<Group>) => ({
  ...(group.id && { id: group.id }),
  name: group.name,
  short_code: group.shortCode,
  country: group.country,
  base_currency: group.baseCurrency,
  config: group.config ?? {},
  is_active: group.isActive ?? true,
});

export const mapEntityFromDB = (row: Record<string, unknown>): Entity => {
  const entityRow = row as EntityRow;

  return ({
    id: entityRow.id,
    groupId: entityRow.group_id,
    name: entityRow.name,
    legalName: entityRow.legal_name ?? '',
    shortCode: entityRow.short_code,
    country: entityRow.country,
    baseCurrency: entityRow.base_currency,
    timezone: entityRow.timezone ?? 'Europe/Madrid',
    approvalMatrix: entityRow.approval_matrix ?? ({} as Entity['approvalMatrix']),
    sdrConfig: entityRow.sdr_config ?? ({} as Entity['sdrConfig']),
    lrConfig: entityRow.lr_config ?? ({} as Entity['lrConfig']),
    isActive: entityRow.is_active ?? true,
    createdAt: entityRow.created_at,
  });
};

export const mapEntityToDB = (entity: Partial<Entity>) => ({
  ...(entity.id && { id: entity.id }),
  group_id: entity.groupId,
  name: entity.name,
  legal_name: entity.legalName,
  short_code: entity.shortCode,
  country: entity.country,
  base_currency: entity.baseCurrency,
  timezone: entity.timezone,
  approval_matrix: entity.approvalMatrix,
  sdr_config: entity.sdrConfig,
  lr_config: entity.lrConfig,
  is_active: entity.isActive ?? true,
});

export const mapEntityUserFromDB = (row: Record<string, unknown>): EntityUser => {
  const entityUserRow = row as EntityUserRow;

  return ({
    entityId: entityUserRow.entity_id,
    userId: entityUserRow.user_id,
    role: entityUserRow.role,
    defaultBuId: entityUserRow.default_bu_id ?? undefined,
    isPrimaryEntity: entityUserRow.is_primary_entity ?? false,
  });
};

// ---------------------------------------------------------------------------
// Report Schedules
// ---------------------------------------------------------------------------

export const mapReportScheduleFromDB = (row: Record<string, unknown>): ReportSchedule => {
  const scheduleRow = row as ReportScheduleRow;

  return ({
    id: scheduleRow.id,
    entityId: scheduleRow.entity_id,
    name: scheduleRow.name,
    reportType: scheduleRow.report_type,
    frequency: scheduleRow.frequency,
    format: scheduleRow.format,
    recipients: scheduleRow.recipients ?? [],
    config: scheduleRow.config ?? {},
    isActive: scheduleRow.is_active ?? true,
    lastRunAt: scheduleRow.last_run_at,
    nextRunAt: scheduleRow.next_run_at,
    createdBy: scheduleRow.created_by,
    createdAt: scheduleRow.created_at,
  });
};

export const mapReportScheduleToDB = (s: Partial<ReportSchedule>) => ({
  ...(s.id && { id: s.id }),
  entity_id: s.entityId,
  name: s.name,
  report_type: s.reportType,
  frequency: s.frequency,
  format: s.format,
  recipients: s.recipients,
  config: s.config ?? {},
  is_active: s.isActive ?? true,
  created_by: s.createdBy,
});

export const mapReportRunFromDB = (row: Record<string, unknown>): ReportRun => {
  const runRow = row as ReportRunRow;

  return ({
    id: runRow.id,
    scheduleId: runRow.schedule_id,
    entityId: runRow.entity_id,
    status: runRow.status,
    outputUrl: runRow.output_url,
    errorMessage: runRow.error_message,
    startedAt: runRow.started_at,
    completedAt: runRow.completed_at,
  });
};
