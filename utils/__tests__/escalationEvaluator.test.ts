import { describe, it, expect } from 'vitest';
import {
  evaluateEscalation,
  promoteLevel,
  sweepEscalations,
  computeDueAt,
} from '../governance/escalationEvaluator';
import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationLevel,
} from '../../types/governance';

const HOUR = 3_600_000;
const ENTITY = '00000000-0000-0000-0000-000000000010';

function makeConfig(
  level: EscalationLevel,
  timeoutHours: number,
  notifyBeforeHours = 0,
): ApprovalEscalationConfig {
  return {
    id: `cfg-${level}`,
    entityId: ENTITY,
    level,
    timeoutHours,
    notifyBeforeHours,
    channelType: 'email',
    channelConfig: {},
    isActive: true,
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
  };
}

function makeEscalation(overrides: Partial<ApprovalEscalation> = {}): ApprovalEscalation {
  return {
    id: 'esc-1',
    entityId: ENTITY,
    dealId: 'deal-1',
    exceptionId: null,
    level: 'L1',
    dueAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    status: 'open',
    notifiedAt: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    openedBy: 'trader@bank.es',
    currentNotes: null,
    escalatedFromId: null,
    ...overrides,
  };
}

describe('promoteLevel', () => {
  it('promotes L1 → L2', () => {
    expect(promoteLevel('L1')).toBe('L2');
  });
  it('promotes L2 → Committee', () => {
    expect(promoteLevel('L2')).toBe('Committee');
  });
  it('returns null for Committee (terminal)', () => {
    expect(promoteLevel('Committee')).toBeNull();
  });
});

describe('computeDueAt', () => {
  it('adds the requested hours to the anchor', () => {
    const now = new Date('2026-04-15T10:00:00Z');
    expect(computeDueAt(now, 24)).toBe('2026-04-16T10:00:00.000Z');
  });
  it('accepts fractional hours', () => {
    const now = new Date('2026-04-15T10:00:00Z');
    expect(computeDueAt(now, 0.5)).toBe('2026-04-15T10:30:00.000Z');
  });
});

