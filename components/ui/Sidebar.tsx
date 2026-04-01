import React from 'react';
import { ViewState } from '../../types';
import { Logo } from '../ui/Logo';
import { LucideIcon } from 'lucide-react';
import { translations, Language } from '../../translations';

export interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    section?: string; // Section header to show before this item
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
    onClose
}) => {
    const t = translations[language];

    const [latency, setLatency] = React.useState(14);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setLatency(Math.floor(Math.random() * (28 - 12 + 1)) + 12);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const NavButton = ({ item }: { item: NavItem }) => {
        const isUserConfig = item.id === 'USER_CONFIG';

        return (
            <button
                data-testid={`nav-${item.id}`}
                onClick={() => {
                    if (isUserConfig) {
                        onOpenConfig();
                    } else {
                        setCurrentView(item.id as ViewState);
                    }
                    if (window.innerWidth < 768) onClose();
                }}
                aria-current={!isUserConfig && currentView === item.id ? 'page' : undefined}
                className={`w-full flex items-center px-3 py-2.5 rounded-md text-sm transition-all ${!isUserConfig && currentView === item.id
                    ? 'bg-cyan-50 text-cyan-700 border-l-2 border-cyan-600 dark:bg-slate-900 dark:text-white dark:border-cyan-500'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300'
                    }`}
            >
                <item.icon size={18} className={!isUserConfig && currentView === item.id ? 'text-cyan-600 dark:text-cyan-500' : 'text-slate-500 dark:text-slate-600'} />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.label}</span>}
            </button>
        );
    };

    const SectionHeader = ({ title }: { title: string }) => {
        if (!isSidebarOpen) {
            return <div className="my-2 mx-3 h-px bg-slate-200 dark:bg-slate-800" />;
        }
        return (
            <div className="mt-4 mb-1 px-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-600">
                    {title}
                </span>
            </div>
        );
    };

    // Track which sections we've already rendered
    let lastSection: string | undefined;

    return (
        <>
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-10 md:hidden transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            <div data-testid="sidebar" className={`
                ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full md:translate-x-0'}
                ${isSidebarOpen ? 'fixed md:relative' : 'fixed md:relative'}
                h-full bg-white dark:bg-black border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20 shadow-2xl overflow-hidden
            `}>
                <div className="h-16 flex items-center px-4 border-b border-slate-100 dark:border-slate-900">
                    <Logo className="w-8 h-8 mr-3 shrink-0" />
                    <span className={`font-bold text-xl tracking-tight text-slate-900 dark:text-white transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'hidden md:opacity-0 w-0'}`}>
                        Pricing
                    </span>
                </div>

                {/* Main Menu */}
                <nav role="navigation" aria-label="Main navigation" className="flex-1 p-2 space-y-0.5 mt-2 overflow-y-auto scrollbar-thin">
                    {mainNavItems.map((item) => {
                        const showSection = item.section && item.section !== lastSection;
                        if (item.section) lastSection = item.section;
                        return (
                            <div key={item.id}>
                                {showSection && <SectionHeader title={item.section!} />}
                                <NavButton item={item} />
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom Menu */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-900 space-y-0.5">
                    {bottomNavItems.map((item) => (
                        <div key={item.id}>
                            <NavButton item={item} />
                        </div>
                    ))}
                </div>

                {/* System Status Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-900">
                    {isSidebarOpen ? (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded border border-slate-100 dark:border-slate-800/50">
                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">{t.systemStatus}</div>
                            <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-mono">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                {t.online}
                            </div>
                            <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-0.5 font-mono">{latency}ms latency</div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
