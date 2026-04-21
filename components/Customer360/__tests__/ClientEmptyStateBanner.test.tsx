// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientEmptyStateBanner from '../ClientEmptyStateBanner';

/**
 * Unit tests for the reusable empty-state banner. The banner is used in
 * two places (no-positions + no-snapshot cases) so guarding its contract
 * here prevents surprise regressions in either consumer.
 */

describe('ClientEmptyStateBanner', () => {
  it('renders the title and body for no-data variant', () => {
    render(
      <ClientEmptyStateBanner
        variant="no-data"
        title="Foo title"
        body="Foo body"
        actions={[]}
      />,
    );
    expect(screen.getByText('Foo title')).toBeInTheDocument();
    expect(screen.getByText('Foo body')).toBeInTheDocument();
  });

  it('renders the hint line when provided', () => {
    render(
      <ClientEmptyStateBanner
        variant="no-data"
        title="T"
        body="B"
        hint="a hint"
        actions={[]}
      />,
    );
    expect(screen.getByText('a hint')).toBeInTheDocument();
  });

  it('renders primary action as a button and fires onClick', () => {
    const fn = vi.fn();
    render(
      <ClientEmptyStateBanner
        variant="no-snapshot"
        title="T"
        body="B"
        actions={[{ label: 'Go', onClick: fn, variant: 'primary' }]}
      />,
    );
    const btn = screen.getByRole('button', { name: /Go/i });
    fireEvent.click(btn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('renders href action as anchor (without losing onClick)', () => {
    const fn = vi.fn();
    render(
      <ClientEmptyStateBanner
        variant="no-data"
        title="T"
        body="B"
        actions={[{ label: 'Open', onClick: fn, href: '/api/x' }]}
      />,
    );
    const link = screen.getByText('Open').closest('a');
    expect(link).toHaveAttribute('href', '/api/x');
    fireEvent.click(link!);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('disables the button while pending and suppresses clicks', () => {
    const fn = vi.fn();
    render(
      <ClientEmptyStateBanner
        variant="no-snapshot"
        title="T"
        body="B"
        actions={[{ label: 'Go', onClick: fn, disabled: true }]}
      />,
    );
    const btn = screen.getByRole('button', { name: /Go/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('shows errorMessage when set', () => {
    render(
      <ClientEmptyStateBanner
        variant="no-snapshot"
        title="T"
        body="B"
        errorMessage="oops"
        actions={[]}
      />,
    );
    expect(screen.getByText('oops')).toBeInTheDocument();
  });

  it('applies a data-testid derived from variant by default', () => {
    const { container } = render(
      <ClientEmptyStateBanner variant="no-snapshot" title="T" body="B" actions={[]} />,
    );
    expect(container.querySelector('[data-testid="client-empty-state-no-snapshot"]')).toBeTruthy();
  });
});
