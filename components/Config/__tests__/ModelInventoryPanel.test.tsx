// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelInventoryPanel from '../ModelInventoryPanel';
import { DEFAULT_SEED } from '../modelInventoryConfig';

describe('ModelInventoryPanel', () => {
  it('filters the inventory by status', async () => {
    render(<ModelInventoryPanel initialModels={DEFAULT_SEED} />);

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'INTERNAL_VALIDATION');

    expect(screen.getByText('Mortgage Prepayment CPR')).toBeInTheDocument();
    expect(screen.queryByText('Anejo IX PD — Corporate')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 6 modelos')).toBeInTheDocument();
  });

  it('opens the details drawer for the selected model', async () => {
    render(<ModelInventoryPanel initialModels={DEFAULT_SEED} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Ver detalles' })[0]!);

    expect(
      screen.getByRole('dialog', { name: /detalles del modelo anejo ix pd/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Referencia metodológica')).toBeInTheDocument();
    expect(screen.getByText('Segmentos aplicables')).toBeInTheDocument();
  });

  it('shows the empty state when no models match the selected category', async () => {
    render(<ModelInventoryPanel initialModels={DEFAULT_SEED} />);

    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'STRESS_SCENARIO');

    expect(
      screen.getByText('Sin modelos que coincidan con los filtros seleccionados.')
    ).toBeInTheDocument();
  });
});
