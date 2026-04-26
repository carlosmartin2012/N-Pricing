import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileSignature,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Inbox,
  ChevronDown,
  ChevronUp,
  Fingerprint,
} from 'lucide-react';
import * as governanceApi from '../../api/governance';
import type {
  SignedDossier,
  DossierSignatureVerification,
} from '../../types/governance';
import { createLogger } from '../../utils/logger';
import { useWalkthroughOptional } from '../../contexts/WalkthroughContext';

const log = createLogger('DossiersView');

/**
 * Signed Committee Dossiers — Phase 3 surface paired with the Model
 * Inventory view. Each dossier is an immutable record of a committee
 * decision (typically a deal approval), signed HMAC-SHA256 over its
 * canonical JSON payload. This view lists dossiers for the current
 * entity, lets the MRM officer expand a row to inspect the payload, and
 * runs the server-side verification on demand to confirm the signature
 * matches (tamper check).
 *
 * The dossier endpoints shipped with Phase 3 as write-only (POST sign,
 * POST verify). GET list + GET single were added alongside this view so
 * the UI does not have to reconstruct the catalogue from individual IDs.
 */

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function shortHash(hash: string, len = 10): string {
  if (!hash) return '—';
  return hash.length > len + 2 ? `${hash.slice(0, len)}…` : hash;
}

interface RowProps {
  dossier: SignedDossier;
  verification: DossierSignatureVerification | null;
  expanded: boolean;
  onToggle: () => void;
  onVerify: () => void;
  verifying: boolean;
}

