import {
  Activity,
  BarChart4,
  BookOpen,
  BrainCircuit,
  Calculator,
  FileText,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Percent,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { NavItem } from './components/ui/Sidebar';
import { translations } from './translations';

type NavigationLabels = typeof translations.en;

export function buildMainNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'CALCULATOR', label: t.pricingEngine, icon: Calculator, section: 'Pricing' },
    { id: 'RAROC', label: 'RAROC Terminal', icon: Percent, section: 'Pricing' },
    { id: 'SHOCKS', label: t.shocks, icon: Zap, section: 'Pricing' },
    { id: 'BLOTTER', label: t.dealBlotter, icon: FileText, section: 'Portfolio' },
    { id: 'ACCOUNTING', label: t.accountingLedger, icon: LayoutDashboard, section: 'Portfolio' },
    { id: 'REPORTING', label: 'ALM Reporting', icon: BarChart4, section: 'ALM & Risk' },
    { id: 'MARKET_DATA', label: t.yieldCurves, icon: TrendingUp, section: 'ALM & Risk' },
    { id: 'METHODOLOGY', label: 'Rules & Config', icon: GitBranch, section: 'Configuration' },
    { id: 'BEHAVIOURAL', label: t.behaviouralModels, icon: Activity, section: 'Configuration' },
    { id: 'AI_LAB', label: 'AI Assistant', icon: BrainCircuit, section: 'Configuration' },
  ];
}

export function buildBottomNavItems(t: NavigationLabels): NavItem[] {
  return [
    { id: 'USER_CONFIG', label: t.userConfig, icon: Settings },
    { id: 'USER_MGMT', label: t.userMgmt, icon: Users },
    { id: 'AUDIT_LOG', label: t.auditLog, icon: ShieldCheck },
    { id: 'HEALTH', label: t.systemHealth, icon: HeartPulse, section: 'System' },
    { id: 'MANUAL', label: t.manual, icon: BookOpen },
  ];
}
