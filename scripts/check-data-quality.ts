import {
  MOCK_BEHAVIOURAL_MODELS,
  MOCK_BUSINESS_UNITS,
  MOCK_CLIENTS,
  MOCK_DEALS,
  MOCK_ENTITIES,
  MOCK_ENTITY_USERS,
  MOCK_FTP_RATE_CARDS,
  MOCK_GREENIUM_GRID,
  MOCK_GROUPS,
  MOCK_LIQUIDITY_CURVES,
  MOCK_PHYSICAL_GRID,
  MOCK_PRODUCT_DEFS,
  MOCK_RULES,
  MOCK_TRANSITION_GRID,
  MOCK_USERS,
  MOCK_YIELD_CURVE,
} from '../utils/seedData';

const issues: string[] = [];
const allowedRoles = new Set(['Admin', 'Trader', 'Risk_Manager', 'Auditor']);
const allowedStatuses = new Set(['Draft', 'Pending', 'Pending_Approval', 'Approved', 'Booked', 'Rejected', 'Review']);

function assert(condition: boolean, message: string): void {
  if (!condition) issues.push(message);
}

function assertFinite(value: unknown, message: string): void {
  assert(typeof value === 'number' && Number.isFinite(value), message);
}

function assertUnique<T>(items: T[], label: string, keyOf: (item: T) => string | number | undefined | null): void {
  const seen = new Set<string>();
  for (const item of items) {
    const rawKey = keyOf(item);
    const key = String(rawKey ?? '');
    if (!key) {
      issues.push(`${label} contains an empty identifier`);
      continue;
    }
    if (seen.has(key)) {
      issues.push(`${label} contains a duplicate identifier: ${key}`);
      continue;
    }
    seen.add(key);
  }
}

function assertUniqueArrayValues(values: string[], label: string): void {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      issues.push(`${label} contains a duplicate value: ${value}`);
      return;
    }
    seen.add(value);
  });
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

assertUnique(MOCK_CLIENTS, 'MOCK_CLIENTS', (item) => item.id);
assertUnique(MOCK_PRODUCT_DEFS, 'MOCK_PRODUCT_DEFS', (item) => item.id);
assertUnique(MOCK_BUSINESS_UNITS, 'MOCK_BUSINESS_UNITS', (item) => item.id);
assertUnique(MOCK_USERS, 'MOCK_USERS', (item) => item.id);
assertUnique(MOCK_USERS, 'MOCK_USERS emails', (item) => item.email);
assertUnique(MOCK_DEALS, 'MOCK_DEALS', (item) => item.id);
assertUnique(MOCK_TRANSITION_GRID, 'MOCK_TRANSITION_GRID', (item) => item.id);
assertUnique(MOCK_PHYSICAL_GRID, 'MOCK_PHYSICAL_GRID', (item) => item.id);
assertUnique(MOCK_GREENIUM_GRID, 'MOCK_GREENIUM_GRID', (item) => item.id);
assertUnique(MOCK_FTP_RATE_CARDS, 'MOCK_FTP_RATE_CARDS', (item) => item.id);
assertUnique(MOCK_BEHAVIOURAL_MODELS, 'MOCK_BEHAVIOURAL_MODELS', (item) => item.id);
assertUnique(MOCK_RULES, 'MOCK_RULES', (item) => item.id);
assertUnique(MOCK_GROUPS, 'MOCK_GROUPS', (item) => item.id);
assertUnique(MOCK_ENTITIES, 'MOCK_ENTITIES', (item) => item.id);
assertUnique(
  MOCK_ENTITY_USERS,
  'MOCK_ENTITY_USERS',
  (item) => `${item.entityId}:${item.userId}:${item.role}:${item.isPrimaryEntity}`,
);

