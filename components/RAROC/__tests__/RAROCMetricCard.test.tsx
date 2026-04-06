// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RAROCMetricCard } from '../RAROCMetricCard';
import { TrendingUp, Shield, DollarSign, PieChart } from 'lucide-react';
import type { RarocMetricCardData } from '../rarocCalculatorUtils';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderCard(overrides: Partial<RarocMetricCardData> = {}) {
  const defaults: RarocMetricCardData = {
    title: 'RAROC',
    value: '14.25%',
    subtext: 'Above hurdle rate',
    trend: 'positive',
    tone: 'emerald',
    icon: TrendingUp,
  };
  return render(<RAROCMetricCard {...defaults} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RAROCMetricCard', () => {
  it('renders the metric title', () => {
    renderCard({ title: 'ECONOMIC PROFIT' });
    expect(screen.getByText('ECONOMIC PROFIT')).toBeInTheDocument();
  });

  it('renders the metric value', () => {
    renderCard({ value: '14.25%' });
    expect(screen.getByText('14.25%')).toBeInTheDocument();
  });

  it('renders the subtext', () => {
    renderCard({ subtext: 'Above hurdle rate' });
    expect(screen.getByText('Above hurdle rate')).toBeInTheDocument();
  });

  it('shows "Pass" label for positive trend', () => {
    renderCard({ trend: 'positive' });
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('shows "Fail" label for negative trend', () => {
    renderCard({ trend: 'negative' });
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  it('does not show Pass or Fail for neutral trend', () => {
    renderCard({ trend: 'neutral' });
    expect(screen.queryByText('Pass')).not.toBeInTheDocument();
    expect(screen.queryByText('Fail')).not.toBeInTheDocument();
  });

  it('applies emerald tone class to the value', () => {
    renderCard({ tone: 'emerald', value: '14.25%' });
    const valueElement = screen.getByText('14.25%');
    expect(valueElement.className).toContain('text-emerald-400');
  });

  it('applies cyan tone class to the value', () => {
    renderCard({ tone: 'cyan', value: '3.50%' });
    const valueElement = screen.getByText('3.50%');
    expect(valueElement.className).toContain('text-cyan-400');
  });

  it('applies amber tone class to the value', () => {
    renderCard({ tone: 'amber', value: '45 bps' });
    const valueElement = screen.getByText('45 bps');
    expect(valueElement.className).toContain('text-amber-400');
  });

  it('applies violet tone class to the value', () => {
    renderCard({ tone: 'violet', value: '€12,500' });
    const valueElement = screen.getByText('€12,500');
    expect(valueElement.className).toContain('text-violet-400');
  });

  it('applies emerald status class for positive trend', () => {
    renderCard({ trend: 'positive' });
    const passLabel = screen.getByText('Pass');
    expect(passLabel.className).toContain('text-emerald-500');
  });

  it('applies rose status class for negative trend', () => {
    renderCard({ trend: 'negative' });
    const failLabel = screen.getByText('Fail');
    expect(failLabel.className).toContain('text-rose-500');
  });

  it('renders correctly with different icons', () => {
    const icons = [TrendingUp, Shield, DollarSign, PieChart];
    for (const icon of icons) {
      const { unmount } = renderCard({ icon, title: `Test-${icon.displayName}` });
      expect(screen.getByText(`Test-${icon.displayName}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders a full metric card with all data', () => {
    renderCard({
      title: 'CAPITAL CHARGE',
      value: '€85,000',
      subtext: 'Pillar 1 + 2',
      trend: 'negative',
      tone: 'amber',
      icon: Shield,
    });
    expect(screen.getByText('CAPITAL CHARGE')).toBeInTheDocument();
    expect(screen.getByText('€85,000')).toBeInTheDocument();
    expect(screen.getByText('Pillar 1 + 2')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });
});
