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
import { nowIso } from './shared';

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

export const mapDealFromDB = (row: any): Transaction => ({
  id: row.id,
  status: row.status,
  clientId: row.client_id,
  clientType: row.client_type,
  businessUnit: row.business_unit,
  fundingBusinessUnit: row.funding_business_unit,
  businessLine: row.business_line,
  productType: row.product_type,
  currency: row.currency,
  amount: row.amount,
  startDate: row.start_date,
  durationMonths: row.duration_months,
  amortization: row.amortization,
  repricingFreq: row.repricing_freq,
  marginTarget: row.margin_target,
  behaviouralModelId: row.behavioural_model_id,
  riskWeight: row.risk_weight,
  capitalRatio: row.capital_ratio,
  targetROE: row.target_roe,
  operationalCostBps: row.operational_cost_bps,
  lcrOutflowPct: row.lcr_outflow_pct,
  category: row.category,
  drawnAmount: row.drawn_amount,
  undrawnAmount: row.undrawn_amount,
  isCommitted: row.is_committed,
  lcrClassification: row.lcr_classification,
  depositType: row.deposit_type,
  behavioralMaturityOverride: row.behavioral_maturity_override,
  transitionRisk: row.transition_risk,
  physicalRisk: row.physical_risk,
  greenFormat: row.green_format,
  dnshCompliant: row.dnsh_compliant,
  isfEligible: row.isf_eligible,
  liquiditySpread: row.liquidity_spread,
  _liquidityPremiumDetails: row._liquidity_premium_details,
  _clcChargeDetails: row._clc_charge_details,
  clientRating: row.client_rating ?? undefined,
  ltvPct: row.ltv_pct != null ? Number(row.ltv_pct) : undefined,
  ifrs9Stage:
    row.ifrs9_stage != null ? (Number(row.ifrs9_stage) as 1 | 2 | 3) : undefined,
  entityId: row.entity_id,
  version: row.version ?? 1,
});

export const mapAuditToDB = (entry: any) => ({
  user_email: entry.userEmail,
  user_name: entry.userName,
  action: entry.action,
  module: entry.module,
  description: entry.description,
  details: entry.details,
  timestamp: entry.timestamp || nowIso(),
});

export const mapAuditFromDB = (row: any): AuditEntry => ({
  id: String(row.id || `audit-${Math.random()}`),
  timestamp: row.timestamp || nowIso(),
  userEmail: row.user_email || 'unknown@system.com',
  userName: row.user_name || 'System User',
  action: row.action || 'UNKNOWN_ACTION',
  module: row.module || 'SYSTEM',
  description: row.description || 'No description provided',
  details: row.details || {},
});

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

export const mapModelFromDB = (row: any): BehaviouralModel => ({
  id: row.id,
  name: row.name,
  type: row.type,
  nmdMethod: row.nmd_method,
  description: row.description,
  coreRatio: row.core_ratio,
  decayRate: row.decay_rate,
  betaFactor: row.beta_factor,
  replicationProfile: row.replication_profile,
  cpr: row.cpr,
  penaltyExempt: row.penalty_exempt,
});

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

export const mapRuleFromDB = (row: any): GeneralRule => ({
  id: row.id,
  businessUnit: row.business_unit,
  product: row.product,
  segment: row.segment,
  tenor: row.tenor,
  baseMethod: row.base_method,
  baseReference: row.base_reference,
  spreadMethod: row.spread_method,
  liquidityReference: row.liquidity_reference,
  strategicSpread: row.strategic_spread,
});

export const mapRuleVersionFromDB = (row: any): RuleVersion => ({
  id: row.id,
  ruleId: row.rule_id,
  version: row.version,
  businessUnit: row.business_unit,
  product: row.product,
  segment: row.segment,
  tenor: row.tenor,
  baseMethod: row.base_method,
  baseReference: row.base_reference,
  spreadMethod: row.spread_method,
  liquidityReference: row.liquidity_reference,
  strategicSpread: row.strategic_spread,
  formulaSpec: row.formula_spec,
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  changedBy: row.changed_by,
  changeReason: row.change_reason,
  createdAt: row.created_at,
});

export const mapClientFromDB = (row: any): ClientEntity => ({ ...row });
export const mapBUFromDB = (row: any): BusinessUnit => ({ ...row });
export const mapProductFromDB = (row: any): ProductDefinition => ({ ...row });

export const mapDealCommentFromDB = (row: any): DealComment => ({
  id: row.id,
  dealId: row.deal_id,
  userEmail: row.user_email,
  userName: row.user_name,
  action: row.action,
  comment: row.comment,
  createdAt: row.created_at,
});

export const mapNotificationFromDB = (row: any): Notification => ({
  id: row.id,
  recipientEmail: row.recipient_email,
  senderEmail: row.sender_email,
  type: row.type,
  title: row.title,
  message: row.message,
  dealId: row.deal_id,
  isRead: row.is_read,
  createdAt: row.created_at,
});

export const mapRateCardsFromDB = (cards: unknown): FtpRateCard[] =>
  Array.isArray(cards) ? (cards as FtpRateCard[]) : [];

// --- Entity mappers ---

import type { Group, Entity, EntityUser } from '../../types/entity';

export const mapGroupFromDB = (row: any): Group => ({
  id: row.id,
  name: row.name,
  shortCode: row.short_code,
  country: row.country,
  baseCurrency: row.base_currency,
  config: row.config ?? {},
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

export const mapGroupToDB = (group: Partial<Group>) => ({
  ...(group.id && { id: group.id }),
  name: group.name,
  short_code: group.shortCode,
  country: group.country,
  base_currency: group.baseCurrency,
  config: group.config ?? {},
  is_active: group.isActive ?? true,
});

export const mapEntityFromDB = (row: any): Entity => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  legalName: row.legal_name ?? '',
  shortCode: row.short_code,
  country: row.country,
  baseCurrency: row.base_currency,
  timezone: row.timezone ?? 'Europe/Madrid',
  approvalMatrix: row.approval_matrix ?? {},
  sdrConfig: row.sdr_config ?? {},
  lrConfig: row.lr_config ?? {},
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

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

export const mapEntityUserFromDB = (row: any): EntityUser => ({
  entityId: row.entity_id,
  userId: row.user_id,
  role: row.role,
  defaultBuId: row.default_bu_id ?? undefined,
  isPrimaryEntity: row.is_primary_entity ?? false,
});

// ---------------------------------------------------------------------------
// Report Schedules
// ---------------------------------------------------------------------------

import type { ReportSchedule, ReportRun } from '../../types/reportSchedule';

export const mapReportScheduleFromDB = (row: any): ReportSchedule => ({
  id: row.id,
  entityId: row.entity_id,
  name: row.name,
  reportType: row.report_type,
  frequency: row.frequency,
  format: row.format,
  recipients: row.recipients ?? [],
  config: row.config ?? {},
  isActive: row.is_active ?? true,
  lastRunAt: row.last_run_at,
  nextRunAt: row.next_run_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

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

export const mapReportRunFromDB = (row: any): ReportRun => ({
  id: row.id,
  scheduleId: row.schedule_id,
  entityId: row.entity_id,
  status: row.status,
  outputUrl: row.output_url,
  errorMessage: row.error_message,
  startedAt: row.started_at,
  completedAt: row.completed_at,
});