const clientIds = new Set(MOCK_CLIENTS.map((item) => item.id));
const clientTypes = new Map(MOCK_CLIENTS.map((item) => [item.id, item.type]));
const productIds = new Set(MOCK_PRODUCT_DEFS.map((item) => item.id));
const productCategories = new Map(MOCK_PRODUCT_DEFS.map((item) => [item.id, item.category]));
const businessUnitIds = new Set(MOCK_BUSINESS_UNITS.map((item) => item.id));
const userEmails = new Set(MOCK_USERS.map((item) => item.email));
const entityIds = new Set(MOCK_ENTITIES.map((item) => item.id));
const groupIds = new Set(MOCK_GROUPS.map((item) => item.id));

for (const user of MOCK_USERS) {
  assert(allowedRoles.has(user.role), `User ${user.email} has unsupported role ${user.role}`);
  assert(typeof user.name === 'string' && user.name.trim().length > 0, `User ${user.email} is missing a name`);
  assert(typeof user.department === 'string' && user.department.trim().length > 0, `User ${user.email} is missing a department`);
}

for (const deal of MOCK_DEALS) {
  assert(!!deal.id, 'Encountered a seeded deal without id');
  assert(clientIds.has(deal.clientId), `Deal ${deal.id} references unknown client ${deal.clientId}`);
  assert(productIds.has(deal.productType), `Deal ${deal.id} references unknown product ${deal.productType}`);
  assert(businessUnitIds.has(deal.businessUnit), `Deal ${deal.id} references unknown business unit ${deal.businessUnit}`);
  assert(businessUnitIds.has(deal.fundingBusinessUnit), `Deal ${deal.id} references unknown funding business unit ${deal.fundingBusinessUnit}`);
  assert(allowedStatuses.has(deal.status ?? 'Draft'), `Deal ${deal.id} has unsupported status ${deal.status}`);
  assert(isIsoDate(deal.startDate), `Deal ${deal.id} has a non-ISO start date ${deal.startDate}`);
  assertFinite(deal.amount, `Deal ${deal.id} has non-finite amount`);
  assert(deal.amount >= 0, `Deal ${deal.id} has negative amount`);
  assertFinite(deal.durationMonths, `Deal ${deal.id} has non-finite tenor`);
  assert(deal.durationMonths > 0, `Deal ${deal.id} must have tenor > 0`);
  assertFinite(deal.marginTarget, `Deal ${deal.id} has non-finite margin target`);
  assertFinite(deal.riskWeight, `Deal ${deal.id} has non-finite risk weight`);
  assertFinite(deal.capitalRatio, `Deal ${deal.id} has non-finite capital ratio`);
  assertFinite(deal.targetROE, `Deal ${deal.id} has non-finite target ROE`);
  assertFinite(deal.operationalCostBps, `Deal ${deal.id} has non-finite operational cost`);
  assert(
    productCategories.get(deal.productType) === deal.category,
    `Deal ${deal.id} category ${deal.category} does not match product ${deal.productType}`,
  );
  assert(
    clientTypes.get(deal.clientId) === deal.clientType,
    `Deal ${deal.id} client type ${deal.clientType} does not match client master ${clientTypes.get(deal.clientId)}`,
  );
  if (deal.entityId) {
    assert(entityIds.has(deal.entityId), `Deal ${deal.id} references unknown entity ${deal.entityId}`);
  }
}

for (const item of MOCK_TRANSITION_GRID) {
  assertFinite(item.adjustmentBps, `Transition grid ${item.id} has non-finite adjustment`);
}

for (const item of MOCK_PHYSICAL_GRID) {
  assertFinite(item.adjustmentBps, `Physical grid ${item.id} has non-finite adjustment`);
}

for (const item of MOCK_GREENIUM_GRID) {
  assertFinite(item.adjustmentBps, `Greenium grid ${item.id} has non-finite adjustment`);
}

for (const card of MOCK_FTP_RATE_CARDS) {
  assert(card.points.length > 0, `Rate card ${card.id} has no points`);
  assertUniqueArrayValues(card.points.map((point) => point.tenor), `Rate card ${card.id} tenors`);
  for (const point of card.points) {
    assertFinite(point.rate, `Rate card ${card.id} tenor ${point.tenor} has non-finite rate`);
  }
}

