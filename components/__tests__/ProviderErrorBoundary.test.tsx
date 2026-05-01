// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProviderErrorBoundary } from '../ProviderErrorBoundary';
import { errorTracker } from '../../utils/errorTracking';

function Crashy({ shouldCrash }: { shouldCrash: boolean }): React.ReactElement {
  if (shouldCrash) {
    throw new Error('init failed');
  }
  return <div data-testid="ok">rendered ok</div>;
}

describe('ProviderErrorBoundary', () => {
  let captureSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    captureSpy = vi.spyOn(errorTracker, 'captureException').mockImplementation(() => {});
    // React 19 imprime el error capturado en consola incluso cuando una
    // ErrorBoundary lo absorbe — silenciamos para no ensuciar el output.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    captureSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ProviderErrorBoundary name="Auth">
        <Crashy shouldCrash={false} />
      </ProviderErrorBoundary>,
    );
    expect(screen.getByTestId('ok')).toBeTruthy();
  });

  it('captures the error con módulo namespaced y muestra panel con el nombre', () => {
    render(
      <ProviderErrorBoundary name="Market Data">
        <Crashy shouldCrash={true} />
      </ProviderErrorBoundary>,
    );
    // Panel por defecto incluye el nombre del subsystem.
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Market Data subsystem failed/i)).toBeTruthy();
    // errorTracker recibe módulo namespaced para identificar la capa.
    expect(captureSpy).toHaveBeenCalledTimes(1);
    const [err, ctx] = captureSpy.mock.calls[0];
    expect((err as Error).message).toBe('init failed');
    expect((ctx as { module: string }).module).toBe('ProviderErrorBoundary:Market Data');
  });

  it('retry re-monta los hijos sin recarga', () => {
    // Harness con estado para simular: el upstream issue se arregla, y luego
    // el usuario hace clic en Retry. El boundary mantiene su error state
    // hasta el retry — un re-render del children solo no lo recupera.
    function Harness(): React.ReactElement {
      const [shouldCrash, setShouldCrash] = React.useState(true);
      return (
        <div>
          <button data-testid="fix-upstream" onClick={() => setShouldCrash(false)}>
            fix
          </button>
          <ProviderErrorBoundary name="Auth">
            <Crashy shouldCrash={shouldCrash} />
          </ProviderErrorBoundary>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByRole('alert')).toBeTruthy();

    // El upstream issue se arregla (p.ej. JWT regenerado tras refresh):
    fireEvent.click(screen.getByTestId('fix-upstream'));
    // Boundary sigue mostrando panel — error state persiste por diseño.
    expect(screen.getByRole('alert')).toBeTruthy();

    // Retry limpia error state y re-monta children. Crashy ya no lanza.
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByTestId('ok')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('usa el fallback custom si se provee', () => {
    render(
      <ProviderErrorBoundary
        name="UI"
        fallback={(error, retry) => (
          <div data-testid="custom-fallback">
            <span>{error.message}</span>
            <button onClick={retry}>custom-retry</button>
          </div>
        )}
      >
        <Crashy shouldCrash={true} />
      </ProviderErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.getByText('init failed')).toBeTruthy();
    // El panel por defecto no se renderiza cuando hay fallback custom.
    expect(screen.queryByText(/UI subsystem failed/i)).toBeNull();
  });
});
