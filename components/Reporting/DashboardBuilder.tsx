import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

// react-grid-layout@2 types export GridLayoutProps (function component)
// but the default export class uses ReactGridLayoutProps. Cast to bypass.
const GridLayout = ReactGridLayout as unknown as React.FC<Record<string, unknown>>;
type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
import {
  BarChart4, FileText, GripVertical, Lock, RotateCcw,
  ShieldCheck, TrendingUp, Unlock, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCoreData } from '../../contexts/DataContext';

// Width measured from parent container

const STORAGE_KEY = 'n_pricing_dashboard_layout';

// ---------------------------------------------------------------------------
// Widget definitions
// ---------------------------------------------------------------------------

interface WidgetDef {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  compute: (deals: DealSummary) => string;
  subtitle: string;
}

interface DealSummary {
  total: number;
  pending: number;
  booked: number;
  rejected: number;
  totalVolume: number;
  avgMargin: number;
  avgRaroc: number;
}

const WIDGETS: WidgetDef[] = [
  {
    id: 'deal_count',
    title: 'Total Deals',
    icon: FileText,
    color: 'var(--nfq-accent)',
    compute: (d) => String(d.total),
    subtitle: 'Live book',
  },
  {
    id: 'pending',
    title: 'Pending Approval',
    icon: ShieldCheck,
    color: 'var(--nfq-warning)',
    compute: (d) => String(d.pending),
    subtitle: 'Approval queue',
  },
  {
    id: 'booked',
    title: 'Booked',
    icon: Lock,
    color: 'var(--nfq-success)',
    compute: (d) => String(d.booked),
    subtitle: 'Settled deals',
  },
  {
    id: 'volume',
    title: 'Portfolio Volume',
    icon: Wallet,
    color: 'var(--nfq-accent)',
    compute: (d) => d.totalVolume >= 1e9 ? `${(d.totalVolume / 1e9).toFixed(1)}B` : `${(d.totalVolume / 1e6).toFixed(1)}M`,
    subtitle: 'Total exposure',
  },
  {
    id: 'avg_margin',
    title: 'Avg Margin',
    icon: TrendingUp,
    color: '#10b981',
    compute: (d) => `${d.avgMargin.toFixed(2)}%`,
    subtitle: 'Weighted average',
  },
  {
    id: 'rejected',
    title: 'Rejected',
    icon: BarChart4,
    color: 'var(--nfq-danger)',
    compute: (d) => String(d.rejected),
    subtitle: 'Needs rework',
  },
];

const DEFAULT_LAYOUT: LayoutItem[] = WIDGETS.map((w, i) => ({
  i: w.id, x: (i % 3) * 4, y: Math.floor(i / 3) * 3, w: 4, h: 3, minW: 3, minH: 2,
}));

function loadLayout(): LayoutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: LayoutItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

// ---------------------------------------------------------------------------
// Widget card component
// ---------------------------------------------------------------------------

const WidgetCard: React.FC<{ def: WidgetDef; value: string; isLocked: boolean }> = ({ def, value, isLocked }) => {
  const Icon = def.icon;
  return (
    <div className="flex h-full flex-col justify-between rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: def.color }} />
          <span className="text-[10px] font-semibold tracking-normal text-[var(--nfq-text-muted)]">
            {def.title}
          </span>
        </div>
        {!isLocked && (
          <GripVertical size={14} className="cursor-grab text-[var(--nfq-text-faint)] active:cursor-grabbing" />
        )}
      </div>
      <div className="mt-2">
        <div className="font-mono text-[28px] font-bold tracking-tight" style={{ color: def.color }}>
          {value}
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--nfq-text-faint)]">{def.subtitle}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard Builder
// ---------------------------------------------------------------------------

export const DashboardBuilder: React.FC = () => {
  const { deals } = useCoreData();
  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout);
  const [isLocked, setIsLocked] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const summary = useMemo<DealSummary>(() => {
    const booked = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
    return {
      total: deals.length,
      pending: deals.filter((d) => d.status === 'Pending_Approval').length,
      booked: booked.length,
      rejected: deals.filter((d) => d.status === 'Rejected').length,
      totalVolume: booked.reduce((s, d) => s + (d.amount || 0), 0),
      avgMargin: booked.length ? booked.reduce((s, d) => s + (d.marginTarget || 0), 0) / booked.length : 0,
      avgRaroc: 0,
    };
  }, [deals]);

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      if (!isLocked) {
        const mutable = [...newLayout];
        setLayout(mutable);
        saveLayout(mutable);
      }
    },
    [isLocked],
  );

  const handleReset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-normal text-[var(--nfq-text-faint)]">
          Custom Dashboard
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-secondary)]"
          >
            <RotateCcw size={10} />
            Reset
          </button>
          <button
            onClick={() => setIsLocked((prev) => !prev)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
              isLocked
                ? 'text-[var(--nfq-text-muted)] hover:bg-[var(--nfq-bg-elevated)]'
                : 'bg-[rgba(6,182,212,0.1)] text-[var(--nfq-accent)]'
            }`}
          >
            {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
            {isLocked ? 'Locked' : 'Editing'}
          </button>
        </div>
      </div>

      <div ref={containerRef}>
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={40}
          width={containerWidth}
          isDraggable={!isLocked}
          isResizable={!isLocked}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".cursor-grab"
          compactType="vertical"
          margin={[12, 12]}
        >
          {WIDGETS.map((widget) => (
            <div key={widget.id}>
              <WidgetCard
                def={widget}
                value={widget.compute(summary)}
                isLocked={isLocked}
              />
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
};
