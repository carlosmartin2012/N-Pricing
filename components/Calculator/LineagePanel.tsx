import React, { useState, useMemo, useCallback } from 'react';
import type { Transaction, FTPResult } from '../../types';
import {
  buildLineageReport,
  getLineage,
  type BitemporalRecord,
  type BitemporalQuery,
  type LineageEntry,
} from '../../utils/pricing/bitemporal';
import {
  History,
  Check,
  Clock,
  User,
  FileText,
  X,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface LineagePanelProps {
  deal: Transaction;
  result: FTPResult;
}

type QueryModeUI = 'CURRENT' | 'AS_OF_VALID' | 'BITEMPORAL';

const DEMO_LINEAGE: BitemporalRecord<unknown>[] = [
  {
    id: 'YC_EUR_2Y',
    version: 3,
    value: 3.45,
    validFrom: '2026-04-01',
    validTo: null,
    txFrom: '2026-04-01T08:15:00Z',
    txTo: null,
    recordedBy: 'treasury-quant@nfq.es',
    approvedBy: 'alm-committee@nfq.es',
    changeReason: 'Daily EURIBOR fixing',
  },
  {
    id: 'YC_EUR_2Y',
    version: 2,
    value: 3.38,
    validFrom: '2026-03-15',
    validTo: '2026-04-01',
    txFrom: '2026-03-15T08:10:00Z',
    txTo: '2026-04-01T08:15:00Z',
    recordedBy: 'treasury-quant@nfq.es',
    approvedBy: 'alm-committee@nfq.es',
    changeReason: 'Daily EURIBOR fixing',
  },
  {
    id: 'YC_EUR_2Y',
    version: 1,
    value: 3.21,
    validFrom: '2026-01-01',
    validTo: '2026-03-15',
    txFrom: '2026-01-01T00:00:00Z',
    txTo: '2026-03-15T08:10:00Z',
    recordedBy: 'treasury-quant@nfq.es',
    approvedBy: 'alm-committee@nfq.es',
    changeReason: 'Year start bootstrap',
  },
  {
    id: 'LP_EUR_2Y_UNSEC',
    version: 2,
    value: 42,
    validFrom: '2026-03-15',
    validTo: null,
    txFrom: '2026-03-15T10:00:00Z',
    txTo: null,
    recordedBy: 'alm-modeling@nfq.es',
    approvedBy: 'alm-committee@nfq.es',
    changeReason: 'Quarterly calibration vs peer issuances',
  },
  {
    id: 'LP_EUR_2Y_UNSEC',
    version: 1,
    value: 38,
    validFrom: '2025-12-15',
    validTo: '2026-03-15',
    txFrom: '2025-12-15T10:00:00Z',
    txTo: '2026-03-15T10:00:00Z',
    recordedBy: 'alm-modeling@nfq.es',
    approvedBy: 'alm-committee@nfq.es',
    changeReason: 'Q4 2025 calibration',
  },
  {
    id: 'LCR_OUTFLOW_CORP_STABLE',
    version: 1,
    value: 0.25,
    validFrom: '2025-01-01',
    validTo: null,
    txFrom: '2025-01-01T00:00:00Z',
    txTo: null,
    recordedBy: 'regulatory@nfq.es',
    approvedBy: 'risk-committee@nfq.es',
    changeReason: 'Baseline EBA LCR calibration',
  },
  {
    id: 'ANEJO_IX_PD_CORP',
    version: 4,
    value: 0.015,
    validFrom: '2026-01-01',
    validTo: null,
    txFrom: '2026-01-01T00:00:00Z',
    txTo: null,
    recordedBy: 'risk-modeling@nfq.es',
    approvedBy: 'model-committee@nfq.es',
    changeReason: '2026 cycle recalibration with forward-looking macro',
  },
  {
    id: 'ANEJO_IX_PD_CORP',
    version: 3,
    value: 0.018,
    validFrom: '2025-01-01',
    validTo: '2026-01-01',
    txFrom: '2025-01-01T00:00:00Z',
    txTo: '2026-01-01T00:00:00Z',
    recordedBy: 'risk-modeling@nfq.es',
    approvedBy: 'model-committee@nfq.es',
    changeReason: '2025 cycle recalibration',
  },
  {
    id: 'CAPITAL_RATIO',
    version: 2,
    value: 11.5,
    validFrom: '2026-01-01',
    validTo: null,
    txFrom: '2026-01-01T00:00:00Z',
    txTo: null,
    recordedBy: 'treasury@nfq.es',
    approvedBy: 'executive-committee@nfq.es',
    changeReason: 'ICAAP 2026 with CRR3 P2R',
  },
  {
    id: 'CAPITAL_RATIO',
    version: 1,
    value: 11.0,
    validFrom: '2025-01-01',
    validTo: '2026-01-01',
    txFrom: '2025-01-01T00:00:00Z',
    txTo: '2026-01-01T00:00:00Z',
    recordedBy: 'treasury@nfq.es',
    approvedBy: 'executive-committee@nfq.es',
    changeReason: 'ICAAP 2025 baseline',
  },
  {
    id: 'ESG_TRANS_CORP_NEUTRAL',
    version: 1,
    value: 0,
    validFrom: '2025-09-01',
    validTo: null,
    txFrom: '2025-09-01T00:00:00Z',
    txTo: null,
    recordedBy: 'esg@nfq.es',
    approvedBy: null,
    changeReason: 'Initial ESG grid setup per EBA GL/2020/06',
  },
];

const PARAMETER_NAMES: Record<string, string> = {
  YC_EUR_2Y: 'Yield curve EUR 2Y',
  LP_EUR_2Y_UNSEC: 'Liquidity premium EUR 2Y (unsecured)',
  LCR_OUTFLOW_CORP_STABLE: 'LCR outflow — Corporate stable',
  ANEJO_IX_PD_CORP: 'Anejo IX PD — Corporate',
  CAPITAL_RATIO: 'Capital ratio (P1+P2R)',
  ESG_TRANS_CORP_NEUTRAL: 'ESG transition — Neutral',
};

const PARAMETER_IDS = Object.keys(PARAMETER_NAMES);

function formatDate(d: string | null): string {
  if (!d) return '—';
  // Only show YYYY-MM-DD for compactness
  return d.slice(0, 10);
}

function formatDateTime(d: string | null): string {
  if (!d) return '—';
  // Keep ISO but strip milliseconds for readability
  return d.replace('T', ' ').replace('Z', '').slice(0, 16);
}

const LineagePanel: React.FC<LineagePanelProps> = ({ deal: _deal, result: _result }) => {
  const [queryMode, setQueryMode] = useState<QueryModeUI>('CURRENT');
  const [validAt, setValidAt] = useState<string>('2026-04-09');
  const [systemAt, setSystemAt] = useState<string>('2026-04-09');
  const [drawerParamId, setDrawerParamId] = useState<string | null>(null);

  const bitemporalQuery: BitemporalQuery = useMemo(() => {
    if (queryMode === 'CURRENT') return { mode: 'CURRENT' };
    if (queryMode === 'AS_OF_VALID') {
      return { mode: 'AS_OF_VALID', validAt: `${validAt}T23:59:59Z` };
    }
    return {
      mode: 'BITEMPORAL',
      validAt: `${validAt}T23:59:59Z`,
      systemAt: `${systemAt}T23:59:59Z`,
    };
  }, [queryMode, validAt, systemAt]);

  const lineageReport: LineageEntry[] = useMemo(() => {
    try {
      return buildLineageReport(
        DEMO_LINEAGE,
        PARAMETER_IDS,
        bitemporalQuery,
        (id) => PARAMETER_NAMES[id] ?? id,
      );
    } catch {
      return [];
    }
  }, [bitemporalQuery]);

  const totals = useMemo(() => {
    const total = lineageReport.length;
    const approved = lineageReport.filter((e) => e.approvedBy !== null).length;
    const pending = total - approved;
    return { total, approved, pending };
  }, [lineageReport]);

  const drawerChain: BitemporalRecord<unknown>[] = useMemo(() => {
    if (!drawerParamId) return [];
    return getLineage(DEMO_LINEAGE, drawerParamId);
  }, [drawerParamId]);

  const openDrawer = useCallback((paramId: string) => {
    setDrawerParamId(paramId);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerParamId(null);
  }, []);

  const modePill = (mode: QueryModeUI, label: string) => {
    const active = queryMode === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setQueryMode(mode)}
        className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-[0.16em] transition-colors ${
          active
            ? 'bg-[var(--nfq-accent,#F48B4A)] text-black'
            : 'bg-white/5 text-white/70 hover:bg-white/10'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <section className="rounded-[14px] bg-[var(--nfq-bg-surface,#171717)] p-6 text-white/90">
      {/* Heading */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[var(--nfq-accent,#F48B4A)]" />
            <h2 className="text-lg font-semibold tracking-tight">Linaje de parámetros</h2>
          </div>
          <p className="mt-1 text-xs text-white/55">
            Trazabilidad bitemporal del waterfall de pricing
          </p>
        </div>
      </header>

      {/* Reconciliation banner */}
      <div className="mb-5 rounded-[10px] bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/70">
            Pricing calculado con{' '}
            <span className="text-white">{totals.total}</span> parámetros ·{' '}
            <span className="text-emerald-400">{totals.approved}</span> con aprobación ·{' '}
            <span className={totals.pending > 0 ? 'text-amber-400' : 'text-white/40'}>
              {totals.pending}
            </span>{' '}
            pendientes
          </p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          Modo
        </span>
        {modePill('CURRENT', 'Estado actual')}
        {modePill('AS_OF_VALID', 'Estado histórico')}
        {modePill('BITEMPORAL', 'Replay bitemporal')}
      </div>

      {/* Date pickers for historical modes */}
      {queryMode !== 'CURRENT' && (
        <div className="mb-5 flex flex-wrap gap-4 rounded-[10px] bg-white/[0.03] p-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
              Valid at
            </span>
            <input
              type="date"
              value={validAt}
              onChange={(e) => setValidAt(e.target.value)}
              className="rounded-md bg-white/5 px-3 py-1.5 font-mono text-xs text-white/90 outline-none focus:ring-1 focus:ring-[var(--nfq-accent,#F48B4A)]"
            />
          </label>
          {queryMode === 'BITEMPORAL' && (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                System at
              </span>
              <input
                type="date"
                value={systemAt}
                onChange={(e) => setSystemAt(e.target.value)}
                className="rounded-md bg-white/5 px-3 py-1.5 font-mono text-xs text-white/90 outline-none focus:ring-1 focus:ring-[var(--nfq-accent,#F48B4A)]"
              />
            </label>
          )}
        </div>
      )}

      {/* Lineage table */}
      <div className="overflow-x-auto rounded-[10px] bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Parámetro
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Valor
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Versión
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Valid from
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Valid to
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Recorded by
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Approved by
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Motivo
              </th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {lineageReport.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center font-mono text-xs text-white/40"
                >
                  Sin registros para el criterio seleccionado
                </td>
              </tr>
            ) : (
              lineageReport.map((entry, idx) => {
                const approved = entry.approvedBy !== null;
                return (
                  <tr
                    key={entry.parameterId}
                    className={`border-b border-white/5 last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {approved ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <div>
                          <div className="text-xs font-medium text-white/90">
                            {entry.parameterName}
                          </div>
                          <div className="font-mono text-[10px] text-white/40">
                            {entry.parameterId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-white/90">
                      {String(entry.value)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-white/70">
                      v{entry.version}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">
                      {formatDate(entry.validFrom)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">
                      {formatDate(entry.validTo)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-white/60">
                      {entry.recordedBy}
                    </td>
                    <td className="px-4 py-3">
                      {approved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                          <Check className="h-3 w-3" />
                          {entry.approvedBy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">
                          <Clock className="h-3 w-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {entry.changeReason ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDrawer(entry.parameterId)}
                        className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 transition-colors hover:bg-white/10"
                      >
                        Ver historial
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerParamId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-label="Historial de parámetro"
            className="fixed right-0 top-0 z-50 flex h-full w-[500px] max-w-[95vw] flex-col bg-[var(--nfq-bg-surface,#171717)] shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/5 p-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                  Historial completo
                </div>
                <h3 className="mt-1 text-base font-semibold text-white/95">
                  {PARAMETER_NAMES[drawerParamId] ?? drawerParamId}
                </h3>
                <div className="mt-0.5 font-mono text-[11px] text-white/40">
                  {drawerParamId}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white/90"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ol className="space-y-4">
                {drawerChain.map((record) => {
                  const approved = record.approvedBy !== null;
                  return (
                    <li
                      key={`${record.id}-v${record.version}`}
                      className="relative rounded-[10px] bg-white/[0.03] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[var(--nfq-accent,#F48B4A)]">
                            v{record.version}
                          </span>
                          {approved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                              <Check className="h-3 w-3" />
                              Aprobado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-white/90">
                          {String(record.value)}
                        </span>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                        <div>
                          <dt className="font-mono uppercase tracking-[0.14em] text-white/40">
                            Valid from
                          </dt>
                          <dd className="font-mono text-white/80">
                            {formatDate(record.validFrom)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-[0.14em] text-white/40">
                            Valid to
                          </dt>
                          <dd className="font-mono text-white/80">
                            {formatDate(record.validTo)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-[0.14em] text-white/40">
                            Tx from
                          </dt>
                          <dd className="font-mono text-white/80">
                            {formatDateTime(record.txFrom)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-[0.14em] text-white/40">
                            Tx to
                          </dt>
                          <dd className="font-mono text-white/80">
                            {formatDateTime(record.txTo)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="flex items-center gap-1 font-mono uppercase tracking-[0.14em] text-white/40">
                            <User className="h-3 w-3" /> Recorded by
                          </dt>
                          <dd className="font-mono text-white/80">{record.recordedBy}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="flex items-center gap-1 font-mono uppercase tracking-[0.14em] text-white/40">
                            <ShieldCheck className="h-3 w-3" /> Approved by
                          </dt>
                          <dd className="font-mono text-white/80">
                            {record.approvedBy ?? '—'}
                          </dd>
                        </div>
                        {record.changeReason && (
                          <div className="col-span-2">
                            <dt className="flex items-center gap-1 font-mono uppercase tracking-[0.14em] text-white/40">
                              <FileText className="h-3 w-3" /> Motivo
                            </dt>
                            <dd className="text-white/75">{record.changeReason}</dd>
                          </div>
                        )}
                      </dl>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </>
      )}
    </section>
  );
};

export default LineagePanel;
