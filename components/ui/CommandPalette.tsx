import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator, FileText, BarChart4, TrendingUp, GitBranch, Activity, Zap,
  Percent, LayoutDashboard, BrainCircuit, Users, ShieldCheck, BookOpen,
  HeartPulse, Plus, Upload, Moon, Sun, Search, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { viewToPath } from '../../appNavigation';
import type { ViewState } from '../../types';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  category: 'Navigation' | 'Deal' | 'Action';
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const VIEW_ITEMS: { id: ViewState; label: string; icon: LucideIcon }[] = [
  { id: 'CALCULATOR', label: 'Pricing Engine', icon: Calculator },
  { id: 'RAROC', label: 'RAROC Terminal', icon: Percent },
  { id: 'SHOCKS', label: 'Stress Testing', icon: Zap },
  { id: 'BLOTTER', label: 'Deal Blotter', icon: FileText },
  { id: 'ACCOUNTING', label: 'Accounting Ledger', icon: LayoutDashboard },
  { id: 'REPORTING', label: 'FTP Analytics', icon: BarChart4 },
  { id: 'MARKET_DATA', label: 'Yield Curves', icon: TrendingUp },
  { id: 'METHODOLOGY', label: 'Rules & Config', icon: GitBranch },
  { id: 'BEHAVIOURAL', label: 'Behavioural Models', icon: Activity },
  { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit },
  { id: 'USER_MGMT', label: 'User Management', icon: Users },
  { id: 'AUDIT_LOG', label: 'System Audit', icon: ShieldCheck },
  { id: 'HEALTH', label: 'System Health', icon: HeartPulse },
  { id: 'MANUAL', label: 'User Manual', icon: BookOpen },
];

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower.includes(q)) return true;
  // Simple character-by-character fuzzy
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { deals } = useData();
  const { theme, setTheme, setIsImportModalOpen } = useUI();

  // Build command items
  const items = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = VIEW_ITEMS.map((v) => ({
      id: `nav-${v.id}`,
      label: v.label,
      sublabel: 'Navigate',
      icon: v.icon,
      category: 'Navigation' as const,
      action: () => { navigate(viewToPath(v.id)); onClose(); },
    }));

    const dealItems: CommandItem[] = deals.slice(0, 20).map((d) => ({
      id: `deal-${d.id}`,
      label: `${d.id || 'Draft'} — ${d.clientId}`,
      sublabel: `${d.productType} · ${d.currency} ${((d.amount || 0) / 1e6).toFixed(1)}M`,
      icon: FileText,
      category: 'Deal' as const,
      action: () => { navigate(viewToPath('BLOTTER')); onClose(); },
    }));

    const actionItems: CommandItem[] = [
      {
        id: 'action-new-deal',
        label: 'New Deal',
        sublabel: 'Create a new pricing deal',
        icon: Plus,
        category: 'Action' as const,
        action: () => { navigate(viewToPath('BLOTTER')); onClose(); },
      },
      {
        id: 'action-import',
        label: 'Import Data',
        sublabel: 'Universal data import',
        icon: Upload,
        category: 'Action' as const,
        action: () => { setIsImportModalOpen(true); onClose(); },
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        sublabel: 'Toggle color theme',
        icon: theme === 'dark' ? Sun : Moon,
        category: 'Action' as const,
        action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); },
      },
    ];

    return [...navItems, ...actionItems, ...dealItems];
  }, [deals, navigate, onClose, theme, setTheme, setIsImportModalOpen]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return items.filter((i) => i.category !== 'Deal').slice(0, 15);
    return items.filter((i) => fuzzyMatch(i.label, query) || (i.sublabel && fuzzyMatch(i.sublabel, query))).slice(0, 15);
  }, [items, query]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  // Group by category
  const grouped = new Map<string, CommandItem[]>();
  for (const item of filtered) {
    const group = grouped.get(item.category) || [];
    group.push(item);
    grouped.set(item.category, group);
  }

  let itemIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] shadow-[0_25px_80px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--nfq-border-ghost)] px-4 py-3">
          <Search size={16} className="shrink-0 text-[var(--nfq-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search views, deals, actions..."
            className="flex-1 bg-transparent text-sm text-[var(--nfq-text-primary)] outline-none placeholder:text-[var(--nfq-text-faint)]"
          />
          <kbd className="hidden rounded border border-[var(--nfq-border-ghost)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--nfq-text-muted)] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--nfq-text-muted)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category}>
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--nfq-text-faint)]">
                  {category}
                </div>
                {categoryItems.map((item) => {
                  const idx = itemIndex++;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === selectedIndex
                          ? 'bg-[rgba(6,182,212,0.08)] text-[var(--nfq-text-primary)]'
                          : 'text-[var(--nfq-text-secondary)] hover:bg-[var(--nfq-bg-elevated)]'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          idx === selectedIndex ? 'bg-[rgba(6,182,212,0.12)] text-[var(--nfq-accent)]' : 'bg-[var(--nfq-bg-elevated)] text-[var(--nfq-text-muted)]'
                        }`}
                      >
                        <item.icon size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13px] font-medium">{item.label}</div>
                        {item.sublabel && (
                          <div className="truncate text-[11px] text-[var(--nfq-text-muted)]">{item.sublabel}</div>
                        )}
                      </div>
                      {idx === selectedIndex && (
                        <ArrowRight size={14} className="shrink-0 text-[var(--nfq-accent)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-[var(--nfq-border-ghost)] px-4 py-2 text-[10px] text-[var(--nfq-text-faint)]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
};