const DossierRow: React.FC<RowProps> = ({
  dossier,
  verification,
  expanded,
  onToggle,
  onVerify,
  verifying,
}) => {
  const valid = verification?.payloadHashMatches && verification?.signatureMatches;
  const invalid = verification && !valid;

  return (
    <>
      <tr className="border-t border-[color:var(--nfq-border-subtle)]">
        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
          {shortHash(dossier.id, 8)}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
          {dossier.dealId ? shortHash(dossier.dealId, 8) : '—'}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
          {dossier.pricingSnapshotId ? shortHash(dossier.pricingSnapshotId, 8) : '—'}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">
          {dossier.signedByEmail}
        </td>
        <td className="px-3 py-2 font-mono text-xs">{fmtDateTime(dossier.signedAt)}</td>
        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-muted)]">
          {shortHash(dossier.payloadHash, 12)}
        </td>
        <td className="px-3 py-2">
          {verification == null && (
            <button
              onClick={onVerify}
              disabled={verifying}
              className="inline-flex items-center gap-1 rounded-md border border-[color:var(--nfq-border-subtle)] px-2 py-1 text-[11px] text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-60"
            >
              <Fingerprint size={11} /> {verifying ? 'verifying…' : 'verify'}
            </button>
          )}
          {valid && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              <ShieldCheck size={11} /> signature OK
            </span>
          )}
          {invalid && (
            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
              <ShieldAlert size={11} /> tampered
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            onClick={onToggle}
            className="rounded-md border border-[color:var(--nfq-border-subtle)] px-2 py-1 text-[10px] text-[color:var(--nfq-text-secondary)] hover:bg-[rgba(255,255,255,0.04)]"
            title={expanded ? 'Hide payload' : 'Show payload'}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-[color:var(--nfq-border-subtle)]">
          <td colSpan={8} className="bg-[rgba(255,255,255,0.015)] px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                  Payload hash
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-[color:var(--nfq-text-secondary)]">
                  {dossier.payloadHash}
                </div>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                  Signature
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-[color:var(--nfq-text-secondary)]">
                  {dossier.signatureHex}
                </div>
                {verification && (
                  <div className="mt-3 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={verification.payloadHashMatches ? 'text-emerald-300' : 'text-rose-300'}>
                        {verification.payloadHashMatches ? '✓' : '✗'}
                      </span>
                      <span className="text-[color:var(--nfq-text-secondary)]">payload hash matches</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={verification.signatureMatches ? 'text-emerald-300' : 'text-rose-300'}>
                        {verification.signatureMatches ? '✓' : '✗'}
                      </span>
                      <span className="text-[color:var(--nfq-text-secondary)]">HMAC signature matches</span>
                    </div>
                    <div className="text-[color:var(--nfq-text-muted)]">
                      verified at {fmtDateTime(verification.verifiedAt)}
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                  Payload (canonical JSON)
                </div>
                <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-[color:var(--nfq-bg-elevated)] p-3 font-mono text-[11px] leading-5 text-[color:var(--nfq-text-secondary)]">
                  {JSON.stringify(dossier.dossierPayload, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const DossiersView: React.FC = () => {
  const [list, setList] = useState<SignedDossier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Record<string, DossierSignatureVerification>>({});
  const [verifying, setVerifying] = useState<Set<string>>(new Set());

  const walkthrough = useWalkthroughOptional();
  const isTourActive = walkthrough?.isActive ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await governanceApi.listDossiers());
    } catch (e) {
      log.warn('load failed', { err: String(e) });
      setError(e instanceof Error ? e.message : String(e));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleVerify = async (id: string) => {
    setVerifying((prev) => new Set(prev).add(id));
    try {
      const { verification } = await governanceApi.verifyDossier(id);
      setVerifications((prev) => ({ ...prev, [id]: verification }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleVerifyAll = async () => {
    await Promise.all(list.map((d) => handleVerify(d.id)));
  };

  const counts = useMemo(() => {
    let verified = 0;
    let tampered = 0;
    for (const d of list) {
      const v = verifications[d.id];
      if (!v) continue;
      if (v.payloadHashMatches && v.signatureMatches) verified += 1;
      else tampered += 1;
    }
    return { total: list.length, verified, tampered };
  }, [list, verifications]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[color:var(--nfq-text-primary)]">
            <FileSignature size={22} className="text-[color:var(--nfq-accent)]" />
            Signed Dossiers
          </h1>
          <p className="mt-1 text-sm text-[color:var(--nfq-text-secondary)]">
            Committee decisions signed HMAC-SHA256 over canonical JSON · append-only · tamper-evident for supervisor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleVerifyAll()}
            disabled={list.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[color:var(--nfq-border-subtle)] bg-transparent px-3 py-2 text-sm text-[color:var(--nfq-text-secondary)] transition hover:bg-[rgba(255,255,255,0.03)] disabled:opacity-50"
          >
            <Fingerprint size={14} /> Verify all
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--nfq-accent)] px-3 py-2 text-sm font-medium text-black"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
        </div>
      </header>

      {error && !isTourActive && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">Dossiers</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[color:var(--nfq-text-primary)]">{counts.total}</div>
        </div>
        <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">Verified OK</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-300">{counts.verified}</div>
        </div>
        <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-subtle)] bg-[color:var(--nfq-bg-surface)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">Tampered</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-rose-300">{counts.tampered}</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-subtle)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgba(255,255,255,0.02)]">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
              <th className="px-3 py-2">Dossier</th>
              <th className="px-3 py-2">Deal</th>
              <th className="px-3 py-2">Snapshot</th>
              <th className="px-3 py-2">Signed by</th>
              <th className="px-3 py-2">Signed at</th>
              <th className="px-3 py-2">Payload hash</th>
              <th className="px-3 py-2">Signature</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-12">
                  <div className="mx-auto flex max-w-md flex-col items-center text-center">
                    <div className="mb-3 flex h-11 w-14 items-center justify-center rounded-[var(--nfq-radius-card)] bg-[rgba(var(--nfq-accent-rgb),0.1)] text-[color:var(--nfq-accent)]">
                      <Inbox size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                      No dossiers signed yet
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--nfq-text-secondary)]">
                      Dossiers are produced when a committee approves a deal or methodology
                      change. Each one is an immutable HMAC-signed record of what was decided,
                      by whom, and against which pricing snapshot — the tamper-evident audit
                      trail the supervisor can sample later.
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {list.map((d) => (
              <DossierRow
                key={d.id}
                dossier={d}
                verification={verifications[d.id] ?? null}
                expanded={expandedId === d.id}
                onToggle={() => setExpandedId((cur) => (cur === d.id ? null : d.id))}
                onVerify={() => void handleVerify(d.id)}
                verifying={verifying.has(d.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DossiersView;
