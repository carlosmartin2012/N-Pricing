import React, { useState, useCallback, useMemo } from 'react';
import type { SandboxMethodology, SandboxDiff, SandboxStatus } from '../../types';
import {
  FlaskConical,
  Plus,
  Send,
  Trash2,
  Edit,
  Play,
  GitBranch,
} from 'lucide-react';
import { Panel, Badge, Button, TextInput } from '../ui/LayoutComponents';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import {
  useSandboxesQuery,
  useSandboxQuery,
  useCreateSandbox,
  useUpdateSandbox,
  useDeleteSandbox,
  usePublishSandbox,
  useImpactReportQuery,
  useComputeImpactReport,
} from '../../hooks/queries/useWhatIfQueries';
import ImpactReportPanel from './ImpactReport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANT: Record<SandboxStatus, 'muted' | 'warning' | 'success' | 'info'> = {
  draft: 'muted',
  computing: 'warning',
  ready: 'success',
  published: 'info',
  archived: 'muted',
};

const CHANGE_TYPE_LABELS: Record<SandboxDiff['changeType'], string> = {
  rule: 'Rule',
  curve: 'Curve',
  spread: 'Spread',
  threshold: 'Threshold',
  esg: 'ESG',
  capital: 'Capital',
};

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '\u2014';
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SandboxListItem: React.FC<{
  sandbox: SandboxMethodology;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ sandbox, isSelected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(sandbox.id)}
    className={`w-full text-left px-4 py-3 rounded-[12px] transition-colors ${
      isSelected
        ? 'bg-cyan-500/10 border border-cyan-500/30'
        : 'hover:bg-[var(--nfq-bg-elevated)] border border-transparent'
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-[color:var(--nfq-text-primary)] truncate">
        {sandbox.name}
      </span>
      <Badge variant={STATUS_BADGE_VARIANT[sandbox.status]}>{sandbox.status}</Badge>
    </div>
    <div className="mt-1 text-[11px] text-[color:var(--nfq-text-secondary)] truncate">
      {sandbox.diffs.length} change{sandbox.diffs.length !== 1 ? 's' : ''} &middot;{' '}
      {new Date(sandbox.updatedAt).toLocaleDateString()}
    </div>
  </button>
);

const DiffCard: React.FC<{
  diff: SandboxDiff;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updated: SandboxDiff) => void;
}> = ({ diff, index, onRemove, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(diff.parameterLabel);
  const [currentVal, setCurrentVal] = useState(String(diff.currentValue ?? ''));
  const [proposedVal, setProposedVal] = useState(String(diff.proposedValue ?? ''));
  const [changeType, setChangeType] = useState(diff.changeType);

  const handleSave = () => {
    const parsedCurrent = Number(currentVal);
    const parsedProposed = Number(proposedVal);
    onUpdate(index, {
      ...diff,
      parameterLabel: label,
      currentValue: Number.isFinite(parsedCurrent) ? parsedCurrent : currentVal,
      proposedValue: Number.isFinite(parsedProposed) ? parsedProposed : proposedVal,
      changeType,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(diff.parameterLabel);
    setCurrentVal(String(diff.currentValue ?? ''));
    setProposedVal(String(diff.proposedValue ?? ''));
    setChangeType(diff.changeType);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-[16px] border border-cyan-500/20 bg-[var(--nfq-bg-elevated)] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">Label</label>
            <input
              className="nfq-input-field mt-1 w-full text-xs"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">Type</label>
            <select
              className="nfq-select-field mt-1 w-full text-xs"
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as SandboxDiff['changeType'])}
            >
              {Object.entries(CHANGE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">Current Value</label>
            <input
              className="nfq-input-field mt-1 w-full text-xs"
              value={currentVal}
              onChange={(e) => setCurrentVal(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">Proposed Value</label>
            <input
              className="nfq-input-field mt-1 w-full text-xs"
              value={proposedVal}
              onChange={(e) => setProposedVal(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-[11px] font-medium text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[color:var(--nfq-text-secondary)] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[16px] border border-white/5 bg-[var(--nfq-bg-elevated)] p-4 cursor-pointer hover:border-cyan-500/20 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{CHANGE_TYPE_LABELS[diff.changeType]}</Badge>
            <span className="text-xs font-medium text-[color:var(--nfq-text-primary)] truncate">
              {diff.parameterLabel}
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-[color:var(--nfq-text-secondary)]">
            {diff.parameterPath}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-rose-400 line-through">{formatChangeValue(diff.currentValue)}</span>
            <span className="text-[color:var(--nfq-text-secondary)]">&rarr;</span>
            <span className="text-emerald-400">{formatChangeValue(diff.proposedValue)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          className="shrink-0 rounded-lg p-1.5 text-[color:var(--nfq-text-secondary)] hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          aria-label="Remove diff"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WhatIfWorkspace: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();
  const entityId = activeEntity?.id;

  // --- State ---
  const [selectedId, setSelectedId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingName, setEditingName] = useState(false);

  // --- Queries ---
  const { data: sandboxes = [], isLoading: loadingSandboxes } = useSandboxesQuery(entityId);
  const { data: selectedSandbox } = useSandboxQuery(selectedId);
  const { data: impactReport, isLoading: loadingReport } = useImpactReportQuery(selectedId);

  // --- Mutations ---
  const createMutation = useCreateSandbox();
  const updateMutation = useUpdateSandbox();
  const deleteMutation = useDeleteSandbox();
  const publishMutation = usePublishSandbox();
  const computeImpactMutation = useComputeImpactReport();

  // --- Derived ---
  const sandbox = selectedSandbox ?? sandboxes.find((s) => s.id === selectedId) ?? null;
  const isComputing = sandbox?.status === 'computing' || computeImpactMutation.isPending;
  const canCompute = sandbox?.status === 'draft' && (sandbox.diffs.length ?? 0) > 0;
  const canPublish = sandbox?.status === 'ready';

  // --- Handlers ---
  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    createMutation.mutate(
      {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        baseSnapshotId: '',
        status: 'draft',
        diffs: [],
        createdByEmail: '',
        createdByName: '',
        entityId,
      },
      {
        onSuccess: (created) => {
          if (created) setSelectedId(created.id);
          setIsCreating(false);
          setNewName('');
          setNewDescription('');
        },
      },
    );
  }, [newName, newDescription, entityId, createMutation]);

  const handleDelete = useCallback(() => {
    if (!sandbox) return;
    deleteMutation.mutate(sandbox.id, {
      onSuccess: () => setSelectedId(''),
    });
  }, [sandbox, deleteMutation]);

  const handleRemoveDiff = useCallback(
    (index: number) => {
      if (!sandbox) return;
      const nextDiffs = sandbox.diffs.filter((_, i) => i !== index);
      updateMutation.mutate({ id: sandbox.id, updates: { diffs: nextDiffs } });
    },
    [sandbox, updateMutation],
  );

  const handleUpdateDiff = useCallback(
    (index: number, updated: SandboxDiff) => {
      if (!sandbox) return;
      const nextDiffs = sandbox.diffs.map((d, i) => (i === index ? updated : d));
      updateMutation.mutate({ id: sandbox.id, updates: { diffs: nextDiffs } });
    },
    [sandbox, updateMutation],
  );

  const handleAddDiff = useCallback(() => {
    if (!sandbox) return;
    const newDiff: SandboxDiff = {
      parameterPath: '',
      parameterLabel: 'New parameter',
      currentValue: 0,
      proposedValue: 0,
      changeType: 'spread',
    };
    updateMutation.mutate({
      id: sandbox.id,
      updates: { diffs: [...sandbox.diffs, newDiff] },
    });
  }, [sandbox, updateMutation]);

  const handleComputeImpact = useCallback(() => {
    if (!sandbox) return;
    computeImpactMutation.mutate(sandbox.id);
  }, [sandbox, computeImpactMutation]);

  const handlePublish = useCallback(() => {
    if (!sandbox) return;
    publishMutation.mutate(sandbox.id);
  }, [sandbox, publishMutation]);

  const handleNameSave = useCallback(
    (value: string) => {
      if (!sandbox) return;
      updateMutation.mutate({ id: sandbox.id, updates: { name: value } });
      setEditingName(false);
    },
    [sandbox, updateMutation],
  );

  // --- Sorted sandboxes ---
  const sortedSandboxes = useMemo(
    () => [...sandboxes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sandboxes],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* --- Left sidebar: sandbox list --- */}
      <aside className="flex w-72 shrink-0 flex-col rounded-[22px] bg-[var(--nfq-bg-surface)] border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--nfq-text-primary)]">
            <FlaskConical className="h-4 w-4 text-cyan-400" />
            Sandboxes
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsCreating(true)}
            aria-label="Create sandbox"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Create form */}
        {isCreating && (
          <div className="border-b border-white/5 p-4 space-y-2">
            <TextInput
              placeholder="Sandbox name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <TextInput
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Sandbox list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingSandboxes ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
            </div>
          ) : sortedSandboxes.length === 0 ? (
            <div className="py-8 text-center text-xs text-[color:var(--nfq-text-secondary)]">
              No sandboxes yet. Create one to start.
            </div>
          ) : (
            sortedSandboxes.map((sb) => (
              <SandboxListItem
                key={sb.id}
                sandbox={sb}
                isSelected={sb.id === selectedId}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>
      </aside>

      {/* --- Center: sandbox editor --- */}
      <main className="flex flex-1 min-w-0 flex-col gap-4">
        {!sandbox ? (
          <div className="flex flex-1 items-center justify-center rounded-[22px] bg-[var(--nfq-bg-surface)] border border-white/5">
            <div className="text-center">
              <FlaskConical className="mx-auto mb-3 h-10 w-10 text-[color:var(--nfq-text-secondary)] opacity-30" />
              <div className="text-sm text-[color:var(--nfq-text-secondary)]">
                Select a sandbox or create a new one
              </div>
            </div>
          </div>
        ) : (
          <Panel
            title={sandbox.name}
            icon={<GitBranch className="h-5 w-5 text-cyan-400" />}
            actions={
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_BADGE_VARIANT[sandbox.status]}>{sandbox.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingName(true)}
                  aria-label="Edit sandbox name"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || sandbox.status === 'published'}
                  aria-label="Delete sandbox"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            }
          >
            <div className="space-y-6 p-4">
              {/* Name edit inline */}
              {editingName && (
                <div className="flex items-center gap-2">
                  <TextInput
                    defaultValue={sandbox.name}
                    autoFocus
                    onBlur={(e) => handleNameSave(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                  />
                </div>
              )}

              {/* Description */}
              {sandbox.description && (
                <p className="text-xs text-[color:var(--nfq-text-secondary)]">{sandbox.description}</p>
              )}

              {/* Base snapshot */}
              <div className="rounded-[12px] bg-[var(--nfq-bg-elevated)] px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">
                  Base Snapshot
                </span>
                <div className="mt-1 text-xs font-mono text-[color:var(--nfq-text-primary)]">
                  {sandbox.baseSnapshotId || 'Current methodology'}
                </div>
              </div>

              {/* Diff list */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--nfq-text-secondary)]">
                    Parameter Changes ({sandbox.diffs.length})
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAddDiff}
                    disabled={sandbox.status === 'published'}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Change
                  </Button>
                </div>

                {sandbox.diffs.length === 0 ? (
                  <div className="rounded-[16px] border border-dashed border-white/10 py-6 text-center text-xs text-[color:var(--nfq-text-secondary)]">
                    No changes yet. Add a parameter change to begin.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sandbox.diffs.map((diff, i) => (
                      <DiffCard key={`${diff.parameterPath}-${i}`} diff={diff} index={i} onRemove={handleRemoveDiff} onUpdate={handleUpdateDiff} />
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                <Button
                  onClick={handleComputeImpact}
                  disabled={!canCompute || isComputing}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  {isComputing ? 'Computing...' : 'Compute Impact'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePublish}
                  disabled={!canPublish || publishMutation.isPending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Publish to Governance
                </Button>
              </div>
            </div>
          </Panel>
        )}
      </main>

      {/* --- Right panel: impact preview --- */}
      {sandbox && (sandbox.status === 'ready' || sandbox.status === 'computing') && (
        <aside className="w-[420px] shrink-0 overflow-y-auto">
          <ImpactReportPanel report={impactReport ?? null} isLoading={loadingReport || isComputing} />
        </aside>
      )}
    </div>
  );
};

export default WhatIfWorkspace;
