import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { User2, Briefcase, Target, RefreshCw, Activity } from 'lucide-react';
import * as customer360 from '../../api/customer360';
import { useInitializeClv } from '../../hooks/queries/useClvQueries';
import { useUI } from '../../contexts/UIContext';
import { clvTranslations } from '../../translations/index';
import ClientEmptyStateBanner, { ImportIcon, InitializeIcon } from './ClientEmptyStateBanner';

interface Props {
  clientId: string;
  asOfDate?: string;
}

const fmtEur = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};
const fmtBps = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${v.toFixed(0)} bps`);
const fmtPct = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const fmtYears = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${v.toFixed(1)} y`);

const CustomerRelationshipPanel: React.FC<Props> = ({ clientId }) => {
  const { language } = useUI();
  const t = clvTranslations(language);
  const initialize = useInitializeClv(clientId);

  // React Query replaces the previous useState+useEffect+useCallback triplet.
  // Consistent with the rest of the CLV components migrated in Phase 6 —
  // adds automatic caching + window-focus refetch + shared invalidation.
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['customer360', 'relationship', clientId],
    queryFn: () => customer360.getClientRelationship(clientId),
    enabled: !!clientId,
    staleTime: 30_000,
  });

  const hasPositions = (data?.positions ?? []).length > 0;

  if (!data && !isLoading) {
    return (
      <ClientEmptyStateBanner
        variant="no-data"
        title={t.clvBannerTitleNoData}
        body={t.clvBannerBodyNoData}
        hint={t.clvBannerSeedHint}
        actions={[
          {
            label: t.clvBannerImportCta,
            icon: ImportIcon,
            variant: 'primary',
            href: '/api/customer360/import/positions',
            onClick: () => undefined,
          },
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User2 className="h-5 w-5 text-[color:var(--nfq-success)]" />
          <h3 className="font-mono text-xs font-medium text-[color:var(--nfq-text-primary)]">
            Customer 360
          </h3>
          {data?.client && (
            <span className="font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
              {data.client.name} · {data.client.segment} · {data.client.rating}
            </span>
          )}
        </div>
        <button onClick={() => void refetch()} disabled={isFetching} className="nfq-button nfq-button-ghost px-3 py-1.5 text-xs">
          <RefreshCw className={`mr-1 inline h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Client has positions but no LTV yet — proactively prompt to
          initialize so the other tabs (LTV / Timeline / NBA) light up in
          one click. Hidden once positions are empty (handled above) and
          once initialize succeeds (the component unmounts-remounts via
          query invalidation). */}
      {data && hasPositions && (
        <ClientEmptyStateBanner
          variant="no-snapshot"
          title={t.clvBannerTitleNoSnapshot}
          body={t.clvBannerBodyNoSnapshot}
          errorMessage={initialize.isError ? t.clvBannerInitializeError : undefined}
          actions={[
            {
              label: initialize.isPending ? t.clvBannerInitializing : t.clvBannerInitializeCta,
              icon: InitializeIcon,
              variant: 'primary',
              disabled: initialize.isPending,
              onClick: () => initialize.mutate(),
            },
          ]}
        />
      )}

      {data && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="nfq-kpi-card">
              <div className="nfq-kpi-label">Active positions</div>
              <div className="nfq-kpi-value tabular-nums">{data.derived.activePositionCount}</div>
            </div>
            <div className="nfq-kpi-card">
              <div className="nfq-kpi-label">Total exposure</div>
              <div className="nfq-kpi-value tabular-nums">{fmtEur(data.derived.totalExposureEur)}</div>
            </div>
            <div className="nfq-kpi-card">
              <div className="nfq-kpi-label">Share of wallet</div>
              <div className="nfq-kpi-value tabular-nums">{fmtPct(data.metrics.latest?.shareOfWalletPct ?? null)}</div>
            </div>
            <div className="nfq-kpi-card">
              <div className="nfq-kpi-label">Relationship age</div>
              <div className="nfq-kpi-value tabular-nums">{fmtYears(data.derived.relationshipAgeYears)}</div>
            </div>
          </div>

          {/* Positions */}
          <section>
            <h4 className="nfq-label text-[10px] mb-2 flex items-center gap-2">
              <Briefcase className="h-3 w-3" />
              Positions ({data.positions.length})
            </h4>
            {data.positions.length === 0 ? (
              <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-4 text-xs text-[color:var(--nfq-text-muted)]">
                No positions on file.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[color:var(--nfq-border-ghost)]">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--nfq-border-ghost)] bg-white/[0.02]">
                      <th className="nfq-label text-[10px] px-3 py-2 text-left">Product</th>
                      <th className="nfq-label text-[10px] px-3 py-2 text-left">Cat</th>
                      <th className="nfq-label text-[10px] px-3 py-2 text-right">Amount</th>
                      <th className="nfq-label text-[10px] px-3 py-2 text-right">Margin</th>
                      <th className="nfq-label text-[10px] px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((p) => (
                      <tr key={p.id} className="border-b border-[color:var(--nfq-border-ghost)]">
                        <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{p.productType}</td>
                        <td className="px-3 py-2 text-xs text-[color:var(--nfq-text-muted)]">{p.category}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">{fmtEur(p.amount)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">{fmtBps(p.marginBps)}</td>
                        <td className="px-3 py-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                              p.status === 'Active' ? 'bg-[var(--nfq-success)]/10 text-[color:var(--nfq-success)]'
                              : p.status === 'Matured' ? 'bg-[var(--nfq-bg-elevated)]/10 text-[color:var(--nfq-text-secondary)]'
                              : 'bg-[var(--nfq-danger)]/10 text-[color:var(--nfq-danger)]'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Targets — render a compact inline hint when empty to avoid
              taking ~120px for "0 results" in the Calculator's tall layout. */}
          {data.applicableTargets.length === 0 ? (
            <section className="nfq-label flex items-center gap-2 text-[10px] text-[color:var(--nfq-text-faint)]">
              <Target className="h-3 w-3" />
              <span>Applicable targets — none cover this client today</span>
            </section>
          ) : (
            <section>
              <h4 className="nfq-label text-[10px] mb-2 flex items-center gap-2">
                <Target className="h-3 w-3" />
                Applicable targets ({data.applicableTargets.length})
              </h4>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {data.applicableTargets.map((tgt) => (
                  <li key={tgt.id} className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase text-[color:var(--nfq-text-muted)]">
                      <span>{tgt.segment} · {tgt.productType} · {tgt.currency}</span>
                      <span>{tgt.period}</span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <dt className="text-[color:var(--nfq-text-faint)]">Margin</dt>
                        <dd className="font-mono tabular-nums text-[color:var(--nfq-text-secondary)]">{fmtBps(tgt.targetMarginBps)}</dd>
                      </div>
                      <div>
                        <dt className="text-[color:var(--nfq-text-faint)]">Pre-approved</dt>
                        <dd className="font-mono tabular-nums text-[color:var(--nfq-success)]">{fmtBps(tgt.preApprovedRateBps)}</dd>
                      </div>
                      <div>
                        <dt className="text-[color:var(--nfq-text-faint)]">Hard floor</dt>
                        <dd className="font-mono tabular-nums text-[color:var(--nfq-danger)]">{fmtBps(tgt.hardFloorRateBps)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Latest metrics */}
          {data.metrics.latest && (
            <section>
              <h4 className="nfq-label text-[10px] mb-2 flex items-center gap-2">
                <Activity className="h-3 w-3" />
                Latest metrics ({data.metrics.latest.period})
              </h4>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-3">
                  <dt className="nfq-label text-[10px]">NIM</dt>
                  <dd className="font-mono tabular-nums text-base text-[color:var(--nfq-text-primary)]">{fmtBps(data.metrics.latest.nimBps)}</dd>
                </div>
                <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-3">
                  <dt className="nfq-label text-[10px]">Fees</dt>
                  <dd className="font-mono tabular-nums text-base text-[color:var(--nfq-text-primary)]">{fmtEur(data.metrics.latest.feesEur)}</dd>
                </div>
                <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-3">
                  <dt className="nfq-label text-[10px]">EVA</dt>
                  <dd className="font-mono tabular-nums text-base text-[color:var(--nfq-text-primary)]">{fmtEur(data.metrics.latest.evaEur)}</dd>
                </div>
                <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-3">
                  <dt className="nfq-label text-[10px]">NPS</dt>
                  <dd className="font-mono tabular-nums text-base text-[color:var(--nfq-text-primary)]">
                    {data.metrics.latest.npsScore ?? '—'}
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerRelationshipPanel;
