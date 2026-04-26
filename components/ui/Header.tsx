import React, { useState } from 'react';
import { Bell, HelpCircle, Languages, Menu, Monitor, Moon, Search, Sun, Upload } from 'lucide-react';
import { useWalkthroughOptional } from '../../contexts/WalkthroughContext';
import { FIRST_LOGIN_TOUR_ID } from '../../constants/walkthroughTours';
import { ViewState, UserProfile } from '../../types';
import type { ThemeMode } from '../../contexts/UIContext';
import { getTranslations, Language } from '../../translations';
import type { DataMode } from '../../utils/dataModeUtils';
import { describeDataModeState } from '../../utils/dataModeUtils';
import { EntitySwitcher } from './EntitySwitcher';
import { NotificationPanel } from './NotificationPanel';
import { OfflineBadge } from './OfflineBadge';
import { PresenceAvatars } from './PresenceAvatars';
import type { PresenceUser } from '../../hooks/usePresenceAwareness';

interface HeaderProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentView: ViewState;
  mainNavItems: { id: string; label: string; section?: string }[];
  bottomNavItems: { id: string; label: string; section?: string }[];
  theme: 'dark' | 'light';
  themeMode?: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  user: UserProfile | null;
  onLogout: () => void;
  onOpenImport: () => void;
  entityLabels?: { entitySwitcher: string; groupScope: string; activeEntity: string; allEntities: string };
  onlineUsers?: PresenceUser[];
  offlinePendingCount?: number;
  offlineIsSyncing?: boolean;
  onOfflineSync?: () => void;
  /** Opens the global command palette (\u2318K) */
  onOpenCommandPalette?: () => void;
  dataMode: DataMode;
  syncStatus: 'idle' | 'mock' | 'synced' | 'error';
  onDataModeChange: (mode: DataMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setSidebarOpen,
  currentView,
  mainNavItems,
  bottomNavItems,
  theme,
  setTheme,
  language,
  setLanguage,
  user,
  onLogout,
  onOpenImport,
  entityLabels,
  onlineUsers,
  themeMode = theme,
  offlinePendingCount = 0,
  offlineIsSyncing = false,
  onOfflineSync,
  onOpenCommandPalette,
  dataMode,
  syncStatus,
  onDataModeChange,
}) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const t = getTranslations(language);
  const walkthrough = useWalkthroughOptional();
  const currentItem =
    mainNavItems.find((item) => item.id === currentView) ||
    bottomNavItems.find((item) => item.id === currentView);
  const currentLabel = currentItem?.label ?? 'Workspace';
  const currentSection = currentItem?.section;
  const sectionAccent: Record<string, string> = {
    Commercial: 'text-[color:var(--nfq-success)]',
    Pricing:    'text-[color:var(--nfq-accent)]',
    Insights:   'text-[color:var(--nfq-warning)]',
    Governance: 'text-violet-300',
    Assistant:  'text-fuchsia-300',
    System:     'text-slate-400',
  };
  const sectionDot: Record<string, string> = {
    Commercial: 'bg-[var(--nfq-success)]',
    Pricing:    'bg-[var(--nfq-accent)]',
    Insights:   'bg-[var(--nfq-warning)]',
    Governance: 'bg-violet-400',
    Assistant:  'bg-fuchsia-400',
    System:     'bg-slate-400',
  };
  const ThemeIcon = themeMode === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const nextTheme = (): ThemeMode => {
    if (themeMode === 'dark') return 'light';
    if (themeMode === 'light') return 'system';
    return 'dark';
  };
  const themeLabel = themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light';
  const dataModeState = describeDataModeState({ dataMode, syncStatus });
  const dataModeBadgeClass =
    dataModeState.accent === 'emerald'
      ? 'text-[color:var(--nfq-success)]'
      : dataModeState.accent === 'amber'
        ? 'text-[color:var(--nfq-warning)]'
        : 'text-[color:var(--nfq-danger)]';
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'GU';

  return (
    <header
      data-testid="header"
      role="banner"
      className="nfq-topbar sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--nfq-border-ghost)] px-4 md:px-5 xl:px-6"
      style={{ height: 'var(--nfq-topbar-height)', background: 'var(--nfq-bg-surface)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          data-testid="menu-toggle"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
        >
          <Menu size={18} />
        </button>

        <div className="hidden h-8 w-px bg-[color:var(--nfq-border-ghost)] md:block" />

        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em]">
            {currentSection ? (
              <>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${sectionDot[currentSection] ?? 'bg-slate-400'}`}
                  aria-hidden="true"
                />
                <span className={sectionAccent[currentSection] ?? 'text-[color:var(--nfq-text-tertiary)]'}>
                  {currentSection}
                </span>
                <span className="text-[color:var(--nfq-text-faint)]">{'\u203a'}</span>
                <span className="text-[color:var(--nfq-text-tertiary)]">Workspace</span>
              </>
            ) : (
              <span className="text-[color:var(--nfq-text-tertiary)]">Workspace</span>
            )}
          </div>
          <div className="truncate text-sm font-medium text-[color:var(--nfq-text-primary)] md:text-base">
            {currentLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-3 rounded-full bg-[var(--nfq-bg-elevated)] px-4 py-2 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] xl:flex">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_6px_rgba(16,185,129,0.08)] ${
              dataModeState.accent === 'emerald'
                ? 'bg-[var(--nfq-success)]'
                : dataModeState.accent === 'amber'
                  ? 'bg-[var(--nfq-warning)]'
                  : 'bg-[var(--nfq-danger)]'
            }`} />
            <span className={`font-mono text-[12px] font-medium uppercase tracking-[0.16em] ${dataModeBadgeClass}`}>
              {dataModeState.badgeLabel}
            </span>
          </div>
          <span className="text-xs text-[color:var(--nfq-text-secondary)]">{dataModeState.detail}</span>
        </div>

        <div className="hidden items-center gap-1 rounded-full bg-[var(--nfq-bg-elevated)] p-1 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] lg:flex">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--nfq-text-muted)]">{t.dataMode}</span>
          <button
            type="button"
            onClick={() => onDataModeChange('demo')}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              dataMode === 'demo'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {t.demo}
          </button>
          <button
            type="button"
            onClick={() => onDataModeChange('live')}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              dataMode === 'live'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
            }`}
          >
            {t.live}
          </button>
        </div>

        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            aria-label="Open command palette"
            className="hidden items-center gap-2 rounded-full bg-[var(--nfq-bg-elevated)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)] md:flex"
            title="Search views, clients, deals, snapshots (\u2318K)"
          >
            <Search size={14} />
            <span>Search{'\u2026'}</span>
            <kbd className="ml-1 rounded border border-[var(--nfq-border-ghost)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
              {'\u2318'}K
            </kbd>
          </button>
        )}

        <button
          onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
          className="hidden h-10 items-center gap-2 rounded-full bg-[var(--nfq-bg-elevated)] px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)] md:inline-flex"
          title={t.language}
        >
          <Languages size={14} />
          {language}
        </button>

        <OfflineBadge
          pendingCount={offlinePendingCount}
          isSyncing={offlineIsSyncing}
          onSync={onOfflineSync ?? (() => undefined)}
        />
        {onlineUsers && onlineUsers.length > 0 && <PresenceAvatars users={onlineUsers} />}
        {entityLabels && <EntitySwitcher labels={entityLabels} />}

        <button
          onClick={() => setTheme(nextTheme())}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          title={`${t.theme}: ${themeLabel}`}
        >
          <ThemeIcon size={16} />
        </button>

        {walkthrough && (
          <button
            data-testid="header-tour-btn"
            onClick={() => walkthrough.startTour(FIRST_LOGIN_TOUR_ID)}
            aria-label={t.walkthrough_replay ?? 'Replay product tour'}
            title={t.walkthrough_replay ?? 'Replay product tour'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-accent)]"
          >
            <HelpCircle size={17} />
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={isNotificationOpen}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            <Bell size={17} />
          </button>
          <NotificationPanel
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
          />
        </div>

        <button
          onClick={onOpenImport}
          className="nfq-button nfq-button-primary px-4 text-[11px] uppercase tracking-[0.14em]"
          title="Universal Data Import"
          aria-label="Universal Data Import"
        >
          <Upload size={14} />
          <span className="hidden lg:inline">Import Data</span>
        </button>

        <div className="ml-1 flex items-center gap-3 rounded-full bg-[var(--nfq-bg-elevated)] px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)]">
          <div className="hidden max-w-[160px] text-right md:block">
            <div className="truncate text-xs font-semibold text-[color:var(--nfq-text-primary)]">
              {user?.name || 'Guest User'}
            </div>
            <div className="truncate text-[10px] text-[color:var(--nfq-text-muted)]">
              {user?.role || 'Visitor'} / {user?.department || 'External'}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex h-7 w-9 items-center justify-center rounded-full bg-[color:rgba(var(--nfq-accent-rgb),0.14)] text-xs font-bold text-[color:var(--nfq-accent)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.18)] transition-transform hover:scale-[1.03]"
            title="Logout"
          >
            {userInitials}
          </button>
        </div>
      </div>
    </header>
  );
};
