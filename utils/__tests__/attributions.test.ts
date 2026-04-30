import { describe, it, expect } from 'vitest';
import {
  scopeMatches,
  isThresholdVigent,
  thresholdAccepts,
  findApplicableThresholds,
  levelAcceptsQuote,
  sortLevelsAscending,
  findRoot,
  buildApprovalChain,
  findChildren,
  findDescendants,
  quoteFromFtpResult,
  routeApproval,
  applyAdjustments,
  simulate,
} from '../attributions';
import type {
  AttributionLevel,
  AttributionMatrix,
  AttributionQuote,
  AttributionScope,
  AttributionThreshold,
} from '../../types/attributions';
import type { FTPResult } from '../../types';

const ENTITY = '00000000-0000-0000-0000-000000000099';

// ---------------------------------------------------------------------------
// Factories — construir niveles, thresholds, matrices y quotes para tests
// ---------------------------------------------------------------------------

const makeLevel = (overrides: Partial<AttributionLevel> = {}): AttributionLevel => ({
  id:          'lvl-' + Math.random().toString(36).slice(2, 8),
  entityId:    ENTITY,
  name:        'Director Oficina',
  parentId:    null,
  levelOrder:  1,
  rbacRole:    'BranchManager',
  metadata:    {},
  active:      true,
  createdAt:   '2026-04-01T08:00:00Z',
  updatedAt:   '2026-04-01T08:00:00Z',
  ...overrides,
});

const makeThreshold = (overrides: Partial<AttributionThreshold> = {}): AttributionThreshold => ({
  id:                'thr-' + Math.random().toString(36).slice(2, 8),
  entityId:          ENTITY,
  levelId:           'lvl-1',
  scope:             {},
  deviationBpsMax:   10,
  rarocPpMin:        12,
  volumeEurMax:      1_000_000,
  activeFrom:        '2026-01-01',
  activeTo:          null,
  isActive:          true,
  createdAt:         '2026-04-01T08:00:00Z',
  updatedAt:         '2026-04-01T08:00:00Z',
  ...overrides,
});

const makeQuote = (overrides: Partial<AttributionQuote> = {}): AttributionQuote => ({
  finalClientRateBps: 485,    // 4.85%
  standardRateBps:    492,    // 4.92%
  hardFloorRateBps:   400,    // 4.00%  — capital + LCR + NSFR + opex
  rarocPp:            13.8,
  volumeEur:          250_000,
  scope:              { product: ['loan'], segment: ['SME'], currency: ['EUR'], tenorMaxMonths: 24 },
  ...overrides,
});

const buildMatrix = (
  levels: AttributionLevel[],
  thresholds: AttributionThreshold[],
): AttributionMatrix => ({
  entityId:   ENTITY,
  levels,
  thresholds,
  loadedAt:   '2026-04-30T10:00:00Z',
});

// ---------------------------------------------------------------------------
// thresholdMatcher — scopeMatches
// ---------------------------------------------------------------------------

