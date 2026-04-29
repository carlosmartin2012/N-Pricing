// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineFilters from '../TimelineFilters';
import type { DealTimelineEventKind } from '../../../types/dealTimeline';

const ALL: DealTimelineEventKind[] = [
  'deal_created', 'deal_repriced', 'escalation_opened',
  'escalation_resolved', 'escalation_expired', 'dossier_signed',
];

describe('TimelineFilters', () => {
  it('renders one chip per kind plus All/None controls', () => {
    render(
      <TimelineFilters
        enabled={new Set(ALL)}
        onToggle={vi.fn()}
        onAll={vi.fn()}
        onNone={vi.fn()}
        counts={{}}
      />,
    );
    // 6 kinds + All + None = 8 buttons total
    expect(screen.getAllByRole('button')).toHaveLength(ALL.length + 2);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('marks aria-pressed=true for enabled kinds and false otherwise', () => {
    render(
      <TimelineFilters
        enabled={new Set<DealTimelineEventKind>(['deal_repriced'])}
        onToggle={vi.fn()}
        onAll={vi.fn()}
        onNone={vi.fn()}
        counts={{}}
      />,
    );
    const repriced = screen.getByRole('button', { name: /repriced/i });
    const opened   = screen.getByRole('button', { name: /escalation opened/i });
    expect(repriced.getAttribute('aria-pressed')).toBe('true');
    expect(opened.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onToggle with the kind when a chip is clicked', () => {
    const onToggle = vi.fn();
    render(
      <TimelineFilters
        enabled={new Set(ALL)}
        onToggle={onToggle}
        onAll={vi.fn()}
        onNone={vi.fn()}
        counts={{}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dossier signed/i }));
    expect(onToggle).toHaveBeenCalledWith('dossier_signed');
  });

  it('calls onAll / onNone for the bulk controls', () => {
    const onAll = vi.fn();
    const onNone = vi.fn();
    render(
      <TimelineFilters
        enabled={new Set()}
        onToggle={vi.fn()}
        onAll={onAll}
        onNone={onNone}
        counts={{}}
      />,
    );
    fireEvent.click(screen.getByText('All'));
    fireEvent.click(screen.getByText('None'));
    expect(onAll).toHaveBeenCalledTimes(1);
    expect(onNone).toHaveBeenCalledTimes(1);
  });

  it('renders the count suffix per kind', () => {
    render(
      <TimelineFilters
        enabled={new Set(ALL)}
        onToggle={vi.fn()}
        onAll={vi.fn()}
        onNone={vi.fn()}
        counts={{ deal_repriced: 3, escalation_opened: 1 }}
      />,
    );
    const repriced = screen.getByRole('button', { name: /repriced/i });
    expect(repriced.textContent).toMatch(/3/);
    const opened = screen.getByRole('button', { name: /escalation opened/i });
    expect(opened.textContent).toMatch(/1/);
  });
});
