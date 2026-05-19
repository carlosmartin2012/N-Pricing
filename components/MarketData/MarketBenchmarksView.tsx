import React, { useMemo, useState } from 'react';
import { DatabaseZap, FileUp, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useDeleteMarketBenchmarkMutation,
  useImportMarketBenchmarksCsvMutation,
  useMarketBenchmarksQuery,
  useUpsertMarketBenchmarkMutation,
} from '../../hooks/queries/useMarketBenchmarksQuery';
import type { MarketBenchmarkFilters, MarketBenchmarkWithId } from '../../api/marketBenchmarks';
import { Badge, Button, InputGroup, Panel, SelectInput, TextInput } from '../ui/LayoutComponents';
import { useToast } from '../ui/Toast';

type TenorBucket = MarketBenchmarkWithId['tenorBucket'];

interface BenchmarkDraft {
  id?: string;
  productType: string;
  tenorBucket: TenorBucket;
  clientType: string;
  currency: string;
  rate: string;
  source: string;
  asOfDate: string;
  notes: string;
}

const EMPTY_DRAFT: BenchmarkDraft = {
  productType: 'LOAN_COMM',
  tenorBucket: 'MT',
  clientType: 'Corporate',
  currency: 'EUR',
  rate: '',
  source: 'BBG',
  asOfDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

function toDraft(row: MarketBenchmarkWithId): BenchmarkDraft {
  return {
    id: row.id,
    productType: row.productType,
    tenorBucket: row.tenorBucket,
    clientType: row.clientType,
    currency: row.currency,
    rate: String(row.rate),
    source: row.source,
    asOfDate: row.asOfDate,
    notes: row.notes ?? '',
  };
}

function toPayload(draft: BenchmarkDraft): Omit<MarketBenchmarkWithId, 'id'> & { id?: string } {
  return {
    id: draft.id,
    productType: draft.productType.trim(),
    tenorBucket: draft.tenorBucket,
    clientType: draft.clientType.trim(),
    currency: draft.currency.trim().toUpperCase(),
    rate: Number(draft.rate),
    source: draft.source.trim(),
    asOfDate: draft.asOfDate,
    notes: draft.notes.trim() || null,
  };
}

function formatRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

const MarketBenchmarksView: React.FC = () => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'Admin';
  const [filters, setFilters] = useState({ products: '', currencies: '', clients: '' });
  const [draft, setDraft] = useState<BenchmarkDraft>(EMPTY_DRAFT);
  const [csvText, setCsvText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const queryFilters = useMemo<MarketBenchmarkFilters>(() => ({
    products: filters.products.split(',').map((v) => v.trim()).filter(Boolean),
    currencies: filters.currencies.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean),
    clients: filters.clients.split(',').map((v) => v.trim()).filter(Boolean),
  }), [filters]);

  const hasFilters = queryFilters.products?.length || queryFilters.currencies?.length || queryFilters.clients?.length;
  const { data: benchmarks = [], isFetching, refetch } = useMarketBenchmarksQuery(hasFilters ? queryFilters : undefined);
  const upsertMutation = useUpsertMarketBenchmarkMutation();
  const deleteMutation = useDeleteMarketBenchmarkMutation();
  const importMutation = useImportMarketBenchmarksCsvMutation();

  const stats = useMemo(() => {
    const latest = benchmarks.reduce<string | null>(
      (max, row) => (!max || row.asOfDate > max ? row.asOfDate : max),
      null,
    );
    const sources = new Set(benchmarks.map((row) => row.source));
    const tuples = new Set(benchmarks.map((row) => `${row.productType}:${row.tenorBucket}:${row.clientType}:${row.currency}`));
    return { latest, sources: sources.size, tuples: tuples.size };
  }, [benchmarks]);

  const resetDraft = () => {
    setDraft({ ...EMPTY_DRAFT, asOfDate: new Date().toISOString().slice(0, 10) });
    setValidationError(null);
  };

  const updateDraft = <K extends keyof BenchmarkDraft>(key: K, value: BenchmarkDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (validationError) setValidationError(null);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setValidationError('Admin role required.');
      return;
    }
    const payload = toPayload(draft);
    if (!payload.productType || !payload.clientType || !payload.currency || !payload.source || !payload.asOfDate) {
      setValidationError('Product, client, currency, source and as-of date are required.');
      return;
    }
    if (!Number.isFinite(payload.rate) || payload.rate < 0 || payload.rate > 50) {
      setValidationError('Rate must be a number between 0 and 50.');
      return;
    }
    const saved = await upsertMutation.mutateAsync(payload);
    if (!saved) {
      addToast('error', 'Benchmark could not be saved.');
      return;
    }
    addToast('success', `${saved.productType} ${saved.tenorBucket} benchmark saved.`);
    resetDraft();
  };

  const handleDelete = async (row: MarketBenchmarkWithId) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete ${row.productType} ${row.tenorBucket} ${row.currency} benchmark?`)) return;
    const ok = await deleteMutation.mutateAsync(row.id);
    addToast(ok ? 'success' : 'error', ok ? 'Benchmark deleted.' : 'Benchmark could not be deleted.');
  };

  const handleImport = async () => {
    if (!isAdmin || csvText.trim().length === 0) return;
    const result = await importMutation.mutateAsync(csvText);
    if (!result) {
      addToast('error', 'CSV import failed.');
      return;
    }
    addToast('success', `${result.inserted} inserted · ${result.updated} updated · ${result.errors.length} rejected.`);
    if (result.errors.length === 0) setCsvText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">Benchmarks</div>
          <div className="nfq-kpi-value">{benchmarks.length}</div>
        </div>
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">Tuples</div>
          <div className="nfq-kpi-value">{stats.tuples}</div>
        </div>
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">Sources</div>
          <div className="nfq-kpi-value">{stats.sources}</div>
        </div>
        <div className="nfq-kpi-card">
          <div className="nfq-kpi-label">Latest as-of</div>
          <div className="font-mono-nums mt-3 text-[24px] font-semibold text-[color:var(--nfq-text-primary)]">
            {stats.latest ?? '--'}
          </div>
        </div>
      </div>

      <Panel
        title="Market Benchmarks"
        icon={<DatabaseZap className="h-5 w-5 text-[color:var(--nfq-cat-a)]" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isAdmin ? 'success' : 'warning'}>{isAdmin ? 'Admin write' : 'Read only'}</Badge>
            <Button size="sm" variant="ghost" onClick={() => void refetch()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="grid gap-3 rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-white/[0.03] p-4 md:grid-cols-3">
              <label className="space-y-1.5">
                <span className="nfq-label flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  Products
                </span>
                <TextInput
                  value={filters.products}
                  onChange={(event) => setFilters((current) => ({ ...current, products: event.target.value }))}
                  placeholder="LOAN_COMM,MORTGAGE"
                />
              </label>
              <label className="space-y-1.5">
                <span className="nfq-label">Currencies</span>
                <TextInput
                  value={filters.currencies}
                  onChange={(event) => setFilters((current) => ({ ...current, currencies: event.target.value }))}
                  placeholder="EUR,USD"
                />
              </label>
              <label className="space-y-1.5">
                <span className="nfq-label">Clients</span>
                <TextInput
                  value={filters.clients}
                  onChange={(event) => setFilters((current) => ({ ...current, clients: event.target.value }))}
                  placeholder="Corporate,SME"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)]">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="sticky top-0 z-10 border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]">
                  <tr>
                    <th className="px-4 py-3 text-left nfq-label">Product</th>
                    <th className="px-4 py-3 text-left nfq-label">Client</th>
                    <th className="px-4 py-3 text-left nfq-label">Tenor</th>
                    <th className="px-4 py-3 text-left nfq-label">Ccy</th>
                    <th className="px-4 py-3 text-right nfq-label">Rate</th>
                    <th className="px-4 py-3 text-left nfq-label">Source</th>
                    <th className="px-4 py-3 text-left nfq-label">As-of</th>
                    <th className="px-4 py-3 text-right nfq-label">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-[color:var(--nfq-text-secondary)]">
                        No market benchmark rows match the current filters.
                      </td>
                    </tr>
                  ) : (
                    benchmarks.map((row) => (
                      <tr key={row.id} className="border-b border-[color:var(--nfq-border-ghost)] hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-[color:var(--nfq-text-primary)]">{row.productType}</td>
                        <td className="px-4 py-3 text-[color:var(--nfq-text-secondary)]">{row.clientType}</td>
                        <td className="px-4 py-3"><Badge variant="outline">{row.tenorBucket}</Badge></td>
                        <td className="px-4 py-3 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{row.currency}</td>
                        <td className="px-4 py-3 text-right font-mono-nums text-[color:var(--nfq-text-primary)]">{formatRate(row.rate)}</td>
                        <td className="px-4 py-3 text-[color:var(--nfq-text-secondary)]">{row.source}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{row.asOfDate}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(row))}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
                                <Trash2 className="h-4 w-4 text-[color:var(--nfq-danger)]" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-auto">
            <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="nfq-label">{draft.id ? 'Edit benchmark' : 'New benchmark'}</div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                    {draft.productType} · {draft.tenorBucket} · {draft.currency}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={resetDraft}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>

              <InputGroup label="Product">
                <TextInput value={draft.productType} onChange={(event) => updateDraft('productType', event.target.value)} />
              </InputGroup>
              <div className="grid gap-3 md:grid-cols-2">
                <InputGroup label="Client">
                  <TextInput value={draft.clientType} onChange={(event) => updateDraft('clientType', event.target.value)} />
                </InputGroup>
                <InputGroup label="Tenor">
                  <SelectInput value={draft.tenorBucket} onChange={(event) => updateDraft('tenorBucket', event.target.value as TenorBucket)}>
                    <option value="ST">ST</option>
                    <option value="MT">MT</option>
                    <option value="LT">LT</option>
                  </SelectInput>
                </InputGroup>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputGroup label="Currency">
                  <TextInput value={draft.currency} onChange={(event) => updateDraft('currency', event.target.value)} />
                </InputGroup>
                <InputGroup label="Rate">
                  <TextInput type="number" step="0.01" value={draft.rate} onChange={(event) => updateDraft('rate', event.target.value)} />
                </InputGroup>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputGroup label="Source">
                  <TextInput value={draft.source} onChange={(event) => updateDraft('source', event.target.value)} />
                </InputGroup>
                <InputGroup label="As-of date">
                  <TextInput type="date" value={draft.asOfDate} onChange={(event) => updateDraft('asOfDate', event.target.value)} />
                </InputGroup>
              </div>
              <InputGroup label="Notes">
                <textarea
                  value={draft.notes}
                  onChange={(event) => updateDraft('notes', event.target.value)}
                  rows={3}
                  className="nfq-input-field min-h-[76px] resize-y"
                />
              </InputGroup>
              {validationError && (
                <div className="mb-4 rounded-[var(--nfq-radius-card)] border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {validationError}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button disabled={!isAdmin || upsertMutation.isPending} onClick={() => void handleSave()}>
                  <Save className="mr-2 h-4 w-4" />
                  Save benchmark
                </Button>
                {draft.id && (
                  <Button variant="outline" onClick={resetDraft}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel edit
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-white/[0.03] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="nfq-label">CSV import</div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--nfq-text-primary)]">Bulk benchmark feed</div>
                </div>
                <FileUp className="h-5 w-5 text-[color:var(--nfq-cat-a)]" />
              </div>
              <textarea
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                rows={6}
                className="nfq-input-field min-h-[140px] resize-y font-mono text-xs"
                placeholder="productType,tenorBucket,clientType,currency,rate,source,asOfDate,notes"
              />
              <Button className="mt-3" disabled={!isAdmin || csvText.trim().length === 0 || importMutation.isPending} onClick={() => void handleImport()}>
                <FileUp className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default MarketBenchmarksView;
