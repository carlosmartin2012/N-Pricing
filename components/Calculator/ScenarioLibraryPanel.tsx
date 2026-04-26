import React, { useState } from 'react';
import { Archive, Clock, Plus, Save, Trash2 } from 'lucide-react';
import { useScenarioLibrary } from '../../hooks/useScenarioLibrary';
import type { PricingScenario } from './pricingComparisonUtils';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  currentScenarios: PricingScenario[];
  onLoadScenario: (scenario: PricingScenario) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ScenarioLibraryPanel: React.FC<Props> = ({ currentScenarios, onLoadScenario }) => {
  const { savedScenarios, saveScenario, deleteScenario } = useScenarioLibrary();
  const { currentUser } = useAuth();
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const toSave = currentScenarios[0] || { id: '', name: saveName, shocks: { interestRate: 0, liquiditySpread: 0 }, overrides: {} };
    saveScenario({ ...toSave, name: saveName.trim() }, currentUser?.name);
    setSaveName('');
    setShowSaveInput(false);
  };

  return (
    <div className="rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Archive size={14} className="text-[var(--nfq-accent)]" />
          <span className="text-xs font-semibold tracking-normal text-[var(--nfq-text-muted)]">
            Scenario Library
          </span>
        </div>
        <button
          onClick={() => setShowSaveInput((prev) => !prev)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--nfq-accent)] transition-colors hover:bg-[rgba(6,182,212,0.08)]"
        >
          <Save size={12} />
          Save Current
        </button>
      </div>

      {showSaveInput && (
        <div className="mb-3 flex gap-2">
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Scenario name..."
            className="flex-1 rounded-lg border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 py-1.5 text-xs text-[var(--nfq-text-primary)] outline-none focus:border-[var(--nfq-accent)]"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="rounded-lg bg-[rgba(6,182,212,0.12)] px-3 py-1.5 text-[10px] font-semibold text-[var(--nfq-accent)] transition-colors hover:bg-[rgba(6,182,212,0.2)] disabled:opacity-40"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {savedScenarios.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--nfq-text-faint)]">
          No saved scenarios yet. Save your current pricing setup to compare later.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {savedScenarios.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--nfq-bg-elevated)]"
            >
              <button
                onClick={() => onLoadScenario(s)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="truncate text-xs font-medium text-[var(--nfq-text-primary)]">
                  {s.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 font-mono text-[9px] text-[var(--nfq-text-faint)]">
                    <Clock size={9} />
                    {timeAgo(s.savedAt)}
                  </span>
                  {s.shocks.interestRate !== 0 && (
                    <span className="font-mono text-[9px] text-amber-400">
                      IR {s.shocks.interestRate > 0 ? '+' : ''}{s.shocks.interestRate}bp
                    </span>
                  )}
                  {s.savedBy && (
                    <span className="text-[9px] text-[var(--nfq-text-faint)]">by {s.savedBy}</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => deleteScenario(s.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--nfq-text-faint)] opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400"
                title="Delete scenario"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