describe('thresholdMatcher · scopeMatches', () => {
  it('threshold scope vacío aplica a todos los deals', () => {
    const dealScope: AttributionScope = { product: ['loan'], segment: ['SME'] };
    expect(scopeMatches(dealScope, {})).toBe(true);
  });

  it('product match positivo', () => {
    expect(scopeMatches({ product: ['loan'] }, { product: ['loan', 'mortgage'] })).toBe(true);
  });

  it('product match negativo cuando el deal no está en la lista del threshold', () => {
    expect(scopeMatches({ product: ['line_of_credit'] }, { product: ['loan'] })).toBe(false);
  });

  it('segment match', () => {
    expect(scopeMatches({ segment: ['SME'] }, { segment: ['SME', 'Corporate'] })).toBe(true);
  });

  it('currency match', () => {
    expect(scopeMatches({ currency: ['EUR'] }, { currency: ['EUR'] })).toBe(true);
    expect(scopeMatches({ currency: ['USD'] }, { currency: ['EUR'] })).toBe(false);
  });

  it('tenorMaxMonths dentro del límite', () => {
    expect(scopeMatches({ tenorMaxMonths: 18 }, { tenorMaxMonths: 24 })).toBe(true);
  });

  it('tenorMaxMonths fuera del límite', () => {
    expect(scopeMatches({ tenorMaxMonths: 36 }, { tenorMaxMonths: 24 })).toBe(false);
  });

  it('tenorMaxMonths sin valor en el deal cuando el threshold lo exige → false', () => {
    expect(scopeMatches({}, { tenorMaxMonths: 24 })).toBe(false);
  });

  it('múltiples criterios — uno falla devuelve false', () => {
    const dealScope: AttributionScope = {
      product: ['loan'],
      segment: ['SME'],
      currency: ['USD'],
    };
    const thresholdScope: AttributionScope = {
      product: ['loan'],
      segment: ['SME'],
      currency: ['EUR'],
    };
    expect(scopeMatches(dealScope, thresholdScope)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// thresholdMatcher · isThresholdVigent
// ---------------------------------------------------------------------------

describe('thresholdMatcher · isThresholdVigent', () => {
  it('threshold activo y dentro de fechas → true', () => {
    const t = makeThreshold({ activeFrom: '2026-01-01', activeTo: '2026-12-31', isActive: true });
    expect(isThresholdVigent(t, '2026-04-30')).toBe(true);
  });

  it('threshold inactivo → false aunque las fechas pasen', () => {
    const t = makeThreshold({ isActive: false });
    expect(isThresholdVigent(t, '2026-04-30')).toBe(false);
  });

  it('antes de activeFrom → false', () => {
    const t = makeThreshold({ activeFrom: '2026-05-01' });
    expect(isThresholdVigent(t, '2026-04-30')).toBe(false);
  });

  it('después de activeTo → false', () => {
    const t = makeThreshold({ activeFrom: '2026-01-01', activeTo: '2026-03-31' });
    expect(isThresholdVigent(t, '2026-04-30')).toBe(false);
  });

  it('activeTo null = sin caducidad', () => {
    const t = makeThreshold({ activeFrom: '2026-01-01', activeTo: null });
    expect(isThresholdVigent(t, '2099-12-31')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// thresholdMatcher · thresholdAccepts
// ---------------------------------------------------------------------------

describe('thresholdMatcher · thresholdAccepts', () => {
  it('todos los criterios cumplen → true', () => {
    const t = makeThreshold({ deviationBpsMax: 10, rarocPpMin: 12, volumeEurMax: 1_000_000 });
    expect(thresholdAccepts(t, { deviationBps: -5, rarocPp: 13, volumeEur: 500_000 })).toBe(true);
  });

  it('deviation desfavorable excede max → false', () => {
    const t = makeThreshold({ deviationBpsMax: 10, rarocPpMin: 12, volumeEurMax: 1_000_000 });
    expect(thresholdAccepts(t, { deviationBps: -15, rarocPp: 13, volumeEur: 500_000 })).toBe(false);
  });

  it('deviation favorable no resta — el cliente paga MÁS del estándar', () => {
    // Cuando deviationBps es positivo (precio > estándar), no hay descuento que justificar.
    const t = makeThreshold({ deviationBpsMax: 5, rarocPpMin: 12, volumeEurMax: 1_000_000 });
    expect(thresholdAccepts(t, { deviationBps: 50, rarocPp: 13, volumeEur: 500_000 })).toBe(true);
  });

  it('raroc bajo mínimo → false', () => {
    const t = makeThreshold({ deviationBpsMax: 10, rarocPpMin: 12, volumeEurMax: 1_000_000 });
    expect(thresholdAccepts(t, { deviationBps: -5, rarocPp: 11, volumeEur: 500_000 })).toBe(false);
  });

  it('volumen supera máximo → false', () => {
    const t = makeThreshold({ deviationBpsMax: 10, rarocPpMin: 12, volumeEurMax: 1_000_000 });
    expect(thresholdAccepts(t, { deviationBps: -5, rarocPp: 13, volumeEur: 2_000_000 })).toBe(false);
  });

  it('criterios NULL en el threshold se ignoran', () => {
    const t = makeThreshold({ deviationBpsMax: null, rarocPpMin: null, volumeEurMax: 100 });
    // sólo el volumen cuenta — pasa
    expect(thresholdAccepts(t, { deviationBps: -100, rarocPp: 0, volumeEur: 50 })).toBe(true);
    // sólo el volumen cuenta — falla
    expect(thresholdAccepts(t, { deviationBps: -1, rarocPp: 50, volumeEur: 200 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// thresholdMatcher · findApplicableThresholds + levelAcceptsQuote
// ---------------------------------------------------------------------------

describe('thresholdMatcher · findApplicableThresholds', () => {
  it('filtra por scope match y vigencia', () => {
    const t1 = makeThreshold({ id: 't1', scope: { product: ['loan'] }, isActive: true });
    const t2 = makeThreshold({ id: 't2', scope: { product: ['mortgage'] }, isActive: true });
    const t3 = makeThreshold({ id: 't3', scope: { product: ['loan'] }, isActive: false });
    const result = findApplicableThresholds([t1, t2, t3], { product: ['loan'] }, '2026-04-30');
    expect(result.map((x) => x.id)).toEqual(['t1']);
  });
});

describe('thresholdMatcher · levelAcceptsQuote', () => {
  it('al menos un threshold del nivel acepta → true', () => {
    const t1 = makeThreshold({ id: 't1', levelId: 'L1', deviationBpsMax: 5 });
    const t2 = makeThreshold({ id: 't2', levelId: 'L1', deviationBpsMax: 50 });
    expect(levelAcceptsQuote([t1, t2], 'L1', { deviationBps: -30, rarocPp: 13, volumeEur: 100 })).toBe(true);
  });

  it('ningún threshold del nivel acepta → false', () => {
    const t1 = makeThreshold({ id: 't1', levelId: 'L1', deviationBpsMax: 5 });
    const t2 = makeThreshold({ id: 't2', levelId: 'L1', deviationBpsMax: 8 });
    expect(levelAcceptsQuote([t1, t2], 'L1', { deviationBps: -30, rarocPp: 13, volumeEur: 100 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chainBuilder
// ---------------------------------------------------------------------------

describe('chainBuilder · sortLevelsAscending', () => {
  it('ordena por levelOrder y filtra inactivos', () => {
    const a = makeLevel({ id: 'a', name: 'A', levelOrder: 3 });
    const b = makeLevel({ id: 'b', name: 'B', levelOrder: 1 });
    const c = makeLevel({ id: 'c', name: 'C', levelOrder: 2, active: false });
    const sorted = sortLevelsAscending([a, b, c]);
    expect(sorted.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('desempata por nombre cuando levelOrder coincide', () => {
    const a = makeLevel({ id: 'a', name: 'Beta',  levelOrder: 1 });
    const b = makeLevel({ id: 'b', name: 'Alpha', levelOrder: 1 });
    expect(sortLevelsAscending([a, b]).map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('chainBuilder · findRoot', () => {
  it('encuentra raíz única', () => {
    const root = makeLevel({ id: 'r', parentId: null, levelOrder: 1 });
    const child = makeLevel({ id: 'c', parentId: 'r', levelOrder: 2 });
    expect(findRoot([root, child])?.id).toBe('r');
  });

  it('múltiples raíces → menor levelOrder', () => {
    const r1 = makeLevel({ id: 'r1', parentId: null, levelOrder: 5 });
    const r2 = makeLevel({ id: 'r2', parentId: null, levelOrder: 1 });
    expect(findRoot([r1, r2])?.id).toBe('r2');
  });

  it('sin raíz → null', () => {
    const a = makeLevel({ id: 'a', parentId: 'b' });
    const b = makeLevel({ id: 'b', parentId: 'a' });
    expect(findRoot([a, b])).toBeNull();
  });
});

describe('chainBuilder · buildApprovalChain', () => {
  it('construye cadena bottom-up de raíz a target', () => {
    const office     = makeLevel({ id: 'office',     name: 'Oficina',     parentId: null,         levelOrder: 1 });
    const zone       = makeLevel({ id: 'zone',       name: 'Zona',        parentId: 'office',     levelOrder: 2 });
    const territory  = makeLevel({ id: 'territory',  name: 'Territorial', parentId: 'zone',       levelOrder: 3 });
    const committee  = makeLevel({ id: 'committee',  name: 'Comité',      parentId: 'territory',  levelOrder: 4 });
    const chain = buildApprovalChain('committee', [office, zone, territory, committee]);
    expect(chain.map((l) => l.id)).toEqual(['office', 'zone', 'territory', 'committee']);
  });

  it('target inválido → []', () => {
    const office = makeLevel({ id: 'office', parentId: null });
    expect(buildApprovalChain('inexistente', [office])).toEqual([]);
  });

  it('ciclo en parentId no produce loop infinito', () => {
    const a = makeLevel({ id: 'a', parentId: 'b' });
    const b = makeLevel({ id: 'b', parentId: 'a' });
    const chain = buildApprovalChain('a', [a, b]);
    expect(chain.length).toBeLessThanOrEqual(2);
  });
});

describe('chainBuilder · findChildren / findDescendants', () => {
  it('findChildren devuelve hijos directos activos', () => {
    const root = makeLevel({ id: 'root', parentId: null });
    const c1   = makeLevel({ id: 'c1',   parentId: 'root' });
    const c2   = makeLevel({ id: 'c2',   parentId: 'root', active: false });
    const gc   = makeLevel({ id: 'gc',   parentId: 'c1' });
    expect(findChildren('root', [root, c1, c2, gc]).map((l) => l.id)).toEqual(['c1']);
  });

  it('findDescendants es recursivo', () => {
    const root = makeLevel({ id: 'root', parentId: null });
    const c1   = makeLevel({ id: 'c1',   parentId: 'root' });
    const c2   = makeLevel({ id: 'c2',   parentId: 'root' });
    const gc   = makeLevel({ id: 'gc',   parentId: 'c1' });
    const descendants = findDescendants('root', [root, c1, c2, gc]).map((l) => l.id).sort();
    expect(descendants).toEqual(['c1', 'c2', 'gc']);
  });
});

// ---------------------------------------------------------------------------
// attributionRouter · quoteFromFtpResult
// ---------------------------------------------------------------------------

describe('attributionRouter · quoteFromFtpResult', () => {
  it('convierte rates (decimal) a bps multiplicando por 10000', () => {
    const ftp = {
      finalClientRate: 0.0485,
      targetPrice:     0.0492,
      floorPrice:      0.0400,
      raroc:           0.138,
    } as Partial<FTPResult> as FTPResult;
    const quote = quoteFromFtpResult(ftp, { product: ['loan'] }, 250_000);
    expect(quote.finalClientRateBps).toBeCloseTo(485, 4);
    expect(quote.standardRateBps).toBeCloseTo(492, 4);
    expect(quote.hardFloorRateBps).toBeCloseTo(400, 4);
    expect(quote.rarocPp).toBeCloseTo(13.8, 4);
    expect(quote.volumeEur).toBe(250_000);
  });

  it('cae a floorPrice cuando targetPrice es undefined', () => {
    const ftp = {
      finalClientRate: 0.04,
      floorPrice:      0.04,
      raroc:           0.10,
    } as Partial<FTPResult> as FTPResult;
    const quote = quoteFromFtpResult(ftp, {}, 100);
    expect(quote.standardRateBps).toBeCloseTo(400, 4);
  });
});

// ---------------------------------------------------------------------------
// attributionRouter · routeApproval
// ---------------------------------------------------------------------------

describe('attributionRouter · routeApproval', () => {
  // Matriz típica de 3 niveles para tests
  const office     = makeLevel({ id: 'office',     name: 'Oficina',     parentId: null,     levelOrder: 1 });
  const zone       = makeLevel({ id: 'zone',       name: 'Zona',        parentId: 'office', levelOrder: 2 });
  const committee  = makeLevel({ id: 'committee',  name: 'Comité',      parentId: 'zone',   levelOrder: 3 });

  const officeThreshold    = makeThreshold({ id: 'tof', levelId: 'office',    deviationBpsMax: 5,  rarocPpMin: 14,  volumeEurMax: 100_000 });
  const zoneThreshold      = makeThreshold({ id: 'tzn', levelId: 'zone',      deviationBpsMax: 15, rarocPpMin: 12,  volumeEurMax: 500_000 });
  const committeeThreshold = makeThreshold({ id: 'tco', levelId: 'committee', deviationBpsMax: 50, rarocPpMin: 8,   volumeEurMax: 10_000_000 });

  const matrix = buildMatrix(
    [office, zone, committee],
    [officeThreshold, zoneThreshold, committeeThreshold],
  );

  it('quote dentro del threshold de Oficina → Oficina aprueba', () => {
    const quote = makeQuote({
      finalClientRateBps: 490,
      standardRateBps:    492,
      rarocPp:            14.5,
      volumeEur:          80_000,
    });
    const result = routeApproval(quote, matrix, { asOfDate: '2026-04-30' });
    expect(result.requiredLevel.id).toBe('office');
    expect(result.reason).toBe('within_threshold');
    expect(result.belowHardFloor).toBe(false);
    expect(result.approvalChain.map((l) => l.id)).toEqual(['office']);
  });

  it('quote excede Oficina pero entra en Zona → Zona aprueba', () => {
    const quote = makeQuote({
      finalClientRateBps: 480,    // -12 bps
      standardRateBps:    492,
      rarocPp:            13,
      volumeEur:          250_000,
    });
    const result = routeApproval(quote, matrix, { asOfDate: '2026-04-30' });
    expect(result.requiredLevel.id).toBe('zone');
    expect(result.approvalChain.map((l) => l.id)).toEqual(['office', 'zone']);
  });

  it('quote sólo entra en Comité → cadena completa Oficina→Zona→Comité', () => {
    const quote = makeQuote({
      finalClientRateBps: 460,    // -32 bps
      standardRateBps:    492,
      rarocPp:            10,
      volumeEur:          2_000_000,
    });
    const result = routeApproval(quote, matrix, { asOfDate: '2026-04-30' });
    expect(result.requiredLevel.id).toBe('committee');
    expect(result.approvalChain.map((l) => l.id)).toEqual(['office', 'zone', 'committee']);
  });

  it('quote bajo hard floor → escala a comité con belowHardFloor=true', () => {
    const quote = makeQuote({
      finalClientRateBps: 350,    // por debajo de hardFloorRateBps=400
      standardRateBps:    492,
      hardFloorRateBps:   400,
    });
    const result = routeApproval(quote, matrix, { asOfDate: '2026-04-30' });
    expect(result.belowHardFloor).toBe(true);
    expect(result.reason).toBe('below_hard_floor');
    expect(result.requiredLevel.id).toBe('committee');
  });

  it('sin thresholds aplicables al scope → comité con razón no_applicable_threshold', () => {
    const restrictedMatrix = buildMatrix(
      [office, zone, committee],
      [
        makeThreshold({ id: 'r1', levelId: 'office', scope: { product: ['mortgage'] } }),
      ],
    );
    const quote = makeQuote({ scope: { product: ['line_of_credit'] } });
    const result = routeApproval(quote, restrictedMatrix, { asOfDate: '2026-04-30' });
    expect(result.requiredLevel.id).toBe('committee');
    expect(result.reason).toBe('no_applicable_threshold');
  });

  it('quote excede TODOS los thresholds → diagnostica el motivo dominante', () => {
    // Todos los niveles fallan por raroc bajo (criterio dominante).
    const quote = makeQuote({
      finalClientRateBps: 491,    // dentro del límite de oficina (-1 bp)
      standardRateBps:    492,
      rarocPp:            5,      // muy bajo, falla en los 3 niveles
      volumeEur:          50_000,
    });
    const result = routeApproval(quote, matrix, { asOfDate: '2026-04-30' });
    expect(result.requiredLevel.id).toBe('committee');
    expect(['raroc_below_min', 'within_threshold']).toContain(result.reason);
  });

  it('matriz vacía lanza Error', () => {
    const empty = buildMatrix([], []);
    expect(() => routeApproval(makeQuote(), empty)).toThrow(/matriz vac/);
  });
});

// ---------------------------------------------------------------------------
// attributionSimulator
// ---------------------------------------------------------------------------

describe('attributionSimulator · applyAdjustments', () => {
  it('deviationBpsDelta modifica finalClientRateBps', () => {
    const quote = makeQuote({ finalClientRateBps: 485 });
    const adjusted = applyAdjustments(quote, { deviationBpsDelta: 5 });
    expect(adjusted.finalClientRateBps).toBe(490);
  });

  it('rarocPpOverride sobrescribe el RAROC', () => {
    const quote = makeQuote({ rarocPp: 13.8 });
    const adjusted = applyAdjustments(quote, { rarocPpOverride: 16 });
    expect(adjusted.rarocPp).toBe(16);
  });

  it('tenorMonthsDelta ajusta scope.tenorMaxMonths sin volverlo negativo', () => {
    const quote = makeQuote({ scope: { tenorMaxMonths: 24 } });
    const longer  = applyAdjustments(quote, { tenorMonthsDelta: 12 });
    const shorter = applyAdjustments(quote, { tenorMonthsDelta: -100 });
    expect(longer.scope.tenorMaxMonths).toBe(36);
    expect(shorter.scope.tenorMaxMonths).toBe(0);
  });

  it('sin ajustes devuelve clon equivalente', () => {
    const quote = makeQuote();
    const cloned = applyAdjustments(quote, {});
    expect(cloned).toEqual(quote);
    expect(cloned).not.toBe(quote); // no es la misma referencia
  });
});

describe('attributionSimulator · simulate', () => {
  // Matriz idéntica a los tests del router
  const office     = makeLevel({ id: 'office',     name: 'Oficina',     parentId: null,     levelOrder: 1 });
  const zone       = makeLevel({ id: 'zone',       name: 'Zona',        parentId: 'office', levelOrder: 2 });
  const committee  = makeLevel({ id: 'committee',  name: 'Comité',      parentId: 'zone',   levelOrder: 3 });
  const matrix = buildMatrix(
    [office, zone, committee],
    [
      makeThreshold({ id: 'tof', levelId: 'office',    deviationBpsMax: 5,  rarocPpMin: 14, volumeEurMax: 100_000 }),
      makeThreshold({ id: 'tzn', levelId: 'zone',      deviationBpsMax: 15, rarocPpMin: 12, volumeEurMax: 500_000 }),
      makeThreshold({ id: 'tco', levelId: 'committee', deviationBpsMax: 50, rarocPpMin: 8,  volumeEurMax: 10_000_000 }),
    ],
  );
  const today = { asOfDate: '2026-04-30' };

  it('subir RAROC desplaza el nivel requerido hacia abajo (levelsAvoided no vacío)', () => {
    const quote = makeQuote({
      finalClientRateBps: 489,    // -3 bps (dentro de Oficina por dev)
      standardRateBps:    492,
      rarocPp:            13,     // bajo el mínimo de Oficina (14)
      volumeEur:          50_000,
    });
    const result = simulate({ quote, proposedAdjustments: { rarocPpOverride: 15 } }, matrix, today);
    expect(result.diffVsOriginal.requiredLevelChanged).toBe(true);
    expect(result.newRouting.requiredLevel.id).toBe('office');
    expect(result.diffVsOriginal.levelsAvoided.map((l) => l.id)).toContain('zone');
  });

  it('sin ajustes que cambien el routing → levelsAvoided vacío', () => {
    const quote = makeQuote({
      finalClientRateBps: 490,
      standardRateBps:    492,
      rarocPp:            14.5,
      volumeEur:          80_000,
    });
    const result = simulate({ quote, proposedAdjustments: { deviationBpsDelta: 0 } }, matrix, today);
    expect(result.diffVsOriginal.requiredLevelChanged).toBe(false);
    expect(result.diffVsOriginal.levelsAvoided).toEqual([]);
  });

  it('bajar precio que cruza el hard floor → newRouting.belowHardFloor=true', () => {
    const quote = makeQuote({
      finalClientRateBps: 410,
      standardRateBps:    492,
      hardFloorRateBps:   400,
      rarocPp:            10,
      volumeEur:          200_000,
    });
    const result = simulate({ quote, proposedAdjustments: { deviationBpsDelta: -20 } }, matrix, today);
    expect(result.adjustedQuote.finalClientRateBps).toBe(390);
    expect(result.newRouting.belowHardFloor).toBe(true);
  });

  it('diff captura cambio en deviationBps y rarocPp', () => {
    const quote = makeQuote({
      finalClientRateBps: 490,
      standardRateBps:    492,
      rarocPp:            14.5,
      volumeEur:          80_000,
    });
    const result = simulate(
      { quote, proposedAdjustments: { deviationBpsDelta: -10, rarocPpOverride: 15.5 } },
      matrix,
      today,
    );
    expect(result.diffVsOriginal.deviationBps).toBe(-10);
    expect(result.diffVsOriginal.rarocPp).toBeCloseTo(1.0, 4);
  });
});