describe('evaluateEscalation', () => {
  it('returns none for terminal statuses', () => {
    const now = new Date();
    for (const status of ['resolved', 'escalated', 'expired'] as const) {
      const escalation = makeEscalation({
        status,
        dueAt: new Date(now.getTime() - 1000).toISOString(),
      });
      expect(evaluateEscalation({ escalation, configs: {}, now }).kind).toBe('none');
    }
  });

  it('returns none when still well before dueAt', () => {
    const now = new Date('2026-04-15T10:00:00Z');
    const escalation = makeEscalation({ dueAt: '2026-04-16T10:00:00Z' });
    const configs = { L1: makeConfig('L1', 24, 4) };
    expect(evaluateEscalation({ escalation, configs, now }).kind).toBe('none');
  });

  it('emits notify when inside the pre-expiry window', () => {
    const now = new Date('2026-04-16T07:00:00Z'); // 3h before due, warning=4h
    const escalation = makeEscalation({ dueAt: '2026-04-16T10:00:00Z' });
    const configs = { L1: makeConfig('L1', 24, 4) };
    const action = evaluateEscalation({ escalation, configs, now });
    expect(action.kind).toBe('notify');
    if (action.kind === 'notify') expect(action.reason).toBe('approaching_due');
  });

  it('does not re-notify when already notifiedAt is set', () => {
    const now = new Date('2026-04-16T07:00:00Z');
    const escalation = makeEscalation({
      dueAt: '2026-04-16T10:00:00Z',
      notifiedAt: '2026-04-16T06:00:00Z',
    });
    const configs = { L1: makeConfig('L1', 24, 4) };
    expect(evaluateEscalation({ escalation, configs, now }).kind).toBe('none');
  });

  it('skips notify when notifyBeforeHours is zero', () => {
    const now = new Date('2026-04-16T09:59:00Z');
    const escalation = makeEscalation({ dueAt: '2026-04-16T10:00:00Z' });
    const configs = { L1: makeConfig('L1', 24, 0) };
    expect(evaluateEscalation({ escalation, configs, now }).kind).toBe('none');
  });

  it('escalates L1 → L2 past due and uses the L2 timeout for the new due', () => {
    const now = new Date('2026-04-16T11:00:00Z');
    const escalation = makeEscalation({ level: 'L1', dueAt: '2026-04-16T10:00:00Z' });
    const configs = { L1: makeConfig('L1', 24, 4), L2: makeConfig('L2', 48, 8) };
    const action = evaluateEscalation({ escalation, configs, now });
    expect(action.kind).toBe('escalate');
    if (action.kind === 'escalate') {
      expect(action.fromLevel).toBe('L1');
      expect(action.toLevel).toBe('L2');
      // now + 48h
      expect(action.newDueAt).toBe('2026-04-18T11:00:00.000Z');
    }
  });

  it('escalates L2 → Committee past due', () => {
    const now = new Date('2026-04-16T11:00:00Z');
    const escalation = makeEscalation({ level: 'L2', dueAt: '2026-04-16T10:00:00Z' });
    const configs = {
      L2: makeConfig('L2', 48, 8),
      Committee: makeConfig('Committee', 120, 24),
    };
    const action = evaluateEscalation({ escalation, configs, now });
    expect(action.kind).toBe('escalate');
    if (action.kind === 'escalate') expect(action.toLevel).toBe('Committee');
  });

  it('expires a past-due Committee (no next level)', () => {
    const now = new Date('2026-04-20T10:00:00Z');
    const escalation = makeEscalation({ level: 'Committee', dueAt: '2026-04-20T09:00:00Z' });
    const configs = { Committee: makeConfig('Committee', 120, 24) };
    const action = evaluateEscalation({ escalation, configs, now });
    expect(action.kind).toBe('expire');
    if (action.kind === 'expire') expect(action.reason).toBe('no_next_level');
  });

  it('falls back to the current level timeout when the target level has no config', () => {
    const now = new Date('2026-04-16T11:00:00Z');
    const escalation = makeEscalation({ level: 'L1', dueAt: '2026-04-16T10:00:00Z' });
    // L2 missing — fallback to L1's 24h
    const configs = { L1: makeConfig('L1', 24, 0) };
    const action = evaluateEscalation({ escalation, configs, now });
    expect(action.kind).toBe('escalate');
    if (action.kind === 'escalate') {
      expect(action.newDueAt).toBe('2026-04-17T11:00:00.000Z');
    }
  });
});

describe('sweepEscalations', () => {
  it('evaluates each escalation against its entity configs', () => {
    const now = new Date('2026-04-16T11:00:00Z');
    const pastDue = makeEscalation({
      id: 'past',
      level: 'L1',
      dueAt: '2026-04-16T10:00:00Z',
    });
    const future = makeEscalation({
      id: 'future',
      level: 'L1',
      dueAt: '2026-04-17T10:00:00Z',
    });
    const configsByEntity = {
      [ENTITY]: { L1: makeConfig('L1', 24), L2: makeConfig('L2', 48) },
    };
    const results = sweepEscalations([pastDue, future], configsByEntity, now);
    expect(results).toHaveLength(2);
    expect(results[0].action.kind).toBe('escalate');
    expect(results[1].action.kind).toBe('none');
  });

  it('uses empty config when entity is missing from the map', () => {
    const now = new Date('2026-04-16T11:00:00Z');
    const escalation = makeEscalation({ level: 'L1', dueAt: '2026-04-16T10:00:00Z' });
    const results = sweepEscalations([escalation], {}, now);
    // No configs ⇒ escalate with fallback 24h default
    expect(results[0].action.kind).toBe('escalate');
  });
});
