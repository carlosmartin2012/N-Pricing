// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CopilotAskResponse } from '../../../types/copilot';

const apiMock = vi.hoisted(() => ({
  askCopilot: vi.fn(),
}));
vi.mock('../../../api/copilot', () => apiMock);

import CopilotAskPanel from '../CopilotAskPanel';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

const goodResponse: CopilotAskResponse = {
  answer: 'Lower margin reduces RAROC by ~0.3 pp.',
  citations: [{ label: 'EBA GL 2018/02 §3.4' }],
  suggestedActions: [],
  traceId: 't-1',
  redactedPii: true,
};

describe('CopilotAskPanel', () => {
  beforeEach(() => {
    apiMock.askCopilot.mockReset();
  });

  it('renders the context chip with "general" when context.oneLine is missing', () => {
    const { Wrapper } = wrap();
    render(
      <CopilotAskPanel context={{}} language="en" onClose={vi.fn()} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('general')).toBeInTheDocument();
  });

  it('renders the context chip with the provided oneLine summary', () => {
    const { Wrapper } = wrap();
    render(
      <CopilotAskPanel
        context={{ oneLine: 'Deal D-1, RAROC 13%', dealId: 'D-1' }}
        language="en"
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Deal D-1, RAROC 13%')).toBeInTheDocument();
  });

  it('disables the submit button when the question is too short', () => {
    const { Wrapper } = wrap();
    render(<CopilotAskPanel context={{}} language="en" onClose={vi.fn()} />, { wrapper: Wrapper });

    const submit = screen.getByTestId('copilot-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Copilot question'), { target: { value: 'hi' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Copilot question'), { target: { value: 'why?' } });
    expect(submit.disabled).toBe(false);
  });

  it('submits the question and renders the answer + citations', async () => {
    apiMock.askCopilot.mockResolvedValue(goodResponse);
    const { Wrapper } = wrap();
    render(
      <CopilotAskPanel
        context={{ oneLine: 'Deal D-1', dealId: 'D-1' }}
        language="en"
        onClose={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.change(screen.getByLabelText('Copilot question'), {
      target: { value: 'Why is RAROC low?' },
    });
    fireEvent.click(screen.getByTestId('copilot-submit'));

    await waitFor(() => screen.getByTestId('copilot-answer'));
    expect(screen.getByText(/Lower margin reduces RAROC/)).toBeInTheDocument();
    expect(screen.getByText('EBA GL 2018/02 §3.4')).toBeInTheDocument();
    // PII redaction notice surfaces
    expect(screen.getByText(/Client name and id were redacted/i)).toBeInTheDocument();
  });

  it('shows the rate-limit copy when the API returns 429', async () => {
    apiMock.askCopilot.mockRejectedValue(new Error('API POST /copilot/ask failed (429): rate'));
    const { Wrapper } = wrap();
    render(<CopilotAskPanel context={{}} language="en" onClose={vi.fn()} />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('Copilot question'), {
      target: { value: 'why so slow' },
    });
    fireEvent.click(screen.getByTestId('copilot-submit'));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toMatch(/asking too fast/i);
  });

  it('shows the service-unavailable copy when the API returns 503', async () => {
    apiMock.askCopilot.mockRejectedValue(new Error('API POST /copilot/ask failed (503): no key'));
    const { Wrapper } = wrap();
    render(<CopilotAskPanel context={{}} language="en" onClose={vi.fn()} />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('Copilot question'), {
      target: { value: 'help me' },
    });
    fireEvent.click(screen.getByTestId('copilot-submit'));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toMatch(/not available/i);
  });

  it('uses Spanish copy when language="es"', () => {
    const { Wrapper } = wrap();
    render(<CopilotAskPanel context={{}} language="es" onClose={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText(/Pregunta lo que quieras/)).toBeInTheDocument();
    // Submit button uses the localized aria-label.
    expect(screen.getByRole('button', { name: 'Preguntar' })).toBeInTheDocument();
  });

  it('submits via Cmd/Ctrl+Enter shortcut from the textarea', async () => {
    apiMock.askCopilot.mockResolvedValue(goodResponse);
    const { Wrapper } = wrap();
    render(<CopilotAskPanel context={{}} language="en" onClose={vi.fn()} />, { wrapper: Wrapper });

    const textarea = screen.getByLabelText('Copilot question');
    fireEvent.change(textarea, { target: { value: 'Why?' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    await waitFor(() => expect(apiMock.askCopilot).toHaveBeenCalled());
  });
});
