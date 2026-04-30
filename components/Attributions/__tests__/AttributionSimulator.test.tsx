// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttributionSimulator from '../AttributionSimulator';
import type { AttributionMatrix, AttributionQuote } from '../../../types/attributions';

const mockUseUI = vi.fn<() => { language: 'en' | 'es' }>(() => ({ language: 'en' }));
vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => mockUseUI(),
}));

const ENTITY = '00000000-0000-0000-0000-000000000099';

function buildMatrix(): AttributionMatrix {
  const baseLevel = {
    entityId:   ENTITY,
    metadata:   {},
    active:     true,
    createdAt:  '2026-04-01T08:00:00Z',
    updatedAt:  '2026-04-01T08:00:00Z',
    parentId:   null as string | null,
  };
  const office    = { ...baseLevel, id: 'office',    name: 'Oficina',     levelOrder: 1, rbacRole: 'BranchManager' };
  const zone      = { ...baseLevel, id: 'zone',      name: 'Zona',        levelOrder: 2, rbacRole: 'ZoneManager',     parentId: 'office' };
  const committee = { ...baseLevel, id: 'committee', name: 'Comité',      levelOrder: 3, rbacRole: 'Committee',        parentId: 'zone' };

  const baseThr = {
    entityId:    ENTITY,
    scope:       {},
    activeFrom:  '2026-01-01',
    activeTo:    null as string | null,
    isActive:    true,
    createdAt:   '2026-04-01T08:00:00Z',
    updatedAt:   '2026-04-01T08:00:00Z',
  };
  return {
    entityId: ENTITY,
    levels:   [office, zone, committee],
    thresholds: [
      { ...baseThr, id: 't-of', levelId: 'office',    deviationBpsMax: 5,  rarocPpMin: 14, volumeEurMax: 100_000 },
      { ...baseThr, id: 't-zn', levelId: 'zone',      deviationBpsMax: 15, rarocPpMin: 12, volumeEurMax: 500_000 },
      { ...baseThr, id: 't-co', levelId: 'committee', deviationBpsMax: 50, rarocPpMin: 8,  volumeEurMax: 10_000_000 },
    ],
    loadedAt: '2026-04-30T10:00:00Z',
  };
}

function makeQuote(overrides: Partial<AttributionQuote> = {}): AttributionQuote {
  return {
    finalClientRateBps: 490,
    standardRateBps:    492,
    hardFloorRateBps:   400,
    rarocPp:            14.5,
    volumeEur:          80_000,
    scope:              { product: ['loan'], segment: ['SME'], currency: ['EUR'], tenorMaxMonths: 24 },
    ...overrides,
  };
}

function renderWith(language: 'en' | 'es', props: Partial<React.ComponentProps<typeof AttributionSimulator>> = {}) {
  mockUseUI.mockReturnValue({ language });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AttributionSimulator quote={makeQuote()} matrix={buildMatrix()} {...props} />
    </QueryClientProvider>,
  );
}

describe('AttributionSimulator', () => {
  it('renderiza el título en EN cuando language=en', () => {
    renderWith('en');
    expect(screen.getByText('Attribution simulator')).toBeInTheDocument();
  });

  it('renderiza el título en ES cuando language=es', () => {
    renderWith('es');
    expect(screen.getByText('Simulador de atribución')).toBeInTheDocument();
  });

  it('muestra el nivel mínimo requerido para el quote feliz (Oficina)', () => {
    renderWith('en');
    // "Oficina" aparece tanto en el heading del nivel requerido como en la
    // cadena de aprobación; basta con que esté presente al menos una vez.
    expect(screen.getAllByText('Oficina').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Within threshold/i)).toBeInTheDocument();
  });

  it('quote bajo hard floor muestra warning + chip "Below hard floor"', () => {
    renderWith('en', {
      quote: makeQuote({ finalClientRateBps: 350 }),
    });
    expect(screen.getByText('Below regulatory floor — UI will block approve')).toBeInTheDocument();
    expect(screen.getByText('Below hard floor')).toBeInTheDocument();
  });

  it('botón "Request approval" se deshabilita si belowHardFloor', () => {
    renderWith('en', {
      quote: makeQuote({ finalClientRateBps: 350 }),
      onRequestApproval: vi.fn(),
    });
    const btn = screen.getByRole('button', { name: 'Request approval' });
    expect(btn).toBeDisabled();
  });

  it('matriz vacía muestra el banner matrixEmpty', () => {
    mockUseUI.mockReturnValue({ language: 'en' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const emptyMatrix: AttributionMatrix = {
      entityId: ENTITY, levels: [], thresholds: [], loadedAt: '2026-04-30T10:00:00Z',
    };
    render(
      <QueryClientProvider client={qc}>
        <AttributionSimulator quote={makeQuote()} matrix={emptyMatrix} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/No attribution levels configured/i)).toBeInTheDocument();
  });

  it('mover el slider de deviation actualiza el precio ajustado', () => {
    renderWith('en');
    // Slider de deviationDelta es el primer range del documento.
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '-10' } });
    // El precio adjusted debería bajar 10 bps respecto al baseline.
    // Baseline: 490 bps → 4.90 % ; Adjusted: 480 bps → 4.80 %
    expect(screen.getByText('4,80%')).toBeInTheDocument();
  });

  it('ejecuta onApply cuando el usuario clica "Apply to deal"', () => {
    const onApply = vi.fn();
    renderWith('en', { onApply });
    const btn = screen.getByRole('button', { name: 'Apply to deal' });
    fireEvent.click(btn);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      quote: expect.objectContaining({ finalClientRateBps: expect.any(Number) }),
      proposedAdjustments: expect.any(Object),
    }));
  });
});
