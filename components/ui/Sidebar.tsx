import React from 'react';
import { ViewState } from '../../types';
import { Logo } from '../ui/Logo';
import { LucideIcon } from 'lucide-react';

interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

interface SidebarProps {
    isSidebarOpen: boolean;
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    mainNavItems: NavItem[];
    bottomNavItems: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    currentView,
    setCurrentView,
    mainNavItems,
    bottomNavItems,
}) => {
    const NavButton = ({ item }: { item: NavItem }) => (
        <button
            onClick={() => setCurrentView(item.id as ViewState)}
            className={`w-full flex items-center px-3 py-3 rounded-md text-sm transition-all ${currentView === item.id
                    ? 'bg-slate-900 text-white border-l-2 border-cyan-500'
                    : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                }`}
        >
            <item.icon size={20} className={currentView === item.id ? 'text-cyan-500' : 'text-slate-600'} />
            {isSidebarOpen && <span className="ml-3 font-medium">{item.label}</span>}
        </button>
    );

    return (
        <div className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-white dark:bg-black border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20 shadow-2xl`}>
            <div className="h-16 flex items-center px-4 border-b border-slate-100 dark:border-slate-900">
                <Logo className="w-8 h-8 mr-3 shrink-0" />
                {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Pricing</span>}
            </div>

            {/* Main Menu */}
            <nav className="flex-1 p-2 space-y-1 mt-4 overflow-y-auto scrollbar-thin">
                {mainNavItems.map((item) => <NavButton key={item.id} item={item} />)}
            </nav>

            {/* Bottom Menu (User & Manual) */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
                {bottomNavItems.map((item) => <NavButton key={item.id} item={item} />)}
            </div>

            {/* System Status Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-900">
                {isSidebarOpen ? (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">System Status</div>
                        <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            CORE: ONLINE
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 font-mono">14ms latency</div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
};
