import React from 'react';
import { Menu, Bell, Sun, Moon, Languages } from 'lucide-react';
import { ViewState, UserProfile } from '../../types';
import { translations, Language } from '../../translations';

interface HeaderProps {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    currentView: ViewState;
    mainNavItems: { id: string; label: string }[];
    bottomNavItems: { id: string; label: string }[];
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    user: UserProfile | null;
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
}) => {
    const t = translations[language];

    const currentLabel =
        mainNavItems.find(n => n.id === currentView)?.label ||
        bottomNavItems.find(n => n.id === currentView)?.label ||
        (currentView === 'AI_LAB' ? t.aiLab : t.pricingEngine);

    return (
        <header className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 transition-colors duration-300">
            <div className="flex items-center gap-2 md:gap-4">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
                    <Menu size={20} />
                </button>



                <h1 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 pl-3 md:pl-4 truncate max-w-[120px] md:max-w-none">
                    {currentLabel}
                </h1>
            </div>

            <div className="flex items-center gap-3 md:gap-6">
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{t.curveDate}</span>
                    <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">{t.live}</span>
                </div>

                <button className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
                </button>

                <div className="flex items-center gap-2 md:gap-3 md:pl-6 md:border-l border-slate-200 dark:border-slate-700">
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{user?.name || 'Guest User'}</div>
                        <div className="text-[10px] text-slate-500">{user?.role || 'Visitor'} / {user?.department || 'External'}</div>
                    </div>
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-600 text-xs font-bold text-cyan-600 dark:text-cyan-500">
                        {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GU'}
                    </div>
                </div>
            </div>
        </header>
    );
};
