import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Target, RefreshCw, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import { useUI } from '../../contexts/UIContext';
import { commercialTranslations } from '../../translations/index';
import * as campaignsApi from '../../api/campaigns';
import type { CampaignStatus, ChannelType, PricingCampaign } from '@npricing/domain';
import { createLogger } from '../../utils/logger';

const log = createLogger('CampaignsView');

const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft: 'bg-slate-500/10 text-[color:var(--nfq-text-secondary)]',
  approved: 'bg-cyan-500/10 text-[color:var(--nfq-accent)]',
  active: 'bg-emerald-500/10 text-[color:var(--nfq-success)]',
  exhausted: 'bg-amber-500/10 text-[color:var(--nfq-warning)]',
  expired: 'bg-slate-500/10 text-[color:var(--nfq-text-muted)]',
  cancelled: 'bg-rose-500/10 text-[color:var(--nfq-danger)]',
};

const fmtBps = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)} bps`;
const fmtEur = (v: number | null) =>
  v === null
    ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface NewCampaignForm {
  code: string;
  name: string;
  segment: string;
  productType: string;
  currency: string;
  channel: ChannelType | '';
  rateDeltaBps: number;
  maxVolumeEur: number | '';
  activeFrom: string;
  activeTo: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const EMPTY_FORM: NewCampaignForm = {
  code: '',
  name: '',
  segment: 'Retail',
  productType: 'MORTGAGE',
  currency: 'EUR',
  channel: '',
  rateDeltaBps: -10,
  maxVolumeEur: '',
  activeFrom: today(),
  activeTo: inDays(90),
};

const CampaignsView: React.FC = () => {
  const { activeEntity } = useEntity();
  const { language } = useUI();
  const t = commercialTranslations(language);
  const [list, setList] = useState<PricingCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCampaignForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await campaignsApi.listCampaigns());
    } catch (e) {
      log.warn('list failed', { err: String(e) });
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const byStatus: Record<string, PricingCampaign[]> = {};
    for (const c of list) (byStatus[c.status] ??= []).push(c);
    return byStatus;
  }, [list]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await campaignsApi.createCampaign({
        ...form,
        channel: form.channel || null,
        maxVolumeEur: form.maxVolumeEur === '' ? null : Number(form.maxVolumeEur),
      });
      if (!created) {
        setError('Server rejected the campaign — check the required fields.');
      } else {
        setForm(EMPTY_FORM);
        setShowForm(false);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (id: string, status: CampaignStatus) => {
    await campaignsApi.transitionCampaign(id, status);
    void load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-[color:var(--nfq-success)]" />
          <h1 className="nfq-headline">
            {t.commercialCampaignsHeader}
          </h1>
          {activeEntity && <span className="nfq-label text-[10px] text-[color:var(--nfq-text-muted)]">{activeEntity.shortCode}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} disabled={loading} className="nfq-button nfq-button-ghost px-3 py-1.5 text-xs">
            <RefreshCw className={`mr-1 inline h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="nfq-button nfq-button-primary flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3 w-3" />
            {t.commercialCampaignNew}
          </button>
        </div>
      </header>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-[color:var(--nfq-success)]/30 bg-[var(--nfq-success-subtle)] p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Code">
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={inputCls}
              />
            </Field>
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Segment">
              <input
                required
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Product type">
              <input
                required
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Currency">
              <input
                required
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                className={inputCls}
              />
            </Field>
            <Field label="Channel (optional)">
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as ChannelType | '' })}
                className={inputCls}
              >
                <option value="">Any channel</option>
                <option value="branch">branch</option>
                <option value="web">web</option>
                <option value="mobile">mobile</option>
                <option value="call_center">call_center</option>
                <option value="partner">partner</option>
              </select>
            </Field>
            <Field label="Rate delta (bps)">
              <input
                type="number"
                required
                value={form.rateDeltaBps}
                onChange={(e) => setForm({ ...form, rateDeltaBps: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Max volume (€)">
              <input
                type="number"
                value={form.maxVolumeEur}
                onChange={(e) =>
                  setForm({ ...form, maxVolumeEur: e.target.value === '' ? '' : Number(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Active from">
              <input
                type="date"
                required
                value={form.activeFrom}
                onChange={(e) => setForm({ ...form, activeFrom: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Active to">
              <input
                type="date"
                required
                value={form.activeTo}
                onChange={(e) => setForm({ ...form, activeTo: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          {error && <div className="text-xs text-[color:var(--nfq-danger)]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="nfq-button nfq-button-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="nfq-button nfq-button-primary px-3 py-1.5 text-xs">
              {submitting ? 'Creating…' : 'Create as draft'}
            </button>
          </div>
          <p className="text-[10px] text-[color:var(--nfq-text-faint)]">
            Newly created campaigns land as <code>draft</code>. Transition to <code>approved</code> →{' '}
            <code>active</code> from the table below.
          </p>
        </form>
      )}

      {list.length === 0 && !loading ? (
        <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-4 text-center text-xs text-[color:var(--nfq-text-muted)]">
          {t.commercialCampaignsEmpty}
        </div>
      ) : (
        <div className="space-y-4">
          {(['draft', 'approved', 'active', 'exhausted', 'expired', 'cancelled'] as CampaignStatus[]).map((status) => {
            const items = grouped[status] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h3 className="nfq-label text-[10px] mb-2 uppercase">
                  {status} ({items.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-[color:var(--nfq-border-ghost)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--nfq-border-ghost)] bg-white/[0.02]">
                        <th className="nfq-label text-[10px] px-3 py-2 text-left">Code</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-left">Name</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-left">Segment / Product</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-left">Channel</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-right">Δ rate</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-right">Volume (used / max)</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-left">Window</th>
                        <th className="nfq-label text-[10px] px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <tr key={c.id} className="border-b border-[color:var(--nfq-border-ghost)]">
                          <td className="px-3 py-2 font-mono text-xs text-[color:var(--nfq-text-secondary)]">{c.code}</td>
                          <td className="px-3 py-2 text-xs text-[color:var(--nfq-text-primary)]">{c.name}</td>
                          <td className="px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)]">
                            {c.segment} / {c.productType} / {c.currency}
                          </td>
                          <td className="px-3 py-2 text-xs text-[color:var(--nfq-text-muted)]">{c.channel ?? 'any'}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                            {fmtBps(c.rateDeltaBps)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                            {fmtEur(c.consumedVolumeEur)} / {fmtEur(c.maxVolumeEur)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-[color:var(--nfq-text-muted)]">
                            {c.activeFrom} → {c.activeTo}
                          </td>
                          <td className="px-3 py-2 text-right space-x-1">
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_COLOR[c.status]}`}
                            >
                              {c.status}
                            </span>
                            {c.status === 'draft' && (
                              <button
                                onClick={() => void transition(c.id, 'approved')}
                                className="ml-1 nfq-button nfq-button-ghost px-2 py-0.5 text-[10px]"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-3 w-3 inline text-[color:var(--nfq-accent)]" />
                              </button>
                            )}
                            {c.status === 'approved' && (
                              <button
                                onClick={() => void transition(c.id, 'active')}
                                className="ml-1 nfq-button nfq-button-ghost px-2 py-0.5 text-[10px]"
                                title="Activate"
                              >
                                <CheckCircle2 className="h-3 w-3 inline text-[color:var(--nfq-success)]" />
                              </button>
                            )}
                            {(c.status === 'draft' || c.status === 'approved' || c.status === 'active') && (
                              <button
                                onClick={() => void transition(c.id, 'cancelled')}
                                className="ml-1 nfq-button nfq-button-ghost px-2 py-0.5 text-[10px]"
                                title="Cancel"
                              >
                                <XCircle className="h-3 w-3 inline text-[color:var(--nfq-danger)]" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="nfq-label text-[10px] mb-1">{label}</div>
    {children}
  </label>
);
const inputCls =
  'w-full rounded border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-[color:var(--nfq-text-primary)] focus:border-amber-400 focus:outline-none';

export default CampaignsView;
