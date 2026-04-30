import { describe, it, expect } from 'vitest';
import {
  buildAttributionsContextBlock,
  suggestAttributionsActions,
} from '../attributions/aiContext';
import type {
  AttributionDecision,
  AttributionLevel,
  AttributionMatrix,
} from '../../types/attributions';
import type { AttributionReportingSummary, DriftSignal } from '../attributions/attributionReporter';

const ENTITY = '00000000-0000-0000-0000-000000000099';

const level = (over: Partial<AttributionLevel> = {}): AttributionLevel => ({
  id:          'lvl-x',
  entityId:    ENTITY,
  name:        'Office',
  parentId:    null,
  levelOrder:  1,
  rbacRole:    'BranchManager',
  metadata:    {},
  active:      true,
  createdAt:   '2026-04-01T00:00:00Z',
  updatedAt:   '2026-04-01T00:00:00Z',
  ...over,
});

const matrix = (levels: AttributionLevel[] = [level()], thresholds = 0): AttributionMatrix => ({
  entityId: ENTITY,
  levels,
  thresholds: Array.from({ length: thresholds }).map((_, i) => ({
    id:                'thr-' + i,
    entityId:          ENTITY,
    levelId:           levels[0]?.id ?? 'lvl-x',
    scope:             {},
    deviationBpsMax:   10,
    rarocPpMin:        12,
    volumeEurMax:      1_000_000,
    activeFrom:        '2026-01-01',
    activeTo:          null,
    isActive:          true,
    createdAt:         '2026-04-01T00:00:00Z',
    updatedAt:         '2026-04-01T00:00:00Z',
  })),
  loadedAt: '2026-04-30T10:00:00Z',
});

const drift = (over: Partial<DriftSignal>): DriftSignal => ({
  userId:           'user-a@bank.es',
  count:            25,
  meanDeviationBps: -8,
  pctAtLimit:       0.4,
  severity:         'warning',
  reasons:          ['mean drift 8.0 bps ≥ 5'],
  ...over,
});

const summary = (over: Partial<AttributionReportingSummary> = {}): AttributionReportingSummary => ({
  generatedAt:    '2026-04-30T10:00:00Z',
  windowDays:     90,
  totalDecisions: 150,
  byLevel:        [],
  byUser:         [],
  funnel: {
    total: 150, approved: 100, rejected: 30, escalated: 15, expired: 3, reverted: 2,
    approvedRate: 100/150, rejectedRate: 30/150, expiredRate: 3/150,
  },
  drift:          [],
  timeToDecision: null,
  ...over,
});

const decision = (over: Partial<AttributionDecision>): AttributionDecision => ({
  id:                  'dec-1',
  entityId:            ENTITY,
  dealId:              'ABC-1234',
  requiredLevelId:     'lvl-zone',
  decidedByLevelId:    'lvl-zone',
  decidedByUser:       'user-a@bank.es',
  decision:            'escalated',
  reason:              null,
  pricingSnapshotHash: 'h1',
  routingMetadata:     { deviationBps: -12, rarocPp: 11.5, volumeEur: 320_000, scope: {} },
  decidedAt:           '2026-04-30T10:00:00Z',
  ...over,
});

// ---------------------------------------------------------------------------
// buildAttributionsContextBlock
// ---------------------------------------------------------------------------

describe('aiContext · buildAttributionsContextBlock', () => {
  it('renderiza la matriz cuando hay niveles activos', () => {
    const block = buildAttributionsContextBlock({
      matrix: matrix([
        level({ id: 'lvl-1', name: 'Office',    levelOrder: 1 }),
        level({ id: 'lvl-2', name: 'Zone',      levelOrder: 2 }),
        level({ id: 'lvl-3', name: 'Committee', levelOrder: 3 }),
      ], 4),
    });
    expect(block).toContain('### Attribution matrix');
    expect(block).toContain('Active levels (3)');
    expect(block).toContain('L1 — Office');
    expect(block).toContain('L3 — Committee');
    expect(block).toContain('Active thresholds: 4');
  });

  it('matriz vacía + sin summary + sin escalations → string vacío', () => {
    const block = buildAttributionsContextBlock({ matrix: matrix([], 0) });
    expect(block).toBe('');
  });

  it('matriz vacía pero con summary → renderiza header + summary', () => {
    const block = buildAttributionsContextBlock({
      matrix: matrix([], 0),
      summary: summary(),
    });
    expect(block).toContain('### Attribution matrix');
    expect(block).toContain('Matrix is empty');
    expect(block).toContain('### Reporting summary');
    expect(block).toContain('Total decisions: 150');
  });

  it('renderiza top 5 levels by count en summary', () => {
    const built = buildAttributionsContextBlock({
      matrix: matrix(),
      summary: summary({
        byLevel: [
          { levelId: 'lvl-1', level: level({ id: 'lvl-1', name: 'Office' }), stats: { count: 80, totalEur: 8_000_000, meanEur: 100_000, meanRarocPp: 14, meanDeviationBps: 0 }, byDecision: { approved: 70, rejected: 5, escalated: 5, expired: 0, reverted: 0 } },
          { levelId: 'lvl-2', level: level({ id: 'lvl-2', name: 'Zone'   }), stats: { count: 50, totalEur: 25_000_000, meanEur: 500_000, meanRarocPp: 12, meanDeviationBps: -3 }, byDecision: { approved: 40, rejected: 8, escalated: 2, expired: 0, reverted: 0 } },
        ],
      }),
    });
    expect(built).toContain('Volume by level');
    expect(built).toContain('Office: 80 decisions');
    expect(built).toContain('Zone: 50 decisions');
  });

  it('renderiza drift signals con top 5 ordenadas por severidad', () => {
    const built = buildAttributionsContextBlock({
      matrix: matrix(),
      summary: summary({
        drift: [
          drift({ userId: 'a', severity: 'warning',  meanDeviationBps: -7 }),
          drift({ userId: 'b', severity: 'breached', meanDeviationBps: -15 }),
        ],
      }),
    });
    expect(built).toContain('Drift signals: 1 breached');
    expect(built).toContain('Top 5 drift signals');
    // breached primero
    expect(built.indexOf('b: BREACHED')).toBeLessThan(built.indexOf('a: WARNING'));
  });

  it('redactInternalUsers sustituye emails por placeholders consistentes', () => {
    const block = buildAttributionsContextBlock({
      matrix: matrix(),
      summary: summary({
        drift: [
          drift({ userId: 'gestor1@bank.es' }),
          drift({ userId: 'gestor2@bank.es', severity: 'breached' }),
        ],
      }),
      recentEscalations: [decision({ decidedByUser: 'gestor1@bank.es' })],
      redactInternalUsers: true,
    });
    expect(block).not.toContain('gestor1@bank.es');
    expect(block).not.toContain('gestor2@bank.es');
    expect(block).toMatch(/<USER_REDACTED_\d+>/);
  });

  it('renderiza recent escalations cuando se proveen', () => {
    const block = buildAttributionsContextBlock({
      matrix: matrix(),
      recentEscalations: [decision({})],
    });
    expect(block).toContain('### Recent escalations');
    expect(block).toContain('ABC-1234');
  });

  it('drift sub-block muestra mensaje "no signals" cuando array vacío', () => {
    const block = buildAttributionsContextBlock({
      matrix: matrix(),
      summary: summary({ drift: [] }),
    });
    expect(block).toContain('No systematic drift signals detected');
  });
});

