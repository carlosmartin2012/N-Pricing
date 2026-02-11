import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { ViewState } from '../../types';

interface HeaderProps {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    currentView: ViewState;
    mainNavItems: { id: string; label: string }[];
    bottomNavItems: { id: string; label: string }[];
}

export const Header: React.FC<HeaderProps> = ({
    isSidebarOpen,
    setSidebarOpen,
    currentView,
    mainNavItems,
    bottomNavItems,
}) => {
    const currentLabel =
        mainNavItems.find(n => n.id === currentView)?.label ||
        bottomNavItems.find(n => n.id === currentView)?.label ||
        (currentView === 'AI_LAB' ? 'N Pricing AI Lab' : 'Pricing Engine');

    return (
        <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
                    <Menu size={20} />
                </button>
                <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-widest border-l border-slate-700 pl-4">
                    {currentLabel}
                </h1>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Curve Date</span>
                    <span className="text-xs font-mono text-cyan-400">LIVE (T+0)</span>
                </div>

                <button className="relative text-slate-400 hover:text-white">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                </button>

                <div className="flex items-center gap-3 pl-6 border-l border-slate-700">
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-white">Alex Chen</div>
                        <div className="text-[10px] text-slate-500">Snr. Treasury Mgr</div>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600 text-xs font-bold text-cyan-500">
                        AC
                    </div>
                </div>
            </div>
        </header>
    );
};
