// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { UIProvider } from '../../../contexts/UIContext';
import { PricingScenarioCard } from '../PricingScenarioCard';
import type { PricingScenario } from '../pricingComparisonUtils';
import type { Transaction } from '../../../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseScenario: PricingScenario = {
  id: 'base',
  name: 'Base Case',
  shocks: { interestRate: 0, liquiditySpread: 0 },
  overrides: {},
};

const stressScenario: PricingScenario = {
  id: 'stress-up',
  name: 'Rates +100bps',
  shocks: { interestRate: 100, liquiditySpread: 25 },
  overrides: { marginTarget: 3.5 },
};

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  collateralType: 'None',
};

const collateralOptions: Transaction['collateralType'][] = [
  'None',
  'Sovereign',
  'Corporate',
  'Cash',
  'Real_Estate',
];

const noop = vi.fn();

function renderCard(overrides: Partial<Parameters<typeof PricingScenarioCard>[0]> = {}) {
  return render(
    <MemoryRouter>
    <UIProvider>
      <PricingScenarioCard
        scenario={baseScenario}
        scenarioIndex={0}
        scenariosLength={2}
        baseDeal={baseDeal}
        collateralOptions={collateralOptions}
        maxScenarios={3}
        onUpdateScenario={noop}
        onUpdateShock={noop}
        onUpdateOverride={noop}
        onDuplicate={noop}
        onRemove={noop}
        {...overrides}
      />
    </UIProvider>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PricingScenarioCard', () => {
  it('renders scenario name in the text input', () => {
    renderCard();
    const nameInput = screen.getByDisplayValue('Base Case');
    expect(nameInput).toBeInTheDocument();
  });

  it('renders all shock and override input fields', () => {
    renderCard();
    expect(screen.getByText('Interest Rate (bps)')).toBeInTheDocument();
    expect(screen.getByText('Liquidity Spread (bps)')).toBeInTheDocument();
    expect(screen.getByText('Margin Target (%)')).toBeInTheDocument();
    expect(screen.getByText('Collateral Type')).toBeInTheDocument();
  });

  it('displays shock values from the scenario', () => {
    renderCard({ scenario: stressScenario });
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });

  it('displays margin target override when present', () => {
    renderCard({ scenario: stressScenario });
    expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
  });

  it('falls back to baseDeal marginTarget when no override', () => {
    renderCard({ scenario: baseScenario });
    expect(screen.getByDisplayValue('2.25')).toBeInTheDocument();
  });

  it('shows Duplicate button when below max scenarios', () => {
    renderCard({ scenariosLength: 2, maxScenarios: 3 });
    expect(screen.getByTitle('Duplicate')).toBeInTheDocument();
  });

  it('hides Duplicate button when at max scenarios', () => {
    renderCard({ scenariosLength: 3, maxScenarios: 3 });
    expect(screen.queryByTitle('Duplicate')).not.toBeInTheDocument();
  });

  it('hides Remove button for the base scenario (id === "base")', () => {
    renderCard({ scenario: baseScenario });
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
  });

  it('shows Remove button for non-base scenarios', () => {
    renderCard({ scenario: stressScenario });
    expect(screen.getByTitle('Remove')).toBeInTheDocument();
  });

  it('calls onUpdateScenario when name is changed', async () => {
    const onUpdateScenario = vi.fn();
    renderCard({ onUpdateScenario });
    const nameInput = screen.getByDisplayValue('Base Case');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Name');
    expect(onUpdateScenario).toHaveBeenCalled();
    // The last call should include the scenario id and partial update
    const lastCall = onUpdateScenario.mock.calls[onUpdateScenario.mock.calls.length - 1];
    expect(lastCall[0]).toBe('base');
  });

  it('calls onUpdateShock when interest rate shock is changed', async () => {
    const onUpdateShock = vi.fn();
    renderCard({ onUpdateShock, scenario: stressScenario });
    const irInput = screen.getByDisplayValue('100');
    await userEvent.clear(irInput);
    await userEvent.type(irInput, '200');
    expect(onUpdateShock).toHaveBeenCalled();
  });

  it('calls onDuplicate when Duplicate button is clicked', async () => {
    const onDuplicate = vi.fn();
    renderCard({ onDuplicate });
    await userEvent.click(screen.getByTitle('Duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith(baseScenario);
  });

  it('calls onRemove when Remove button is clicked', async () => {
    const onRemove = vi.fn();
    renderCard({ scenario: stressScenario, onRemove });
    await userEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalledWith('stress-up');
  });

  it('renders collateral select with all options', () => {
    renderCard();
    const select = screen.getByDisplayValue('None');
    expect(select).toBeInTheDocument();
    for (const option of collateralOptions) {
      expect(screen.getByText(option!)).toBeInTheDocument();
    }
  });

  it('calls onUpdateOverride when collateral type is changed', async () => {
    const onUpdateOverride = vi.fn();
    renderCard({ onUpdateOverride });
    const select = screen.getByDisplayValue('None');
    await userEvent.selectOptions(select, 'Cash');
    expect(onUpdateOverride).toHaveBeenCalledWith('base', 'collateralType', 'Cash');
  });
});
