// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { UIProvider } from '../../../contexts/UIContext';
import BlotterToolbar from '../BlotterToolbar';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const noop = vi.fn();

function renderToolbar(overrides: Partial<Parameters<typeof BlotterToolbar>[0]> = {}) {
  return render(
    <MemoryRouter>
    <UIProvider>
      <BlotterToolbar
        searchTerm=""
        filterStatus="All"
        onSearchChange={noop}
        onFilterChange={noop}
        onExportCsv={noop}
        onExportExcel={noop}
        {...overrides}
      />
    </UIProvider>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlotterToolbar', () => {
  it('renders the search input with placeholder', () => {
    renderToolbar();
    expect(screen.getByPlaceholderText('Search Client or ID...')).toBeInTheDocument();
  });

  it('renders the status filter select with default value', () => {
    renderToolbar();
    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
  });

  it('renders CSV and Excel export buttons', () => {
    renderToolbar();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();
  });

  it('displays current search term in the input', () => {
    renderToolbar({ searchTerm: 'BBVA' });
    expect(screen.getByDisplayValue('BBVA')).toBeInTheDocument();
  });

  it('calls onSearchChange when user types in search input', async () => {
    const onSearchChange = vi.fn();
    renderToolbar({ onSearchChange });
    const searchInput = screen.getByPlaceholderText('Search Client or ID...');
    await userEvent.type(searchInput, 'Santander');
    // Each keystroke triggers a change event
    expect(onSearchChange).toHaveBeenCalledTimes('Santander'.length);
    expect(onSearchChange).toHaveBeenLastCalledWith(expect.stringContaining('r'));
  });

  it('calls onFilterChange when filter status is changed', async () => {
    const onFilterChange = vi.fn();
    renderToolbar({ onFilterChange });
    const filterSelect = screen.getByDisplayValue('All Status');
    await userEvent.selectOptions(filterSelect, 'Approved');
    expect(onFilterChange).toHaveBeenCalledWith('Approved');
  });

  it('renders all status filter options', () => {
    renderToolbar();
    const expectedOptions = [
      'All Status',
      'Draft',
      'Pending',
      'Pending Approval',
      'Approved',
      'Booked',
      'Rejected',
      'Review',
    ];
    for (const label of expectedOptions) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('calls onExportCsv when CSV button is clicked', async () => {
    const onExportCsv = vi.fn();
    renderToolbar({ onExportCsv });
    await userEvent.click(screen.getByText('CSV'));
    expect(onExportCsv).toHaveBeenCalledOnce();
  });

  it('calls onExportExcel when Excel button is clicked', async () => {
    const onExportExcel = vi.fn();
    renderToolbar({ onExportExcel });
    await userEvent.click(screen.getByText('Excel'));
    expect(onExportExcel).toHaveBeenCalledOnce();
  });

  it('reflects the selected filter status', () => {
    renderToolbar({ filterStatus: 'Pending_Approval' });
    const select = screen.getByDisplayValue('Pending Approval');
    expect(select).toBeInTheDocument();
  });
});
