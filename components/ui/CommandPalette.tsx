import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator, FileText, BarChart4, TrendingUp, GitBranch, Activity,
  LayoutDashboard, BrainCircuit, Users, ShieldCheck, BookOpen,
  HeartPulse, Plus, Upload, Moon, Sun, Search, ArrowRight, Target,
  Grid3X3, BookOpenCheck, FileSignature, ShieldAlert, User2,
  MessageSquare, Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { viewToPath, buildAuxDestinations } from '../../appNavigation';
import type { ViewState } from '../../types';
import type { CopilotContextSummary } from '../../types/copilot';
import CopilotAskPanel from './CopilotAskPanel';
import type { translations } from '../../translations';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  category: 'navigation' | 'deal' | 'client' | 'action';
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TranslationLabels = typeof translations.en;

function buildViewItems(t: TranslationLabels): { id: ViewState; label: string; icon: LucideIcon }[] {
  return [
    { id: 'CUSTOMER_360',    label: t.navClients,          icon: Users },
    { id: 'CAMPAIGNS',       label: t.navCampaigns,        icon: Target },
    { id: 'TARGET_GRID',     label: t.targetGrid,          icon: Grid3X3 },
    { id: 'CALCULATOR',      label: t.pricingEngine,       icon: Calculator },
    { id: 'BLOTTER',         label: t.dealBlotter,         icon: FileText },
    { id: 'ACCOUNTING',      label: t.auxAccountingLedger, icon: LayoutDashboard },
    { id: 'REPORTING',       label: t.navAnalytics,        icon: BarChart4 },
    { id: 'MARKET_DATA',     label: t.yieldCurves,         icon: TrendingUp },
    { id: 'BEHAVIOURAL',     label: t.behaviouralModels,   icon: Activity },
    { id: 'METHODOLOGY',     label: t.navMethodology,      icon: GitBranch },
    { id: 'MODEL_INVENTORY', label: t.navModelInventory,   icon: BookOpenCheck },
    { id: 'DOSSIERS',        label: t.navDossiers,         icon: FileSignature },
    { id: 'ESCALATIONS',     label: t.auxEscalations,      icon: ShieldAlert },
    { id: 'AI_LAB',          label: t.navAiAssistant,      icon: BrainCircuit },
    { id: 'USER_MGMT',       label: t.userMgmt,            icon: Users },
    { id: 'AUDIT_LOG',       label: t.auditLog,            icon: ShieldCheck },
    { id: 'HEALTH',          label: t.systemHealth,        icon: HeartPulse },
    { id: 'MANUAL',          label: t.manual,              icon: BookOpen },
  ];
}

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
  const [mode, setMode] = useState<'navigate' | 'ask'>('navigate');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { deals, clients } = useData();
  const { theme, setTheme, setIsImportModalOpen, openCustomerDrawer, language, t } = useUI();
  const viewItems = useMemo(() => buildViewItems(t), [t]);
  const auxDestinations = useMemo(() => buildAuxDestinations(t), [t]);
  const categoryLabels = useMemo(
    () => ({
      navigation: t.commandCategoryNavigation,
      deal: t.commandCategoryDeal,
      client: t.commandCategoryClient,
      action: t.commandCategoryAction,
    }),
    [t],
  );

  // Compose the copilot context from the user's surroundings. dealId
  // comes from the Calculator selection (last deal in `deals` array
  // is a heuristic — the real source of truth is dealParams in
  // PricingStateContext, but pulling it here would require a deeper
  // refactor that does not pay off in this sub-block).
  const copilotContext: CopilotContextSummary = useMemo(() => {
    const lastSelected = deals.find((d) => d.id) ?? null;
    return {
      view: undefined,
      snapshotId: undefined,
      dealId: lastSelected?.id ?? undefined,
      oneLine: lastSelected?.id
        ? `Deal ${lastSelected.id} · ${lastSelected.productType ?? '—'}`
        : undefined,
    };
  }, [deals]);

  // Build command items
  const items = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = viewItems.map((v) => ({
      id: `nav-${v.id}`,
      label: v.label,
      sublabel: t.commandNavigateSublabel,
      icon: v.icon,
      category: 'navigation' as const,
      action: () => { navigate(viewToPath(v.id)); onClose(); },
    }));

    // Auxiliary destinations — not in sidebar but reachable via palette
    const auxItems: CommandItem[] = auxDestinations.map((d) => ({
      id: `aux-${d.id}`,
      label: d.label,
      sublabel: d.sublabel,
      icon: d.icon,
      category: 'navigation' as const,
      action: () => { navigate(d.path); onClose(); },
    }));

    // Clients — opens 360 drawer, not full destination
    const clientItems: CommandItem[] = clients.slice(0, 50).map((c) => ({
      id: `client-${c.id}`,
      label: c.name,
      sublabel: `${c.segment ?? t.commandClientFallback} \u00b7 ${c.rating ?? '—'} \u00b7 ${t.commandOpen360Drawer}`,
      icon: User2,
      category: 'client' as const,
      action: () => { openCustomerDrawer(c.id); onClose(); },
    }));

    const dealItems: CommandItem[] = deals.slice(0, 20).map((d) => ({
      id: `deal-${d.id}`,
      label: `${d.id || t.commandDraftDeal} — ${d.clientId}`,
      sublabel: `${d.productType} \u00b7 ${d.currency} ${((d.amount || 0) / 1e6).toFixed(1)}M`,
      icon: FileText,
      category: 'deal' as const,
      action: () => { navigate(viewToPath('BLOTTER')); onClose(); },
    }));

    const actionItems: CommandItem[] = [
      {
        id: 'action-new-deal',
        label: t.commandNewDeal,
        sublabel: t.commandNewDealDesc,
        icon: Plus,
        category: 'action' as const,
        action: () => { navigate(viewToPath('BLOTTER')); onClose(); },
      },
      {
        id: 'action-import',
        label: t.headerImportData,
        sublabel: t.commandImportDataDesc,
        icon: Upload,
        category: 'action' as const,
        action: () => { setIsImportModalOpen(true); onClose(); },
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? t.commandSwitchToLightMode : t.commandSwitchToDarkMode,
        sublabel: t.commandToggleTheme,
        icon: theme === 'dark' ? Sun : Moon,
        category: 'action' as const,
        action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); },
      },
    ];

    return [...navItems, ...auxItems, ...actionItems, ...clientItems, ...dealItems];
  }, [auxDestinations, deals, clients, navigate, onClose, theme, setTheme, setIsImportModalOpen, openCustomerDrawer, t, viewItems]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Empty query: show top navs + actions only (skip long client/deal lists)
      return items.filter((i) => i.category === 'navigation' || i.category === 'action').slice(0, 20);
    }
    return items.filter((i) => fuzzyMatch(i.label, query) || (i.sublabel && fuzzyMatch(i.sublabel, query))).slice(0, 25);
  }, [items, query]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMode('navigate');
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
        className="relative w-full max-w-[540px] overflow-hidden rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] shadow-[0_25px_80px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Tab bar — Navigate vs Ask (Ola 7 Bloque C.3) */}
        <div className="flex items-center gap-1 border-b border-[var(--nfq-border-ghost)] px-2 py-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'navigate'}
            data-testid="palette-tab-navigate"
            onClick={() => setMode('navigate')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-[11px] font-medium transition-colors ${
              mode === 'navigate'
                ? 'bg-[var(--nfq-bg-elevated)] text-[var(--nfq-text-primary)]'
                : 'text-[var(--nfq-text-muted)] hover:text-[var(--nfq-text-secondary)]'
            }`}
          >
            <Compass size={12} /> {t.commandNavigateTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ask'}
            data-testid="palette-tab-ask"
            onClick={() => setMode('ask')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-[11px] font-medium transition-colors ${
              mode === 'ask'
                ? 'bg-[var(--nfq-bg-elevated)] text-cyan-300'
                : 'text-[var(--nfq-text-muted)] hover:text-[var(--nfq-text-secondary)]'
            }`}
          >
            <MessageSquare size={12} /> {t.commandAskTab}
          </button>
        </div>

        {/* Search input — only in Navigate mode */}
        {mode === 'navigate' && (
          <div className="flex items-center gap-3 border-b border-[var(--nfq-border-ghost)] px-4 py-3">
            <Search size={16} className="shrink-0 text-[var(--nfq-text-muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.commandSearchPlaceholder}
              className="flex-1 bg-transparent text-sm text-[var(--nfq-text-primary)] outline-none placeholder:text-[var(--nfq-text-faint)]"
            />
            <kbd className="hidden rounded border border-[var(--nfq-border-ghost)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--nfq-text-muted)] sm:inline-block">
              ESC
            </kbd>
          </div>
        )}

        {/* Ask panel (Ola 7 Bloque C.3) */}
        {mode === 'ask' && (
          <CopilotAskPanel
            context={copilotContext}
            language={language === 'es' ? 'es' : 'en'}
            onClose={onClose}
          />
        )}

        {/* Results — Navigate mode only */}
        {mode === 'navigate' && (
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--nfq-text-muted)]">
              {t.commandNoResults} &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category}>
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--nfq-text-faint)]">
                  {categoryLabels[category as keyof typeof categoryLabels]}
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
        )}

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-[var(--nfq-border-ghost)] px-4 py-2 text-[10px] text-[var(--nfq-text-faint)]">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">↑↓</kbd>
            {t.commandFooterNavigate}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">↵</kbd>
            {t.commandFooterSelect}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--nfq-border-ghost)] px-1 py-0.5 font-mono">esc</kbd>
            {t.commandFooterClose}
          </span>
        </div>
      </div>
    </div>
  );
};
