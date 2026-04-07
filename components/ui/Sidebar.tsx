import React from 'react';
import { LucideIcon } from 'lucide-react';
import { ViewState } from '../../types';
import { translations, Language } from '../../translations';
import { Logo } from './Logo';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  mainNavItems: NavItem[];
  bottomNavItems: NavItem[];
  onOpenConfig: () => void;
  language: Language;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  currentView,
  setCurrentView,
  mainNavItems,
  bottomNavItems,
  onOpenConfig,
  language,
  onClose,
}) => {
  const t = translations[language];
  const [latency, setLatency] = React.useState(14);
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setLatency(Math.floor(Math.random() * (28 - 12 + 1)) + 12);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const NavButton = ({ item }: { item: NavItem }) => {
    const isUserConfig = item.id === 'USER_CONFIG';
    const isActive = !isUserConfig && currentView === item.id;

    return (
      <button
        data-testid={`nav-${item.id}`}
        onClick={() => {
          console.log('[NAV] Clicked:', item.id, 'isUserConfig:', isUserConfig);
          if (isUserConfig) {
            onOpenConfig();
          } else {
            console.log('[NAV] Setting view to:', item.id);
            setCurrentView(item.id as ViewState);
          }
          if (window.innerWidth < 768) onClose();
        }}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
          isActive
            ? 'text-[color:var(--nfq-text-primary)]'
            : 'text-[color:var(--nfq-text-secondary)] hover:text-[color:var(--nfq-text-primary)] hover:bg-[color:rgba(255,255,255,0.03)]'
        }`}
      >
        {/* Left accent pill for active item */}
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-full bg-[var(--nfq-accent)]"
            aria-hidden="true"
          />
        )}
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors duration-200 ${
            isActive
              ? 'text-[color:var(--nfq-accent)]'
              : 'text-[color:var(--nfq-text-muted)] group-hover:text-[color:var(--nfq-text-secondary)]'
          }`}
        >
          <item.icon size={18} />
        </span>
        {isSidebarOpen && (
          <span
            className={`flex-1 truncate text-left text-[14px] font-medium tracking-normal transition-colors duration-200 ${
              isActive
                ? 'text-[color:var(--nfq-text-primary)]'
                : 'text-[color:var(--nfq-text-secondary)]'
            }`}
          >
            {item.label}
          </span>
        )}
      </button>
    );
  };

  let lastSection: string | undefined;

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        data-testid="sidebar"
        className={`nfq-sidebar ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full md:translate-x-0'
        } ${isSidebarOpen ? 'fixed md:relative' : 'fixed md:relative'} z-20 flex h-full flex-col overflow-hidden border-r border-[color:var(--nfq-border-ghost)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`}
      >
        {/* Brand header */}
        <div className="px-3 py-5">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:rgba(var(--nfq-accent-rgb),0.12)]">
              <Logo className="h-6 w-6" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <div className="nfq-section-label">NFQ Advisory</div>
                <div className="truncate text-[15px] font-semibold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                  N Pricing
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main navigation */}
        <nav role="navigation" aria-label="Main navigation" data-tour="sidebar-nav" className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            {mainNavItems.map((item) => {
              const showSection = item.section && item.section !== lastSection;
              if (item.section) lastSection = item.section;

              return (
                <div key={item.id}>
                  {showSection && isSidebarOpen && (
                    <div className="px-3 pb-1.5 pt-6">
                      <span className="nfq-section-label">{item.section}</span>
                    </div>
                  )}
                  {showSection && !isSidebarOpen && (
                    <div className="my-4" />
                  )}
                  <NavButton item={item} />
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom navigation -- separated by spacing, not a card */}
        <nav aria-label="Utility navigation" className="mt-6 px-2 pb-2 space-y-0.5">
          {bottomNavItems.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>

        {/* Status indicator */}
        <div className="px-3 pb-4 pt-2">
          {isSidebarOpen ? (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-[color:var(--nfq-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--nfq-success)] shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" />
                {t.online}
              </div>
              <span className="font-mono-nums text-xs text-[color:var(--nfq-accent)]">{latency}ms</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="h-2 w-2 rounded-full bg-[var(--nfq-success)] shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
