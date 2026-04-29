import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import TimelineDeprecationBanner from './TimelineDeprecationBanner';

/**
 * Stories for TimelineDeprecationBanner (Ola 7 Bloque A.7). The
 * informational banner that surfaces inside EscalationsView and
 * DossiersView during the 30-day deprecation window.
 *
 * Two stories — one per surface — to validate the copy renders
 * correctly.
 */

const meta = {
  title: 'Deals/TimelineDeprecationBanner',
  component: TimelineDeprecationBanner,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <div style={{ background: 'var(--nfq-bg-root)', padding: 24, maxWidth: 720 }}>
        <StoryComponent />
      </div>
    ),
  ],
} satisfies Meta<typeof TimelineDeprecationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EscalationsSurface: Story = {
  args: { surface: 'escalations' },
};

export const DossiersSurface: Story = {
  args: { surface: 'dossiers' },
};
