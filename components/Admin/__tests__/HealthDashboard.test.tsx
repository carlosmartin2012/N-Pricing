// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { UIProvider } from '../../../contexts/UIContext';
import HealthDashboard from '../HealthDashboard';

const mocks = vi.hoisted(() => ({
  getHealthSummary: vi.fn(),
  listAlertRules: vi.fn(),
  getSLOSummary: vi.fn(),
  getAdapterHealth: vi.fn(),
}));

vi.mock('../../../api/observability', () => ({
  getHealthSummary: mocks.getHealthSummary,
  listAlertRules: mocks.listAlertRules,
  getSLOSummary: mocks.getSLOSummary,
  getAdapterHealth: mocks.getAdapterHealth,
}));

vi.mock('../../../contexts/EntityContext', () => ({
  useEntity: () => ({
    activeEntity: { id: 'entity-1', shortCode: 'NFQES' },
  }),
}));

describe('HealthDashboard', () => {
  beforeEach(() => {
    mocks.getHealthSummary.mockReset();
    mocks.listAlertRules.mockReset();
    mocks.getSLOSummary.mockReset().mockResolvedValue(null);
    mocks.getAdapterHealth.mockReset().mockResolvedValue({
      generatedAt: new Date().toISOString(),
      adapters: [],
    });
  });

  it('renders live summary metrics and alert rules from the observability API', async () => {
    mocks.getHealthSummary.mockResolvedValue({
      entityId: 'entity-1',
      pricingLatencyP50Ms: 58,
      pricingLatencyP95Ms: 192,
      latencySampleCount24h: 5,
      errorEvents24h: 2,
      dealCount: 10,
      activeAlertRules: 1,
    });
    mocks.listAlertRules.mockResolvedValue([
      {
        id: 'alert-1',
        entityId: 'entity-1',
        name: 'Latency Guardrail',
        metricName: 'pricing_latency_ms',
        operator: 'gte',
        threshold: 250,
        recipients: ['treasury@nfq.es'],
        isActive: true,
        lastTriggeredAt: null,
        createdAt: '2026-04-12T00:00:00.000Z',
      },
    ]);

    render(
      <MemoryRouter>
      <UIProvider>
        <HealthDashboard />
      </UIProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.getHealthSummary).toHaveBeenCalledWith('entity-1');
      expect(mocks.listAlertRules).toHaveBeenCalledWith('entity-1');
    });

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('58ms')).toBeInTheDocument();
    expect(screen.getByText('192ms')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/last 24h/i)).toBeInTheDocument();
    expect(screen.getByText('Latency Guardrail')).toBeInTheDocument();
    expect(screen.getByText('pricing_latency_ms')).toBeInTheDocument();
  });

  it('shows the empty-state hint when no alert rules exist', async () => {
    mocks.getHealthSummary.mockResolvedValue({
      entityId: 'entity-1',
      pricingLatencyP50Ms: null,
      pricingLatencyP95Ms: null,
      latencySampleCount24h: 0,
      errorEvents24h: 0,
      dealCount: 0,
      activeAlertRules: 0,
    });
    mocks.listAlertRules.mockResolvedValue([]);

    render(
      <MemoryRouter>
      <UIProvider>
        <HealthDashboard />
      </UIProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('No alert rules configured')).toBeInTheDocument();
    expect(screen.getByText('No recent metrics available for the active entity yet.')).toBeInTheDocument();
  });
});
