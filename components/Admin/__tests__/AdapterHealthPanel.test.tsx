// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AdapterHealthPanel from '../AdapterHealthPanel';

const mocks = vi.hoisted(() => ({
  getAdapterHealth: vi.fn(),
}));

vi.mock('../../../api/observability', () => ({
  getAdapterHealth: mocks.getAdapterHealth,
}));

describe('AdapterHealthPanel', () => {
  beforeEach(() => {
    mocks.getAdapterHealth.mockReset();
  });

  it('renders one row per adapter and flags a degraded one', async () => {
    mocks.getAdapterHealth.mockResolvedValue({
      generatedAt: '2026-04-18T10:00:00.000Z',
      adapters: [
        { kind: 'core_banking', name: 'in-memory', ok: true, latencyMs: 0, message: null, checkedAt: '2026-04-18T10:00:00.000Z' },
        { kind: 'crm', name: 'salesforce-fsc', ok: false, latencyMs: null, message: 'stub adapter — pending real implementation', checkedAt: '2026-04-18T10:00:00.000Z' },
        { kind: 'market_data', name: 'in-memory', ok: true, latencyMs: 2, message: null, checkedAt: '2026-04-18T10:00:00.000Z' },
      ],
    });

    render(<AdapterHealthPanel />);

    await waitFor(() => expect(mocks.getAdapterHealth).toHaveBeenCalled());

    // All three adapters surface as rows
    expect(screen.getByText('salesforce-fsc')).toBeInTheDocument();
    expect(screen.getAllByText('in-memory')).toHaveLength(2);

    // The CRM row is flagged Down; the other two are Online
    expect(screen.getAllByText('Online')).toHaveLength(2);
    expect(screen.getByText('Down')).toBeInTheDocument();

    // Stub message is surfaced so operators see why it's down
    expect(screen.getByText(/stub adapter/i)).toBeInTheDocument();
  });

  it('shows the empty-state hint when no adapters are registered', async () => {
    mocks.getAdapterHealth.mockResolvedValue({
      generatedAt: '2026-04-18T10:00:00.000Z',
      adapters: [],
    });

    render(<AdapterHealthPanel />);

    expect(
      await screen.findByText(/no adapters registered for this deployment/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ADAPTER_CRM/)).toBeInTheDocument();
  });

  it('shows an unavailable state when the API returns null', async () => {
    mocks.getAdapterHealth.mockResolvedValue(null);

    render(<AdapterHealthPanel />);

    expect(
      await screen.findByText(/adapter registry is unavailable/i),
    ).toBeInTheDocument();
  });
});
