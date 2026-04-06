import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Error boundary that catches runtime errors in child components.
 * Displays a branded error state with retry capability.
 * Used as a safety net around financial calculation views.
 */

/* ── Component that throws on demand ── */
const BombComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('PricingEngine: division by zero — notional amount is 0 for deal DEAL-2024-099');
  }
  return (
    <div style={{ padding: 24, color: 'var(--nfq-text-primary)' }}>
      <p style={{ fontFamily: 'var(--nfq-font-sans)' }}>Component rendered successfully.</p>
    </div>
  );
};

/* ── Wrapper that renders ErrorBoundary in its error state ── */
const ErrorBoundaryInErrorState: React.FC<{ fallbackMessage?: string; errorMessage: string }> = ({
  fallbackMessage,
  errorMessage,
}) => {
  // We force the error state by rendering a component that always throws
  const AlwaysThrows: React.FC = () => {
    throw new Error(errorMessage);
  };

  return (
    <div style={{ height: 300 }}>
      <ErrorBoundary fallbackMessage={fallbackMessage}>
        <AlwaysThrows />
      </ErrorBoundary>
    </div>
  );
};

/* ── Interactive wrapper with trigger button ── */
const InteractiveErrorBoundary: React.FC<{ fallbackMessage?: string }> = ({ fallbackMessage }) => {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [key, setKey] = useState(0);

  return (
    <div style={{ height: 300 }}>
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => {
            setShouldThrow(true);
            setKey((k) => k + 1);
          }}
          style={{
            padding: '8px 16px',
            background: 'var(--nfq-danger)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--nfq-font-sans)',
          }}
        >
          Trigger Error
        </button>
      </div>
      <ErrorBoundary key={key} fallbackMessage={fallbackMessage}>
        <BombComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
};

const meta: Meta = {
  title: 'UI/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'padded',
  },
};

export default meta;

export const DefaultError: StoryObj = {
  render: () => (
    <ErrorBoundaryInErrorState
      errorMessage="PricingEngine: division by zero — notional amount is 0 for deal DEAL-2024-099"
    />
  ),
};

export const CustomFallbackMessage: StoryObj = {
  render: () => (
    <ErrorBoundaryInErrorState
      fallbackMessage="RAROC calculation failed"
      errorMessage="Cannot compute capital charge: RWA is undefined for transaction DEAL-2024-055"
    />
  ),
};

export const CurveError: StoryObj = {
  render: () => (
    <ErrorBoundaryInErrorState
      fallbackMessage="Market data error"
      errorMessage="Yield curve 'EUR_SWAP_3M' not found for valuation date 2024-06-12"
    />
  ),
};

export const Interactive: StoryObj = {
  render: () => <InteractiveErrorBoundary fallbackMessage="Pricing module crashed" />,
};
