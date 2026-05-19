import React, { useEffect, useRef, useState } from 'react';
import { Bell, BriefcaseBusiness, HelpCircle, Languages, LogOut, Menu, Monitor, Moon, Search, Settings2, ShieldCheck, Sun, Upload } from 'lucide-react';
import { useWalkthroughOptional } from '../../contexts/WalkthroughContext';
import { FIRST_LOGIN_TOUR_ID } from '../../constants/walkthroughTours';
import { ViewState, UserProfile } from '../../types';
import type { ThemeMode } from '../../contexts/UIContext';
import { getTranslations, Language } from '../../translations';
import type { DataMode } from '../../utils/dataModeUtils';
import { describeDataModeState } from '../../utils/dataModeUtils';
import { getViewNavigationMeta } from '../../appNavigation';
import { EntitySwitcher } from './EntitySwitcher';
import { NotificationPanel } from './NotificationPanel';
import { OfflineBadge } from './OfflineBadge';
import { PresenceAvatars } from './PresenceAvatars';
import type { PresenceUser } from '../../hooks/usePresenceAwareness';
import type { WorkspaceMode } from '../../contexts/UIContext';

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
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
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
  workspaceMode,
  onWorkspaceModeChange,
}) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const t = getTranslations(language);
  const walkthrough = useWalkthroughOptional();

  // Close user menu on outside click or Escape. Keeps the menu anchored
  // to the avatar without locking it behind aria-hidden boilerplate.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isUserMenuOpen]);
  const currentItem =
    mainNavItems.find((item) => item.id === currentView) ||
    bottomNavItems.find((item) => item.id === currentView) ||
    getViewNavigationMeta(t, currentView);
  const currentLabel = currentItem?.label ?? t.headerWorkspace;
  const currentSection = currentItem?.section;
  const sectionAccent: Record<string, string> = {
    'Relationship Cockpit': 'text-[color:var(--nfq-success)]',
    'Pricing Cockpit': 'text-[color:var(--nfq-accent)]',
    'Data & Ops Hub': 'text-[color:var(--nfq-cat-a)]',
    'Governance Hub': 'text-[color:var(--nfq-cat-d)]',
    Today: 'text-[color:var(--nfq-success)]',
    Assistant:  'text-[color:var(--nfq-cat-g)]',
    System:     'text-[color:var(--nfq-text-muted)]',
  };
  const sectionDot: Record<string, string> = {
    'Relationship Cockpit': 'bg-[var(--nfq-success)]',
    'Pricing Cockpit': 'bg-[var(--nfq-accent)]',
    'Data & Ops Hub': 'bg-sky-400',
    'Governance Hub': 'bg-violet-400',
    Today: 'bg-[var(--nfq-success)]',
    Assistant:  'bg-fuchsia-400',
    System:     'bg-slate-400',
  };
  const ThemeIcon = themeMode === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const nextTheme = (): ThemeMode => {
    if (themeMode === 'dark') return 'light';
    if (themeMode === 'light') return 'system';
    return 'dark';
  };
  const themeLabel = themeMode === 'system' ? t.system : themeMode === 'dark' ? t.dark : t.light;
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
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <button
          data-testid="menu-toggle"
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
        >
          <Menu size={18} />
        </button>

        <div className="hidden h-8 w-px bg-[color:var(--nfq-border-ghost)] md:block" />

        <div className="min-w-[140px] max-w-[280px] shrink min-[1440px]:max-w-[360px]">
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
                <span className="text-[color:var(--nfq-text-tertiary)]">{t.headerWorkspace}</span>
              </>
            ) : (
              <span className="text-[color:var(--nfq-text-tertiary)]">{t.headerWorkspace}</span>
            )}
          </div>
          <div className="truncate text-sm font-medium text-[color:var(--nfq-text-primary)] md:text-base">
            {currentLabel}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden md:gap-3">
        {/* R2: Consolidated data-mode chip. Was previously 2 elements
            (describer pill + DEMO/LIVE switcher with DATA_MODE label).
            One toggle button now carries the dot + label + click-to-flip
            semantics. Shown from min-[1280px]; below that the user menu
            (avatar dropdown) carries the toggle. */}
        <button
          type="button"
          onClick={() => onDataModeChange(dataMode === 'demo' ? 'live' : 'demo')}
          title={dataModeState.detail}
          className="hidden items-center gap-2 rounded-full bg-[var(--nfq-bg-elevated)] px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:bg-[var(--nfq-bg-bright)] min-[1280px]:inline-flex"
        >
          <span className={`h-2 w-2 rounded-full ${
            dataModeState.accent === 'emerald'
              ? 'bg-[var(--nfq-success)]'
              : dataModeState.accent === 'amber'
                ? 'bg-[var(--nfq-warning)]'
                : 'bg-[var(--nfq-danger)]'
          }`} />
          <span className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${dataModeBadgeClass}`}>
            {dataModeState.badgeLabel}
          </span>
        </button>

        {/* R2: Search button kept ONLY as Cmd+K discovery affordance. Show
            from min-[1440px] (previously: same breakpoint). Functionality
            unchanged. */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            aria-label={t.headerSearchTitle}
            className="hidden items-center gap-2 rounded-full bg-[var(--nfq-bg-elevated)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:text-[color:var(--nfq-text-primary)] min-[1440px]:flex"
            title={t.headerSearchTitle}
          >
            <Search size={14} />
            <span>{t.headerSearch}</span>
            <kbd className="ml-1 rounded border border-[var(--nfq-border-ghost)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
              {'\u2318'}K
            </kbd>
          </button>
        )}

        {/* R2/R3: Language toggle moved into the user-menu dropdown
            (avatar > Language). Most users set this once per workspace. */}

        <OfflineBadge
          pendingCount={offlinePendingCount}
          isSyncing={offlineIsSyncing}
          onSync={onOfflineSync ?? (() => undefined)}
        />
        {onlineUsers && onlineUsers.length > 0 && (
          <>
            <PresenceAvatars users={onlineUsers} />
            <span className="ml-1 rounded-full bg-[var(--nfq-success)]/15 px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--nfq-success)]">
              {onlineUsers.length} live
            </span>
          </>
        )}

        {/* R3: Persona mode switcher moved into user-menu dropdown (avatar).
            The 3-button cluster (Trader / Risk / Admin) used to live here
            full-width; users now switch perspectives from the menu instead. */}

        {entityLabels && <EntitySwitcher labels={entityLabels} />}

        {/* R3: Theme + Help moved into user-menu dropdown (avatar). */}

        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            aria-label={t.headerNotifications}
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
          title={t.headerImportData}
          aria-label={t.headerImportData}
        >
          <Upload size={14} />
          <span className="hidden min-[1440px]:inline">{t.headerImportData}</span>
        </button>

        {/* R3: User menu — avatar now triggers a dropdown that holds the
            settings that were previously rendered as standalone topbar
            chips (Theme, Language, Replay Tour). Logout sits at the
            bottom. Click-outside + Escape close the menu. */}
        <div ref={userMenuRef} className="relative">
          <button
            data-testid="user-menu-trigger"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            className="flex items-center gap-3 rounded-full bg-[var(--nfq-bg-elevated)] px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] transition-colors hover:bg-[var(--nfq-bg-bright)]"
          >
            <span className="hidden max-w-[160px] text-right md:block">
              <span className="block truncate text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {user?.name || 'Guest User'}
              </span>
              <span className="block truncate text-[10px] text-[color:var(--nfq-text-muted)]">
                {user?.role || 'Visitor'} / {user?.department || 'External'}
              </span>
            </span>
            <span
              className="flex h-7 w-9 items-center justify-center rounded-full bg-[color:rgba(var(--nfq-accent-rgb),0.14)] text-xs font-bold text-[color:var(--nfq-accent)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.18)]"
              aria-hidden="true"
            >
              {userInitials}
            </span>
          </button>
          {isUserMenuOpen && (
            <div
              role="menu"
              aria-label={user?.name || 'User menu'}
              className="absolute right-0 top-[calc(100%+8px)] z-[60] w-64 overflow-hidden rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] shadow-[var(--nfq-shadow-dialog)] ring-1 ring-[color:var(--nfq-border-ghost)]"
            >
              <div className="border-b border-[color:var(--nfq-border-ghost)] px-3 py-3">
                <div className="truncate text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                  {user?.name || 'Guest User'}
                </div>
                <div className="truncate text-[11px] text-[color:var(--nfq-text-muted)]">
                  {user?.email || ''}
                </div>
                <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-faint)]">
                  {user?.role || 'Visitor'} · {user?.department || 'External'}
                </div>
              </div>

              <div className="p-1">
                {/* Theme cycle */}
                <button
                  role="menuitem"
                  onClick={() => setTheme(nextTheme())}
                  className="flex w-full items-center justify-between gap-2 rounded-[var(--nfq-radius-md)] px-3 py-2 text-left text-[13px] text-[color:var(--nfq-text-primary)] transition-colors hover:bg-[var(--nfq-bg-bright)]"
                >
                  <span className="flex items-center gap-2">
                    <ThemeIcon size={14} className="text-[color:var(--nfq-text-muted)]" />
                    {t.theme}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--nfq-text-muted)]">
                    {themeLabel}
                  </span>
                </button>

                {/* Language toggle */}
                <button
                  role="menuitem"
                  onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                  className="flex w-full items-center justify-between gap-2 rounded-[var(--nfq-radius-md)] px-3 py-2 text-left text-[13px] text-[color:var(--nfq-text-primary)] transition-colors hover:bg-[var(--nfq-bg-bright)]"
                >
                  <span className="flex items-center gap-2">
                    <Languages size={14} className="text-[color:var(--nfq-text-muted)]" />
                    {t.language}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--nfq-text-muted)]">
                    {language}
                  </span>
                </button>

                {/* Replay tour */}
                {walkthrough && (
                  <button
                    data-testid="header-tour-btn"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      walkthrough.startTour(FIRST_LOGIN_TOUR_ID);
                    }}
                    className="flex w-full items-center gap-2 rounded-[var(--nfq-radius-md)] px-3 py-2 text-left text-[13px] text-[color:var(--nfq-text-primary)] transition-colors hover:bg-[var(--nfq-bg-bright)]"
                  >
                    <HelpCircle size={14} className="text-[color:var(--nfq-text-muted)]" />
                    {t.walkthrough_replay ?? 'Replay product tour'}
                  </button>
                )}
              </div>

              {/* Workspace mode (persona) — moved here from topbar so the
                  3-button cluster does not consume permanent horizontal
                  space. Current mode shown via active-state ring. */}
              <div className="border-t border-[color:var(--nfq-border-ghost)] p-1">
                <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-faint)]">
                  {t.workspaceMode}
                </div>
                {([
                  { id: 'Trader' as const, icon: BriefcaseBusiness, label: t.workspaceModeTrader },
                  { id: 'Risk' as const, icon: ShieldCheck, label: t.workspaceModeRisk },
                  { id: 'Admin' as const, icon: Settings2, label: t.workspaceModeAdmin },
                ]).map(({ id, icon: Icon, label }) => {
                  const active = workspaceMode === id;
                  return (
                    <button
                      key={id}
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => onWorkspaceModeChange(id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-[var(--nfq-radius-md)] px-3 py-2 text-left text-[13px] transition-colors ${
                        active
                          ? 'bg-[color:rgba(var(--nfq-accent-rgb),0.10)] text-[color:var(--nfq-accent)]'
                          : 'text-[color:var(--nfq-text-primary)] hover:bg-[var(--nfq-bg-bright)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={14} className={active ? '' : 'text-[color:var(--nfq-text-muted)]'} />
                        {label}
                      </span>
                      {active && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--nfq-accent)]">
                          ●
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[color:var(--nfq-border-ghost)] p-1">
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--nfq-radius-md)] px-3 py-2 text-left text-[13px] text-[color:var(--nfq-danger)] transition-colors hover:bg-[var(--nfq-danger-subtle)]"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
