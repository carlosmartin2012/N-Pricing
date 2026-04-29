// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimelineDeprecationBanner from '../TimelineDeprecationBanner';

describe('TimelineDeprecationBanner', () => {
  it('renders an aria-labelled note with the testid hook for E2E', () => {
    render(<TimelineDeprecationBanner surface="escalations" />);
    const banner = screen.getByTestId('timeline-deprecation-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute('role')).toBe('note');
    expect(banner.getAttribute('aria-label')).toMatch(/Deal Timeline deprecation/i);
  });

  it('uses surface-specific copy for escalations', () => {
    render(<TimelineDeprecationBanner surface="escalations" />);
    expect(
      screen.getByText(/pricing snapshots, escalations and signed dossiers in one chronology/i),
    ).toBeInTheDocument();
  });

  it('uses surface-specific copy for dossiers', () => {
    render(<TimelineDeprecationBanner surface="dossiers" />);
    expect(
      screen.getByText(/Signed dossiers now also appear in the unified Deal Timeline/i),
    ).toBeInTheDocument();
  });

  it('mentions the History affordance + Deal Timeline in both surfaces', () => {
    // "History icon" appears twice (body sentence + chip footer); "Deal
    // Timeline" appears in title + chip. We assert presence at least once
    // and trust the per-surface copy tests above for distinct strings.
    const { rerender } = render(<TimelineDeprecationBanner surface="escalations" />);
    expect(screen.getAllByText(/History icon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deal Timeline/i).length).toBeGreaterThan(0);

    rerender(<TimelineDeprecationBanner surface="dossiers" />);
    expect(screen.getAllByText(/History icon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Deal Timeline/i).length).toBeGreaterThan(0);
  });
});
