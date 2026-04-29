import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import LiveCursorOverlay from './LiveCursorOverlay';
import type { RemoteCursor } from '../../utils/cursors/cursorReducer';

/**
 * Stories for LiveCursorOverlay (Ola 7 Bloque B.4b). Pure
 * presentational — accepts a cursors array and renders SVG markers.
 *
 * Stories use absolute viewport coordinates so the cursors land at
 * predictable positions in the Storybook canvas.
 */

const cursor = (overrides: Partial<RemoteCursor> = {}): RemoteCursor => ({
  userId: overrides.userId ?? 'u1',
  name: overrides.name ?? 'User',
  x: overrides.x ?? 100,
  y: overrides.y ?? 100,
  viewport: 'CALCULATOR',
  receivedAt: 1,
  ...overrides,
});

const meta = {
  title: 'UI/LiveCursorOverlay',
  component: LiveCursorOverlay,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (StoryComponent) => (
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: '500px',
          background: 'var(--nfq-bg-root)',
          overflow: 'hidden',
        }}
      >
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof LiveCursorOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { cursors: [] },
  parameters: {
    docs: { description: { story: 'No remote cursors — overlay does not render at all.' } },
  },
};

export const SingleCursor: Story = {
  args: {
    cursors: [cursor({ userId: 'alice', name: 'Alice', x: 200, y: 150 })],
  },
};

export const MultipleCursors: Story = {
  args: {
    cursors: [
      cursor({ userId: 'alice', name: 'Alice', x: 100, y: 80 }),
      cursor({ userId: 'bob', name: 'Bob', x: 320, y: 180 }),
      cursor({ userId: 'carol', name: 'Carol', x: 540, y: 280 }),
      cursor({ userId: 'dave', name: 'Dave', x: 760, y: 380 }),
      cursor({ userId: 'eve', name: 'Eve', x: 980, y: 80 }),
    ],
  },
  parameters: {
    docs: { description: { story: 'Five cursors at different positions — each gets a stable color from the palette.' } },
  },
};

export const CapAtMaxVisible: Story = {
  args: {
    maxVisible: 3,
    cursors: Array.from({ length: 8 }, (_, i) =>
      cursor({ userId: `u${i}`, name: `User ${i}`, x: 100 + i * 100, y: 100 + (i % 2) * 100 }),
    ),
  },
  parameters: {
    docs: { description: { story: 'Eight cursors but maxVisible=3 — only the first three render.' } },
  },
};

export const NoNameFallback: Story = {
  args: {
    cursors: [cursor({ userId: 'guest1', name: null, x: 200, y: 150 })],
  },
  parameters: {
    docs: { description: { story: 'When the cursor has no name → falls back to "guest" label.' } },
  },
};
