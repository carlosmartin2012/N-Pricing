// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LtvProjectionCard from '../LtvProjectionCard';

/**
 * Integration smoke test for LtvProjectionCard.
 *
 * Validates that the card wires up the language context + translations
 * namespace + React Query hook correctly:
 *   - renders without crashing under a QueryClientProvider
 *   - shows the EN title when language='en'
 *   - shows the ES title when language='es'
 *
 * Mocks the api layer so we don't hit the real server, and useUI so we
 * don't have to wrap in the full UIProvider chain.
 */

vi.mock('../../../api/clv', () => ({
  listClientLtvSnapshots: vi.fn(async () => []),
  recomputeClientLtv: vi.fn(async () => null),
}));

const mockUseUI = vi.fn<() => { language: 'en' | 'es' }>(() => ({ language: 'en' }));
vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => mockUseUI(),
}));

function renderWith(language: 'en' | 'es' = 'en') {
  mockUseUI.mockReturnValue({ language });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LtvProjectionCard clientId="demo-1" />
    </QueryClientProvider>,
  );
}

describe('LtvProjectionCard i18n + QueryClient integration', () => {
  it('renders without crashing when empty history', async () => {
    const { container } = renderWith('en');
    expect(container.firstChild).toBeTruthy();
  });

  it('shows the EN title when language=en', async () => {
    renderWith('en');
    expect(await screen.findByText(/Customer Lifetime Value/i)).toBeInTheDocument();
  });

  it('shows the ES title when language=es', async () => {
    renderWith('es');
    expect(await screen.findByText(/Valor Vida del Cliente/i)).toBeInTheDocument();
  });

  it('renders the Compute CTA when no snapshot exists (EN)', async () => {
    renderWith('en');
    expect(await screen.findByRole('button', { name: /Compute CLV/i })).toBeInTheDocument();
  });

  it('renders the Calcular CTA when no snapshot exists (ES)', async () => {
    renderWith('es');
    expect(await screen.findByRole('button', { name: /Calcular CLV/i })).toBeInTheDocument();
  });
});
