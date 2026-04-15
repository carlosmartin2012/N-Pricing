// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SignedDossier } from '../../../types/governance';

vi.mock('../../../api/governance');

import * as governanceApi from '../../../api/governance';

function buildDossier(overrides: Partial<SignedDossier> = {}): SignedDossier {
  return {
    id: 'dos-abcdef0123456789',
    entityId: '00000000-0000-0000-0000-000000000010',
    dealId: 'deal-0001xyz',
    pricingSnapshotId: 'snap-9999',
    dossierPayload: { decision: 'approved', notes: 'committee unanimous' },
    payloadHash: 'aa11bb22cc33dd44ee55ff66',
    signatureHex: '00112233445566778899aabbccddeeff',
    signedByEmail: 'chair@bank.es',
    signedAt: '2026-04-10T10:00:00Z',
    ...overrides,
  };
}

let DossiersView: React.ComponentType;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(governanceApi.listDossiers).mockReset();
  vi.mocked(governanceApi.verifyDossier).mockReset();
  DossiersView = (await import('../DossiersView')).default;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DossiersView', () => {
  it('shows the empty state when no dossiers have been signed', async () => {
    vi.mocked(governanceApi.listDossiers).mockResolvedValue([]);

    render(<DossiersView />);

    expect(await screen.findByText('No dossiers signed yet')).toBeInTheDocument();
  });

  it('renders dossier rows with signer and verify affordance', async () => {
    vi.mocked(governanceApi.listDossiers).mockResolvedValue([buildDossier()]);

    render(<DossiersView />);

    await waitFor(() => {
      expect(screen.getByText('chair@bank.es')).toBeInTheDocument();
    });
    // Both the header's "Verify all" and the row-level "verify" render —
    // assert at least one verify affordance is present.
    expect(screen.getAllByRole('button', { name: /verify/i }).length).toBeGreaterThan(0);
  });

  it('surfaces "signature OK" after a successful verification', async () => {
    const d = buildDossier();
    vi.mocked(governanceApi.listDossiers).mockResolvedValue([d]);
    vi.mocked(governanceApi.verifyDossier).mockResolvedValue({
      dossier: d,
      verification: {
        payloadHashMatches: true,
        signatureMatches: true,
        verifiedAt: '2026-04-15T10:00:00Z',
      },
    });

    render(<DossiersView />);
    await screen.findByText('chair@bank.es');

    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(screen.getByText('signature OK')).toBeInTheDocument();
    });
  });

  it('flags a tampered signature with the warning chip', async () => {
    const d = buildDossier();
    vi.mocked(governanceApi.listDossiers).mockResolvedValue([d]);
    vi.mocked(governanceApi.verifyDossier).mockResolvedValue({
      dossier: d,
      verification: {
        payloadHashMatches: true,
        signatureMatches: false,
        verifiedAt: '2026-04-15T10:00:00Z',
      },
    });

    render(<DossiersView />);
    await screen.findByText('chair@bank.es');

    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(screen.getByText('tampered')).toBeInTheDocument();
    });
  });
});
