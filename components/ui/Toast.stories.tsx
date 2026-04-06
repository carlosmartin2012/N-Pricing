import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { ToastProvider, useToast } from './Toast';

/**
 * Toast notification system for FTP pricing operations.
 * Uses a provider pattern — stories wrap content in `ToastProvider`
 * and trigger toasts via the `useToast` hook.
 */

/* ── Helper that fires a toast on mount ── */
const ToastTrigger: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}> = ({ type, message, duration }) => {
  const { addToast } = useToast();

  useEffect(() => {
    addToast(type, message, duration);
  }, [addToast, type, message, duration]);

  return null;
};

/* ── Wrapper that provides context + dark background ── */
const ToastStory: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}> = (props) => (
  <ToastProvider>
    <div style={{ minHeight: 120, padding: 24 }}>
      <ToastTrigger {...props} />
    </div>
  </ToastProvider>
);

const meta = {
  title: 'UI/Toast',
  component: ToastStory,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'warning', 'info'],
    },
    duration: {
      control: { type: 'number', min: 0, step: 1000 },
    },
  },
} satisfies Meta<typeof ToastStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    type: 'success',
    message: 'FTP rate calculated successfully: 3.45% for deal DEAL-2024-001',
    duration: 60000,
  },
};

export const Error: Story = {
  args: {
    type: 'error',
    message: 'Pricing engine error: missing yield curve for EUR 5Y tenor',
    duration: 60000,
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    message: 'LCR charge exceeds threshold (125 bps) — review liquidity premium',
    duration: 60000,
  },
};

export const Info: Story = {
  args: {
    type: 'info',
    message: 'Market data updated: ECB base rate changed to 3.75% (effective 2024-06-12)',
    duration: 60000,
  },
};

export const AllVariants: StoryObj = {
  render: () => (
    <ToastProvider>
      <div style={{ minHeight: 300, padding: 24 }}>
        <ToastTrigger type="success" message="Deal DEAL-2024-042 booked to ledger" duration={120000} />
        <ToastTrigger type="error" message="RAROC below hurdle rate: 8.2% < 12.0%" duration={120000} />
        <ToastTrigger type="warning" message="NSFR ratio at 102% — approaching regulatory minimum" duration={120000} />
        <ToastTrigger type="info" message="Batch pricing completed: 147 deals processed in 2.3s" duration={120000} />
      </div>
    </ToastProvider>
  ),
};
