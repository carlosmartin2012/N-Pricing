import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import type { ReportSchedule, ReportType, ReportFrequency, ReportFormat } from '../../../types/reportSchedule';
import { reportSchedules as schedulesApi } from '../../../api';
import type { ConfigUser } from '../configTypes';
import { useUI } from '../../../contexts/UIContext';

interface Props {
  user: ConfigUser;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  portfolio_summary: 'Portfolio Summary',
  lcr_nsfr: 'LCR / NSFR',
  raroc_breakdown: 'RAROC Breakdown',
  maturity_ladder: 'Maturity Ladder',
  nii_sensitivity: 'NII Sensitivity',
  pricing_analytics: 'Pricing Analytics',
  executive_summary: 'Executive Summary',
};

const FREQUENCY_OPTIONS: ReportFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const FORMAT_OPTIONS: ReportFormat[] = ['pdf', 'xlsx', 'csv'];

const DEFAULT_DRAFT: Partial<ReportSchedule> = {
  name: '',
  reportType: 'portfolio_summary',
  frequency: 'monthly',
  format: 'pdf',
  recipients: [],
  isActive: true,
  config: {},
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ReportSchedulingTab: React.FC<Props> = ({ user }) => {
  const { t } = useUI();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ReportSchedule>>(DEFAULT_DRAFT);
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [saving, setSaving] = useState(false);

  const entityId = user?.entityId ?? undefined;

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    const data = await schedulesApi.listSchedules(entityId);
    setSchedules(data);
    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const openNew = () => {
    setDraft({ ...DEFAULT_DRAFT, entityId, createdBy: user?.email ?? 'unknown' });
    setRecipientsRaw('');
    setDrawerOpen(true);
  };

  const openEdit = (schedule: ReportSchedule) => {
    setDraft({ ...schedule });
    setRecipientsRaw(schedule.recipients.join(', '));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDraft(DEFAULT_DRAFT);
    setRecipientsRaw('');
  };

  const handleSave = async () => {
    if (!draft.name?.trim() || !draft.reportType || !draft.frequency || !draft.format) return;
    setSaving(true);
    const recipients = recipientsRaw
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const result = await schedulesApi.upsertSchedule({ ...draft, recipients });
    if (result) {
      setSchedules((prev) => {
        const idx = prev.findIndex((s) => s.id === result.id);
        return idx >= 0 ? prev.map((s) => (s.id === result.id ? result : s)) : [result, ...prev];
      });
    }
    setSaving(false);
    closeDrawer();
  };

  const handleDelete = async (id: string) => {
    await schedulesApi.deleteSchedule(id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggle = async (schedule: ReportSchedule) => {
    const next = !schedule.isActive;
    await schedulesApi.toggleSchedule(schedule.id, next);
    setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isActive: next } : s)));
  };

  return (
    <>
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[var(--nfq-bg-elevated)]">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[color:var(--nfq-accent)]" />
          <span className="text-xs text-[color:var(--nfq-text-muted)] font-mono tracking-normal">
            {schedules.length} {t.reportSchedules}
          </span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--nfq-accent)]/40 text-[color:var(--nfq-accent)] rounded border border-[color:var(--nfq-accent)] text-xs hover:bg-[var(--nfq-accent)]/60 font-bold"
        >
          <Plus size={12} /> {t.newSchedule}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        {loading ? (
          <div className="p-4 text-center text-xs text-[color:var(--nfq-text-faint)] font-mono">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-4 text-center text-xs text-[color:var(--nfq-text-faint)] font-mono">
            No schedules configured. Click «{t.newSchedule}» to create one.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-[var(--nfq-bg-elevated)]/60">
                {['NAME', t.reportType.toUpperCase(), t.frequency.toUpperCase(), 'FORMAT', t.recipients.toUpperCase(), t.lastRun.toUpperCase(), 'ACTIVE', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2 text-left font-mono text-[color:var(--nfq-text-faint)] tracking-normal text-[10px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800 hover:bg-[var(--nfq-bg-highest)]/40 cursor-pointer"
                  onClick={() => openEdit(s)}
                >
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-primary)] font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)] font-mono">
                    {REPORT_TYPE_LABELS[s.reportType] ?? s.reportType}
                  </td>
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)] font-mono capitalize">{s.frequency}</td>
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-secondary)] font-mono uppercase">{s.format}</td>
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-muted)] font-mono text-right">{s.recipients.length}</td>
                  <td className="px-4 py-2.5 text-[color:var(--nfq-text-muted)] font-mono">{formatRelativeTime(s.lastRunAt)}</td>
                  <td
                    className="px-4 py-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggle(s);
                    }}
                  >
                    {s.isActive ? (
                      <ToggleRight size={18} className="text-[color:var(--nfq-accent)]" />
                    ) : (
                      <ToggleLeft size={18} className="text-[color:var(--nfq-text-faint)]" />
                    )}
                  </td>
                  <td
                    className="px-4 py-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(s.id);
                    }}
                  >
                    <Trash2 size={13} className="text-[color:var(--nfq-text-faint)] hover:text-[color:var(--nfq-danger)] transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60" onClick={closeDrawer} />

          {/* Panel */}
          <div className="w-full max-w-md bg-[var(--nfq-bg-elevated)] border-l border-slate-700 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                {draft.id ? 'Edit Schedule' : t.newSchedule}
              </h2>
              <button onClick={closeDrawer} className="text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Monthly Portfolio Summary"
                  className="w-full bg-[var(--nfq-bg-root)] border border-slate-700 rounded px-3 py-2 text-xs text-[color:var(--nfq-text-primary)] focus:outline-none focus:border-[color:var(--nfq-accent)]"
                />
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)] mb-1">
                  {t.reportType}
                </label>
                <select
                  value={draft.reportType ?? 'portfolio_summary'}
                  onChange={(e) => setDraft((d) => ({ ...d, reportType: e.target.value as ReportType }))}
                  className="w-full bg-[var(--nfq-bg-root)] border border-slate-700 rounded px-3 py-2 text-xs text-[color:var(--nfq-text-primary)] focus:outline-none focus:border-[color:var(--nfq-accent)]"
                >
                  {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)] mb-1">
                  {t.frequency}
                </label>
                <div className="flex gap-2">
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setDraft((d) => ({ ...d, frequency: f }))}
                      className={`flex-1 py-1.5 rounded text-[10px] font-mono tracking-normal border transition-colors ${
                        draft.frequency === f
                          ? 'bg-[var(--nfq-accent)]/50 border-[color:var(--nfq-accent)] text-[color:var(--nfq-accent)]'
                          : 'border-slate-700 text-[color:var(--nfq-text-faint)] hover:border-slate-500'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)] mb-1">
                  Format
                </label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setDraft((d) => ({ ...d, format: f }))}
                      className={`flex-1 py-1.5 rounded text-[10px] font-mono tracking-normal border transition-colors ${
                        draft.format === f
                          ? 'bg-[var(--nfq-warning)]/40 border-amber-700 text-[color:var(--nfq-warning)]'
                          : 'border-slate-700 text-[color:var(--nfq-text-faint)] hover:border-slate-500'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)] mb-1">
                  {t.recipients} <span className="text-[color:var(--nfq-text-faint)]">(comma-separated emails)</span>
                </label>
                <textarea
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder="analyst@bank.com, manager@bank.com"
                  rows={3}
                  className="w-full bg-[var(--nfq-bg-root)] border border-slate-700 rounded px-3 py-2 text-xs text-[color:var(--nfq-text-primary)] focus:outline-none focus:border-[color:var(--nfq-accent)] resize-none font-mono"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-mono tracking-normal text-[color:var(--nfq-text-faint)]">Active</label>
                <button
                  onClick={() => setDraft((d) => ({ ...d, isActive: !d.isActive }))}
                  className="focus:outline-none"
                >
                  {draft.isActive ? (
                    <ToggleRight size={22} className="text-[color:var(--nfq-accent)]" />
                  ) : (
                    <ToggleLeft size={22} className="text-[color:var(--nfq-text-faint)]" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-2">
              <button
                onClick={closeDrawer}
                className="px-4 py-2 text-xs text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !draft.name?.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--nfq-accent)] hover:bg-[var(--nfq-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--nfq-text-primary)] text-xs font-bold rounded transition-colors"
              >
                <Check size={12} /> {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportSchedulingTab;
