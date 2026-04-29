// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineEventCard from '../TimelineEventCard';
import type { DealTimelineEvent } from '../../../types/dealTimeline';

const baseEvent: DealTimelineEvent = {
  id: 'snapshot:S-1',
  dealId: 'D-001',
  occurredAt: '2026-04-01T08:00:00Z',
  kind: 'deal_repriced',
  actor: { email: 'alice@bank.es', name: null, role: null },
  snapshotId: 'S-1',
  payload: { kind: 'deal_repriced', ftpPct: 3.5, finalClientRatePct: 4.5, rarocPct: 14.0, engineVersion: 'v1' },
};

describe('TimelineEventCard', () => {
  it('renders the event label and the actor email', () => {
    render(<TimelineEventCard event={baseEvent} />);
    expect(screen.getByText('Repriced')).toBeInTheDocument();
    expect(screen.getByText(/alice@bank.es/)).toBeInTheDocument();
  });

  it('falls back to "system" when actor email is null', () => {
    const ev: DealTimelineEvent = { ...baseEvent, actor: { email: null, name: null, role: null } };
    render(<TimelineEventCard event={ev} />);
    expect(screen.getByText(/by system/i)).toBeInTheDocument();
  });

  it('renders the formatted summary line', () => {
    render(<TimelineEventCard event={baseEvent} />);
    expect(screen.getByText(/FTP 3\.50% · Rate 4\.50% · RAROC 14\.0%/)).toBeInTheDocument();
  });

  it('renders the Replay button only when onReplaySnapshot is provided AND snapshotId exists', () => {
    const onReplay = vi.fn();
    const { rerender } = render(<TimelineEventCard event={baseEvent} />);
    expect(screen.queryByRole('button', { name: /replay snapshot/i })).toBeNull();

    rerender(<TimelineEventCard event={baseEvent} onReplaySnapshot={onReplay} />);
    const btn = screen.getByRole('button', { name: /replay snapshot s-1/i });
    fireEvent.click(btn);
    expect(onReplay).toHaveBeenCalledWith('S-1');
  });

  it('does not render Replay when snapshotId is missing even if handler provided', () => {
    const ev: DealTimelineEvent = { ...baseEvent, snapshotId: undefined };
    render(<TimelineEventCard event={ev} onReplaySnapshot={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /replay snapshot/i })).toBeNull();
  });

  it('attaches a stable id derived from the event id (used by ?focus= deep-links)', () => {
    // CSS selectors treat ":" as a pseudo-class delimiter, so we look up the
    // node by id directly. The view component does the same in its
    // scrollIntoView effect.
    render(<TimelineEventCard event={baseEvent} />);
    expect(document.getElementById('tl-snapshot:S-1')).not.toBeNull();
  });

  it('marks focused events with a visible ring class', () => {
    const { container } = render(<TimelineEventCard event={baseEvent} focused />);
    const article = container.querySelector('article');
    expect(article?.className).toContain('ring-cyan');
  });

  it('encodes occurredAt as ISO in the time element', () => {
    const { container } = render(<TimelineEventCard event={baseEvent} />);
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-04-01T08:00:00Z');
  });
});
