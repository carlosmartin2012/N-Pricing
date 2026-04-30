// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttributionMatrixView, { scopeSummary } from '../AttributionMatrixView';

const mockUseUI = vi.fn<() => { language: 'en' | 'es' }>(() => ({ language: 'en' }));
vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => mockUseUI(),
}));

vi.mock('../../../api/attributions', () => ({
  getMatrix: vi.fn(async () => null),
  createLevel:     vi.fn(),
  updateLevel:     vi.fn(),
  createThreshold: vi.fn(),
  updateThreshold: vi.fn(),
  recordDecision:  vi.fn(),
  listDecisions:   vi.fn(async () => ({ items: [], pagination: { limit: 100, offset: 0, returned: 0 } })),
  routeQuote:      vi.fn(),
  simulateQuote:   vi.fn(),
}));

import * as api from '../../../api/attributions';

function renderWith(language: 'en' | 'es' = 'en') {
  mockUseUI.mockReturnValue({ language });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AttributionMatrixView />
    </QueryClientProvider>,
  );
}

describe('AttributionMatrixView', () => {
  beforeEach(() => {
    vi.mocked(api.getMatrix).mockReset();
  });

  it('muestra banner matrixEmpty cuando la matriz no tiene niveles', async () => {
    vi.mocked(api.getMatrix).mockResolvedValueOnce({
      entityId: 'E1', levels: [], thresholds: [], loadedAt: '2026-04-30T10:00:00Z',
    });
    renderWith('en');
    expect(await screen.findByText(/No attribution levels configured/i)).toBeInTheDocument();
  });

  it('lista los niveles cuando la matriz se carga', async () => {
    vi.mocked(api.getMatrix).mockResolvedValueOnce({
      entityId: 'E1',
      levels: [
        { id: 'l1', entityId: 'E1', name: 'Oficina', parentId: null, levelOrder: 1, rbacRole: 'BranchManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
        { id: 'l2', entityId: 'E1', name: 'Zona',    parentId: 'l1', levelOrder: 2, rbacRole: 'ZoneManager',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
      ],
      thresholds: [],
      loadedAt: '2026-04-30T10:00:00Z',
    });
    renderWith('en');
    // Espera a que Zona render (la query se resuelve después del initial render);
    // "Oficina" aparece en el heading y en el parent ref de Zona — usa getAllBy.
    expect(await screen.findByText('Zona')).toBeInTheDocument();
    expect(screen.getAllByText('Oficina').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getByText('L2')).toBeInTheDocument();
  });

  it('muestra título ES cuando language=es', async () => {
    vi.mocked(api.getMatrix).mockResolvedValueOnce(null);
    renderWith('es');
    expect(await screen.findByText('Matriz de atribuciones')).toBeInTheDocument();
  });
});

describe('scopeSummary helper', () => {
  it('devuelve "* (any)" para scope vacío', () => {
    expect(scopeSummary({})).toBe('* (any)');
  });

  it('formatea criterios product/segment/tenor', () => {
    expect(
      scopeSummary({ product: ['loan', 'mortgage'], segment: ['SME'], tenorMaxMonths: 24 }),
    ).toBe('product: loan|mortgage; segment: SME; tenor ≤ 24m');
  });
});
