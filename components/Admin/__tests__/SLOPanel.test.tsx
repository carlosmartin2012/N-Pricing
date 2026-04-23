// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSLOSummary: vi.fn(),
  getTenancyViolations: vi.fn(),
}));

vi.mock('../../../api/observability', () => ({
  getSLOSummary: mocks.getSLOSummary,
  getTenancyViolations: mocks.getTenancyViolations,
}));

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({ activeEntity: { id: 'E1', shortCode: 'BANK-ES' } }),
}));

import SLOPanel from '../SLOPanel';

const baseSummary = {
  entityId: 'E1',
  generatedAt: '2026-04-23T12:00:00Z',
  window: '1h',
  slos: [
    {
      name: 'pricing_single_latency_ms',
      target: 300,
      current: 180,
      status: 'ok',
      window: '1h',
      percentiles: { p50: 90, p95: 180, p99: 240 },
      sampleCount: 120,
    },
  ],
  activeAlerts: [],
};

describe('SLOPanel — tenancy violations widget', () => {
  beforeEach(() => {
    mocks.getSLOSummary.mockReset();
    mocks.getTenancyViolations.mockReset();
    mocks.getSLOSummary.mockResolvedValue(baseSummary);
  });

  it('renders the empty-state copy when no violations in the window', async () => {
    mocks.getTenancyViolations.mockResolvedValue({
      entityId: 'E1',
      windowMinutes: 60,
      since: '2026-04-23T11:00:00Z',
      total: 0,
      topEndpoints: [],
    });

    render(<SLOPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('tenancy-violations-total')).toHaveTextContent('0');
    });
    expect(screen.getByText(/Clean window/i)).toBeInTheDocument();
    expect(screen.getByText(/last 60m/i)).toBeInTheDocument();
  });

  it('renders the top-endpoints breakdown when there are violations', async () => {
    mocks.getTenancyViolations.mockResolvedValue({
      entityId: 'E1',
      windowMinutes: 60,
      since: '2026-04-23T11:00:00Z',
      total: 7,
      topEndpoints: [
        { endpoint: 'GET /api/deals', errorCode: 'tenancy_missing_header', count: 4 },
        { endpoint: 'POST /api/pricing', errorCode: 'cross_entity_claim', count: 3 },
      ],
    });

    render(<SLOPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('tenancy-violations-total')).toHaveTextContent('7');
    });
    expect(screen.getByText('GET /api/deals')).toBeInTheDocument();
    expect(screen.getByText('POST /api/pricing')).toBeInTheDocument();
    expect(screen.getByText('tenancy_missing_header')).toBeInTheDocument();
    expect(screen.getByText('cross_entity_claim')).toBeInTheDocument();
    expect(screen.queryByText(/Clean window/i)).not.toBeInTheDocument();
  });

  it('hides the violations section when the API returns null', async () => {
    mocks.getTenancyViolations.mockResolvedValue(null);

    render(<SLOPanel />);

    // SLO summary still renders
    await waitFor(() => {
      expect(screen.getByText(/pricing_single_latency_ms/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tenancy-violations-total')).not.toBeInTheDocument();
    expect(screen.queryByText(/Clean window/i)).not.toBeInTheDocument();
  });
});
