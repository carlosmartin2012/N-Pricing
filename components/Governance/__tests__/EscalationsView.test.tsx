// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApprovalEscalation, ApprovalEscalationConfig } from '../../../types/governance';

// Mock the API module before importing the component
vi.mock('../../../api/escalations');
// WalkthroughContext is consumed via useWalkthroughOptional which returns null
// when no provider is present — no mock needed, tests render outside the tree.

import * as escalationsApi from '../../../api/escalations';

const ENTITY = '00000000-0000-0000-0000-000000000010';

function buildEscalation(overrides: Partial<ApprovalEscalation> = {}): ApprovalEscalation {
  return {
    id: overrides.id ?? 'esc-1',
    entityId: ENTITY,
    dealId: 'deal-abcdef12',
    exceptionId: null,
    level: 'L1',
    dueAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
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

function buildConfig(level: 'L1' | 'L2' | 'Committee', timeoutHours: number): ApprovalEscalationConfig {
  return {
    id: `cfg-${level}`,
    entityId: ENTITY,
    level,
    timeoutHours,
    notifyBeforeHours: 4,
    channelType: 'email',
    channelConfig: {},
    isActive: true,
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
  };
}

let EscalationsView: React.ComponentType;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(escalationsApi.listEscalations).mockReset();
  vi.mocked(escalationsApi.listConfigs).mockReset();
  vi.mocked(escalationsApi.runSweep).mockReset();
  vi.mocked(escalationsApi.resolveEscalation).mockReset();
  EscalationsView = (await import('../EscalationsView')).default;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('EscalationsView', () => {
  it('renders empty state when no escalations match the open filter', async () => {
    vi.mocked(escalationsApi.listEscalations).mockResolvedValue([]);
    vi.mocked(escalationsApi.listConfigs).mockResolvedValue({});

    render(<EscalationsView />);

    expect(await screen.findByText('No open escalations')).toBeInTheDocument();
    // All five KPI buckets rendered
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Escalated')).toBeInTheDocument();
  });

  it('renders a table with escalations and flags overdue rows', async () => {
    const pastDue = buildEscalation({
      id: 'past',
      level: 'L1',
      dueAt: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
    });
    const future = buildEscalation({
      id: 'future',
      level: 'L2',
      dueAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    });
    vi.mocked(escalationsApi.listEscalations).mockResolvedValue([pastDue, future]);
    vi.mocked(escalationsApi.listConfigs).mockResolvedValue({
      L1: buildConfig('L1', 24),
      L2: buildConfig('L2', 48),
    });

    render(<EscalationsView />);

    // L1 and L2 chips present
    await waitFor(() => {
      expect(screen.getByText('L1')).toBeInTheDocument();
      expect(screen.getByText('L2')).toBeInTheDocument();
    });
    // Overdue badge only on the past-due row
    expect(screen.getByText('overdue')).toBeInTheDocument();
  });

  it('triggers sweep and reloads the list on click', async () => {
    vi.mocked(escalationsApi.listEscalations).mockResolvedValue([]);
    vi.mocked(escalationsApi.listConfigs).mockResolvedValue({});
    vi.mocked(escalationsApi.runSweep).mockResolvedValue({
      summary: { notified: 0, escalated: 0, expired: 0, untouched: 0 },
      evaluatedAt: new Date().toISOString(),
    });

    render(<EscalationsView />);
    await screen.findByText('No open escalations');

    await userEvent.click(screen.getByRole('button', { name: /Run sweep/i }));

    await waitFor(() => {
      expect(escalationsApi.runSweep).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the configs panel with seeded timeouts when toggled', async () => {
    vi.mocked(escalationsApi.listEscalations).mockResolvedValue([]);
    vi.mocked(escalationsApi.listConfigs).mockResolvedValue({
      L1: buildConfig('L1', 24),
      L2: buildConfig('L2', 48),
      Committee: buildConfig('Committee', 120),
    });

    render(<EscalationsView />);
    await screen.findByText('No open escalations');

    await userEvent.click(screen.getByRole('button', { name: /Configs/i }));

    expect(screen.getByText('Timeout configuration · per level')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('48h')).toBeInTheDocument();
    expect(screen.getByText('120h')).toBeInTheDocument();
  });
});
