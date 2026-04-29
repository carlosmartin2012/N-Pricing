import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CopilotAskPanel from './CopilotAskPanel';
import type { CopilotAskResponse } from '../../types/copilot';

/**
 * Stories for CopilotAskPanel (Ola 7 Bloque C.3-C.4). The Cmd+K Ask
 * tab. Each story uses a custom QueryClient with mocked mutation state
 * to surface the different states (idle / loading / answer / error).
 *
 * Storybook has no easy way to drive the underlying React Query
 * mutation through its full lifecycle, so we present the steady states
 * via a thin wrapper that pre-populates the relevant data.
 */

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const successResponse: CopilotAskResponse = {
  answer:
    'The RAROC of 13.2% is below the 15% target because the capital charge spiked after the LCR shift. Consider raising the margin by 18 bps or shortening the maturity.',
  citations: [
    { label: 'EBA GL 2018/02 §3.4' },
    { label: 'CRR3 Art. 501a' },
  ],
  suggestedActions: [
    { id: 'open-timeline', kind: 'NAVIGATE', label: 'View deal timeline', payload: { path: '/deals/D-001/timeline' } },
    { id: 'open-raroc',    kind: 'NAVIGATE', label: 'Open RAROC Terminal', payload: { path: '/raroc' } },
  ],
  traceId: 'copilot:storybook',
  redactedPii: true,
};

const meta = {
  title: 'UI/CopilotAskPanel',
  component: CopilotAskPanel,
  parameters: { layout: 'centered' },
  decorators: [
    (StoryComponent) => (
      <MemoryRouter initialEntries={['/']}>
        <div style={{
          background: 'var(--nfq-bg-surface)',
          width: 540,
          border: '1px solid var(--nfq-border-ghost)',
          borderRadius: 12,
        }}>
          <StoryComponent />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CopilotAskPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleEnglish: Story = {
  args: {
    context: { dealId: 'D-001', oneLine: 'Deal D-001, RAROC 13.2%' },
    language: 'en',
    onClose: () => undefined,
  },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={buildQueryClient()}>
        <StoryComponent />
      </QueryClientProvider>
    ),
  ],
};

export const IdleSpanish: Story = {
  args: {
    context: { dealId: 'D-001', oneLine: 'Deal D-001, RAROC 13.2%' },
    language: 'es',
    onClose: () => undefined,
  },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={buildQueryClient()}>
        <StoryComponent />
      </QueryClientProvider>
    ),
  ],
};

export const NoContext: Story = {
  args: {
    context: {},
    language: 'en',
    onClose: () => undefined,
  },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={buildQueryClient()}>
        <StoryComponent />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    docs: { description: { story: 'No deal in context — chip reads "general".' } },
  },
};

export const SuccessWithSuggestedActions: Story = {
  args: {
    context: { dealId: 'D-001', oneLine: 'Deal D-001, RAROC 13.2%' },
    language: 'en',
    onClose: () => undefined,
  },
  decorators: [
    (StoryComponent) => {
      const qc = buildQueryClient();
      // Pre-seed the mutation cache by directly setting the result.
      // Storybook visual: we render an inline preview component
      // wrapping the panel that surfaces what success looks like.
      return (
        <QueryClientProvider client={qc}>
          <SuccessShell response={successResponse}>
            <StoryComponent />
          </SuccessShell>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Visual representation of the answer state — citations chips + suggested-action buttons + PII redaction notice.',
      },
    },
  },
};

interface SuccessShellProps {
  response: CopilotAskResponse;
  children: React.ReactNode;
}

const SuccessShell: React.FC<SuccessShellProps> = ({ response, children }) => {
  // Render the panel, then below it preview the success block as it
  // would appear after a real submit. Storybook can't easily drive
  // useMutation through its lifecycle, so we annotate the story.
  return (
    <div>
      {children}
      <div style={{ padding: '0 16px 16px', color: 'var(--nfq-text-muted)', fontSize: 11, fontStyle: 'italic' }}>
        After a real submit, the answer panel below the textarea would show:
      </div>
      <article
        style={{ margin: 16, padding: 12, borderRadius: 6, background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)' }}
      >
        <p style={{ fontSize: 12, color: 'var(--nfq-text-primary)', whiteSpace: 'pre-wrap' }}>
          {response.answer}
        </p>
        <div style={{ marginTop: 12, fontSize: 10, color: '#22d3ee' }}>SOURCES</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {response.citations.map((c) => (
            <span
              key={c.label}
              style={{ padding: '2px 8px', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10, color: '#a5f3fc' }}
            >
              {c.label}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: '#22d3ee' }}>SUGGESTED NEXT STEPS</div>
        {response.suggestedActions.map((a) => (
          <div
            key={a.id}
            style={{ marginTop: 4, padding: '6px 8px', border: '1px solid #475569', borderRadius: 4, fontSize: 11, color: '#e2e8f0' }}
          >
            {a.label} →
          </div>
        ))}
      </article>
    </div>
  );
};
