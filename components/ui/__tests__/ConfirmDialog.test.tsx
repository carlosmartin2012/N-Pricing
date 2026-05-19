// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { translations } from '../../../translations';
import { ConfirmDialog } from '../ConfirmDialog';
import { ConfirmProvider, useConfirm } from '../../../contexts/ConfirmContext';

vi.mock('../../../contexts/UIContext', () => ({
  useUI: () => ({ t: translations.en }),
}));

describe('ConfirmDialog', () => {
  it('renders title, message and action buttons when open', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Delete entry"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete entry')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="x"
        message="y"
        confirmLabel="ok"
        cancelLabel="no"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('invokes onConfirm and onCancel handlers', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        title="x"
        message="y"
        confirmLabel="ok"
        cancelLabel="no"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /no/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('useConfirm', () => {
  it('resolves true on confirm and false on cancel', async () => {
    const events: string[] = [];

    const Probe: React.FC = () => {
      const confirm = useConfirm();
      return (
        <>
          <button
            onClick={async () => {
              const ok = await confirm({ message: 'go?' });
              events.push(ok ? 'yes' : 'no');
            }}
          >
            ask
          </button>
        </>
      );
    };

    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('ask'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    });
    expect(events).toEqual(['yes']);

    await act(async () => {
      fireEvent.click(screen.getByText('ask'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    });
    expect(events).toEqual(['yes', 'no']);
  });
});
