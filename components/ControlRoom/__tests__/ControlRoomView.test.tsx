// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import ControlRoomView from '../ControlRoomView';
import { translations } from '../../../translations';
import type { DataContextType } from '../../../contexts/DataContext';
import { INITIAL_DEAL, MOCK_LIQUIDITY_CURVES, MOCK_YIELD_CURVE } from '../../../utils/seedData';
import { MOCK_ENTITIES } from '../../../utils/seedData.entities';
import { buildDemoWorkspaceData } from '../../../utils/demoWorkspaceData';

const demoWorkspace = buildDemoWorkspaceData({
  approvalMatrix: MOCK_ENTITIES[0]?.approvalMatrix ?? {
    autoApprovalThreshold: 15,
    l1Threshold: 10,
    l2Threshold: 5,
  },
});
const mockData = {
  deals: [
    { ...INITIAL_DEAL, id: 'DL-1', amount: 50_000_000, status: 'Pending_Approval' },
    { ...INITIAL_DEAL, id: 'DL-2', amount: 15_000_000, status: 'Review' },
    { ...INITIAL_DEAL, id: 'DL-3', amount: 10_000_000, status: 'Rejected' },
  ],
  marketDataSources: demoWorkspace.marketDataSources,
  yieldCurves: MOCK_YIELD_CURVE,
  liquidityCurves: MOCK_LIQUIDITY_CURVES,
  pricingDossiers: demoWorkspace.pricingDossiers,
  approvalTasks: demoWorkspace.approvalTasks.map((task) => ({
    ...task,
    status: 'Pending' as const,
    dueAt: new Date(Date.now() - 60_000).toISOString(),
  })),
  methodologyChangeRequests: [],
  syncStatus: 'synced',
} satisfies Partial<DataContextType>;

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockData,
}));

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ t: translations.en, workspaceMode: 'Risk' }),
}));

describe('ControlRoomView', () => {
  it('renders decision, readiness and operational signal surfaces', () => {
    render(
      <MemoryRouter>
        <ControlRoomView />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('control-room-view')).toBeInTheDocument();
    expect(screen.getByText('Decision queue')).toBeInTheDocument();
    expect(screen.getByText('Market readiness')).toBeInTheDocument();
    expect(screen.getByText('Operational signals')).toBeInTheDocument();
    expect(screen.getByText('Overdue approvals')).toBeInTheDocument();
    expect(screen.getByText('Stress pricing')).toBeInTheDocument();
  });
});
