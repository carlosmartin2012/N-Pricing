// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LiveCursorOverlay, { __pickCursorColor } from '../LiveCursorOverlay';
import type { RemoteCursor } from '../../../utils/cursors/cursorReducer';

const cursor = (overrides: Partial<RemoteCursor> = {}): RemoteCursor => ({
  userId: overrides.userId ?? 'u1',
  name: overrides.name ?? 'User One',
  x: overrides.x ?? 100,
  y: overrides.y ?? 200,
  viewport: 'CALCULATOR',
  receivedAt: 1,
  ...overrides,
});

describe('LiveCursorOverlay', () => {
  it('renders nothing when cursors array is empty', () => {
    const { container } = render(<LiveCursorOverlay cursors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one marker per cursor with name label and stable testid', () => {
    render(
      <LiveCursorOverlay
        cursors={[cursor({ userId: 'a', name: 'Alice' }), cursor({ userId: 'b', name: 'Bob' })]}
      />,
    );
    expect(screen.getByTestId('cursor-a')).toBeInTheDocument();
    expect(screen.getByTestId('cursor-b')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('positions each cursor via translate3d on its container', () => {
    const { container } = render(<LiveCursorOverlay cursors={[cursor({ userId: 'a', x: 250, y: 90 })]} />);
    const marker = container.querySelector('[data-testid="cursor-a"]') as HTMLElement;
    expect(marker.style.transform).toBe('translate3d(250px, 90px, 0)');
  });

  it('falls back to "guest" when the cursor has no name', () => {
    render(<LiveCursorOverlay cursors={[cursor({ userId: 'a', name: null })]} />);
    expect(screen.getByText('guest')).toBeInTheDocument();
  });

  it('caps the number of rendered cursors at maxVisible', () => {
    const cursors = Array.from({ length: 8 }, (_, i) => cursor({ userId: `u${i}` }));
    render(<LiveCursorOverlay cursors={cursors} maxVisible={3} />);
    expect(screen.queryAllByTestId(/^cursor-u\d$/)).toHaveLength(3);
  });

  it('marks the overlay aria-hidden + pointer-events-none so it never intercepts UI', () => {
    render(<LiveCursorOverlay cursors={[cursor()]} />);
    const overlay = screen.getByTestId('live-cursor-overlay');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('assigns a stable color from the palette per userId', () => {
    expect(__pickCursorColor('alice')).toBe(__pickCursorColor('alice'));
    // Picks land within the curated palette.
    expect(__pickCursorColor('alice')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('different userIds get colors from the palette (not all the same)', () => {
    const userIds = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'henry'];
    const colors = new Set(userIds.map(__pickCursorColor));
    // Pigeonhole: 8 ids on 6-color palette → at least 2 distinct picks
    // realistically a lot more.
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });
});