assertUniqueArrayValues(
  MOCK_LIQUIDITY_CURVES.map((curve) => `${curve.currency}:${curve.curveType}`),
  'MOCK_LIQUIDITY_CURVES currency/curveType pairs',
);
for (const curve of MOCK_LIQUIDITY_CURVES) {
  assert(curve.points.length > 0, `Liquidity curve ${curve.currency}/${curve.curveType} has no points`);
  assertUniqueArrayValues(
    curve.points.map((point) => point.tenor),
    `Liquidity curve ${curve.currency}/${curve.curveType} tenors`,
  );
  for (const point of curve.points) {
    assertFinite(point.wholesaleSpread, `Liquidity curve ${curve.currency}/${curve.curveType} tenor ${point.tenor} has non-finite wholesale spread`);
    assertFinite(point.termLP, `Liquidity curve ${curve.currency}/${curve.curveType} tenor ${point.tenor} has non-finite term LP`);
  }
}

assertUniqueArrayValues(MOCK_YIELD_CURVE.map((point) => point.tenor), 'MOCK_YIELD_CURVE tenors');
for (const point of MOCK_YIELD_CURVE) {
  assertFinite(point.rate, `Yield curve tenor ${point.tenor} has non-finite rate`);
  assertFinite(point.prev, `Yield curve tenor ${point.tenor} has non-finite previous rate`);
}

for (const model of MOCK_BEHAVIOURAL_MODELS) {
  assert(typeof model.name === 'string' && model.name.trim().length > 0, `Behavioural model ${model.id} is missing a name`);
}

for (const rule of MOCK_RULES) {
  assert(typeof rule.businessUnit === 'string' && rule.businessUnit.trim().length > 0, `Rule ${rule.id} is missing business unit`);
  assert(typeof rule.product === 'string' && rule.product.trim().length > 0, `Rule ${rule.id} is missing product`);
  assertFinite(rule.strategicSpread, `Rule ${rule.id} has non-finite strategic spread`);
  assert(!!rule.formulaSpec?.baseRateKey, `Rule ${rule.id} is missing baseRateKey`);
  assert(!!rule.formulaSpec?.lpFormula, `Rule ${rule.id} is missing lpFormula`);
}

for (const group of MOCK_GROUPS) {
  assert(typeof group.name === 'string' && group.name.trim().length > 0, `Group ${group.id} is missing a name`);
}

for (const entity of MOCK_ENTITIES) {
  assert(groupIds.has(entity.groupId), `Entity ${entity.id} references unknown group ${entity.groupId}`);
  assert(typeof entity.name === 'string' && entity.name.trim().length > 0, `Entity ${entity.id} is missing a name`);
}

const primaryEntityCountByUser = new Map<string, number>();
for (const membership of MOCK_ENTITY_USERS) {
  assert(entityIds.has(membership.entityId), `Entity membership references unknown entity ${membership.entityId}`);
  assert(userEmails.has(membership.userId), `Entity membership references unknown user ${membership.userId}`);
  assert(allowedRoles.has(membership.role), `Entity membership ${membership.userId} has unsupported role ${membership.role}`);
  if (membership.isPrimaryEntity) {
    primaryEntityCountByUser.set(membership.userId, (primaryEntityCountByUser.get(membership.userId) ?? 0) + 1);
  }
}

for (const [userId, primaryCount] of primaryEntityCountByUser.entries()) {
  assert(primaryCount === 1, `User ${userId} must have exactly one primary entity, found ${primaryCount}`);
}

if (issues.length > 0) {
  console.error(`FAIL: ${issues.length} data-quality issue(s) found.\n`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(
  `PASS: Seed/master data quality checks passed for ${MOCK_DEALS.length} deals, ${MOCK_USERS.length} users, ${MOCK_ENTITIES.length} entities, and ${MOCK_RULES.length} rules.`,
);