// ---------------------------------------------------------------------------
// suggestAttributionsActions
// ---------------------------------------------------------------------------

describe('aiContext · suggestAttributionsActions', () => {
  it('drift keyword → dashboard drift', () => {
    const out = suggestAttributionsActions({
      question: 'Who shows drift this quarter?',
      matrix: matrix(),
    });
    expect(out.some((a) => a.href.includes('#drift'))).toBe(true);
  });

  it('approve / pending → cockpit', () => {
    const out = suggestAttributionsActions({
      question: '¿Cuántos deals tengo pendientes de aprobar?',
      matrix: matrix(),
    });
    expect(out.some((a) => a.href === '/approvals')).toBe(true);
  });

  it('matrix / threshold / nivel → matrix editor', () => {
    const out = suggestAttributionsActions({
      question: 'How is my attribution matrix configured?',
      matrix: matrix(),
    });
    expect(out.some((a) => a.href === '/attributions/matrix')).toBe(true);
  });

  it('preguntas en español también matchean (jerarquía / al límite)', () => {
    const out = suggestAttributionsActions({
      question: '¿Quién está al límite en la jerarquía?',
      matrix: matrix(),
    });
    expect(out.some((a) => a.href === '/attributions/matrix')).toBe(true);
    expect(out.some((a) => a.href.includes('#drift'))).toBe(true);
  });

  it('pregunta neutral con drift breached en summary → fallback a drift', () => {
    const out = suggestAttributionsActions({
      question: 'tell me something interesting',
      matrix: matrix(),
      summary: summary({ drift: [drift({ severity: 'breached' })] }),
    });
    expect(out).toHaveLength(1);
    expect(out[0].href).toContain('#drift');
  });

  it('pregunta neutral sin drift → []', () => {
    const out = suggestAttributionsActions({
      question: 'how are you',
      matrix: matrix(),
    });
    expect(out).toEqual([]);
  });

  it('cap a 3 acciones únicas por href', () => {
    const out = suggestAttributionsActions({
      question: 'matriz threshold nivel jerarquía drift al límite approve pending volumen funnel',
      matrix: matrix(),
    });
    expect(out.length).toBeLessThanOrEqual(3);
    const hrefs = out.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length); // sin duplicados
  });
});

// ---------------------------------------------------------------------------
// Integración con buildCopilotPrompt
// ---------------------------------------------------------------------------

describe('aiContext + buildCopilotPrompt integración', () => {
  it('attributionsContext se inserta como sección entre Active snapshot y User question', async () => {
    const { buildCopilotPrompt } = await import('../copilot/promptBuilder');
    const block = buildAttributionsContextBlock({ matrix: matrix() });
    expect(block).not.toBe('');
    const result = buildCopilotPrompt({
      request: { question: 'how is the matrix?', lang: 'en', context: { oneLine: 'attributions' } },
      attributionsContext: block,
    });
    const idxSnap = result.prompt.indexOf('## Active snapshot');
    const idxAttr = result.prompt.indexOf('## Attributions context');
    const idxUser = result.prompt.indexOf('## User question');
    expect(idxSnap).toBeGreaterThan(0);
    expect(idxAttr).toBeGreaterThan(idxSnap);
    expect(idxUser).toBeGreaterThan(idxAttr);
  });

  it('attributionsContext vacío NO añade sección', async () => {
    const { buildCopilotPrompt } = await import('../copilot/promptBuilder');
    const result = buildCopilotPrompt({
      request: { question: 'q', lang: 'en', context: { oneLine: 'general' } },
      attributionsContext: '',
    });
    expect(result.prompt).not.toContain('## Attributions context');
  });

  it('attributionsContext undefined NO añade sección', async () => {
    const { buildCopilotPrompt } = await import('../copilot/promptBuilder');
    const result = buildCopilotPrompt({
      request: { question: 'q', lang: 'en', context: { oneLine: 'general' } },
    });
    expect(result.prompt).not.toContain('## Attributions context');
  });
});
