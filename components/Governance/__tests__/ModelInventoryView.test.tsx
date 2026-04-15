// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModelInventoryEntry } from '../../../types/governance';

vi.mock('../../../api/governance');

import * as governanceApi from '../../../api/governance';

function buildModel(overrides: Partial<ModelInventoryEntry> = {}): ModelInventoryEntry {
  return {
    id: 'm-1',
    entityId: '00000000-0000-0000-0000-000000000010',
    kind: 'ruleset',
    name: 'IRRBB EBA 2018/02',
    version: '1.0.0',
    status: 'candidate',
    ownerEmail: 'mrm@bank.es',
    validationDocUrl: null,
    validatedAt: null,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    notes: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

let ModelInventoryView: React.ComponentType;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(governanceApi.listModels).mockReset();
  vi.mocked(governanceApi.createModel).mockReset();
  vi.mocked(governanceApi.updateModelStatus).mockReset();
  ModelInventoryView = (await import('../ModelInventoryView')).default;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ModelInventoryView', () => {
  it('shows the empty state with a registration CTA when no models are returned', async () => {
    vi.mocked(governanceApi.listModels).mockResolvedValue([]);

    render(<ModelInventoryView />);

    expect(await screen.findByText('No models match the current filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register first model/i })).toBeInTheDocument();
  });

  it('renders models with kind, version and owner columns', async () => {
    vi.mocked(governanceApi.listModels).mockResolvedValue([
      buildModel({ id: 'm-1', name: 'Pricing engine core', kind: 'engine', status: 'active' }),
      buildModel({ id: 'm-2', name: 'Mortgage CPR', kind: 'behavioural', status: 'candidate' }),
    ]);

    render(<ModelInventoryView />);

    await waitFor(() => {
      expect(screen.getByText('Pricing engine core')).toBeInTheDocument();
      expect(screen.getByText('Mortgage CPR')).toBeInTheDocument();
    });
    // Kind labels appear in both the kind filter buttons and the row chips —
    // at minimum two occurrences each (filter + chip).
    expect(screen.getAllByText('Pricing engine').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Behavioural').length).toBeGreaterThanOrEqual(1);
  });

  it('promotes a candidate to active via the transition button', async () => {
    const model = buildModel({ id: 'm-1', status: 'candidate' });
    vi.mocked(governanceApi.listModels).mockResolvedValue([model]);
    vi.mocked(governanceApi.updateModelStatus).mockResolvedValue({ ...model, status: 'active' });

    render(<ModelInventoryView />);

    await screen.findByText('IRRBB EBA 2018/02');
    // candidate → active transition button renders with label "→ active"
    await userEvent.click(screen.getByRole('button', { name: /→ active/i }));

    await waitFor(() => {
      expect(governanceApi.updateModelStatus).toHaveBeenCalledWith('m-1', 'active');
    });
  });
});
