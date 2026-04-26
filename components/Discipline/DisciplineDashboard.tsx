import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, Filter, BarChart3, AlertTriangle, User, Shield, FileWarning } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import {
  useDisciplineKpisQuery,
  useVariancesQuery,
  useToleranceBandsQuery,
  useOriginatorScorecardQuery,
} from '../../hooks/queries/useDisciplineQueries';
import type { DisciplineFilters, DateRange, Cohort, DealVariance } from '../../types';

import DisciplineKpiCards from './DisciplineKpiCards';
import LeakageByDimensionChart from './LeakageByDimensionChart';
import VarianceDistributionChart from './VarianceDistributionChart';
import OutlierTable from './OutlierTable';
import CohortDrilldownModal from './CohortDrilldownModal';
import OriginatorScorecardComponent from './OriginatorScorecard';
import ToleranceBandEditor from './ToleranceBandEditor';
import PricingExceptionForm from './PricingExceptionForm';

// ---------------------------------------------------------------------------
// Date preset helpers
// ---------------------------------------------------------------------------

type DatePreset = 'today' | 'week' | 'month' | 'quarter' | 'custom';

function computeDateRange(preset: DatePreset, custom: DateRange): DateRange {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(now);

  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: fmt(d), to };
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return { from: fmt(d), to };
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to };
    }
    case 'custom':
      return custom;
  }
}

const PRESET_LABELS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7d' },
  { value: 'month', label: 'Last 30d' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'custom', label: 'Custom' },
];

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type Tab = 'leakage' | 'distribution' | 'outliers' | 'scorecards' | 'bands' | 'exceptions';

const TABS: { value: Tab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { value: 'leakage', label: 'Leakage', icon: BarChart3 },
  { value: 'distribution', label: 'Distribution', icon: BarChart3 },
  { value: 'outliers', label: 'Outliers', icon: AlertTriangle },
  { value: 'scorecards', label: 'Scorecards', icon: User },
  { value: 'bands', label: 'Tolerance Bands', icon: Shield },
  { value: 'exceptions', label: 'Exceptions', icon: FileWarning },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DisciplineDashboard: React.FC = () => {
  const { t } = useUI();
  const { activeEntity } = useEntity();

  // Filters
  const [preset, setPreset] = useState<DatePreset>('month');
  const [customRange, setCustomRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');

  const dateRange = useMemo(() => computeDateRange(preset, customRange), [preset, customRange]);

  const filters = useMemo<DisciplineFilters>(() => ({
    entityId: activeEntity?.id,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    currencies: currencyFilter ? [currencyFilter] : undefined,
    products: productFilter ? [productFilter] : undefined,
    segments: segmentFilter ? [segmentFilter] : undefined,
  }), [activeEntity?.id, dateRange, currencyFilter, productFilter, segmentFilter]);

  // Queries
  const { data: kpis, isLoading: kpisLoading } = useDisciplineKpisQuery(filters);
  const { data: variancesPage, isLoading: variancesLoading } = useVariancesQuery(
    { ...filters, sortBy: 'leakage', sortDir: 'desc' },
    { page: 1, pageSize: 500 },
  );
  const { data: bands = [] } = useToleranceBandsQuery(activeEntity?.id);

  const variances: DealVariance[] = variancesPage?.data ?? [];

  // Average tolerance for distribution chart
  const avgToleranceBps = useMemo(() => {
    const activeBands = bands.filter((b) => b.active);
    if (activeBands.length === 0) return 20;
    return Math.round(activeBands.reduce((s, b) => s + b.ftpBpsTolerance, 0) / activeBands.length);
  }, [bands]);

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('leakage');

  // Cohort drilldown modal
  const [drilldownCohort, setDrilldownCohort] = useState<Cohort | null>(null);

  // Exception form
  const [exceptionDealId, setExceptionDealId] = useState<string | null>(null);

  // Originator scorecard
  const [selectedOriginatorId, setSelectedOriginatorId] = useState('');
  const { data: scorecard = null, isLoading: scorecardLoading } = useOriginatorScorecardQuery(
    selectedOriginatorId,
    dateRange,
  );

  // Derive unique originators from variances for the selector
  const originatorIds = useMemo(() => {
    const seen = new Set<string>();
    for (const v of variances) {
      if (v.cohort.entityId) seen.add(v.cohort.entityId);
    }
    return Array.from(seen);
  }, [variances]);

  const handleDealClick = useCallback((dealId: string) => {
    // Also open cohort drilldown for the clicked deal
    const match = variances.find((v) => v.dealId === dealId);
    if (match) {
      setDrilldownCohort(match.cohort);
    }
    setExceptionDealId(dealId);
    setActiveTab('exceptions');
  }, [variances]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* ── Header & Filters ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="nfq-eyebrow">Pricing Discipline</div>
          <h1 className="mt-2 text-xl font-semibold tracking-[var(--nfq-tracking-snug)] text-[color:var(--nfq-text-primary)]">
            Gap Analytics & Leakage Monitor
          </h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Date range presets */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-0.5">
            {PRESET_LABELS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-mono tracking-normal transition-colors ${
                  preset === p.value
                    ? 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-primary)]'
                    : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                className="nfq-input-field w-auto text-xs"
              />
              <span className="text-[10px] text-[color:var(--nfq-text-muted)]">to</span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                className="nfq-input-field w-auto text-xs"
              />
            </div>
          )}

          {/* Dimension filters */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[color:var(--nfq-text-muted)]" />
            <input
              type="text"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value.toUpperCase())}
              placeholder="CCY"
              maxLength={3}
              className="nfq-input-field w-16 text-xs"
            />
            <input
              type="text"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="Product"
              className="nfq-input-field w-24 text-xs"
            />
            <input
              type="text"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              placeholder="Segment"
              className="nfq-input-field w-24 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <DisciplineKpiCards
        kpis={kpis ?? { totalDeals: 0, inBandCount: 0, inBandPct: 0, outOfBandCount: 0, totalLeakageEur: 0, leakageTrend: 0, avgFtpVarianceBps: 0, avgRarocVariancePp: 0 }}
        isLoading={kpisLoading}
      />

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[11px] font-mono tracking-normal transition-colors ${
                activeTab === tab.value
                  ? 'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-primary)]'
                  : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="min-h-0 flex-1">
        {activeTab === 'leakage' && (
          <LeakageByDimensionChart
            variances={variances}
            isLoading={variancesLoading}
          />
        )}

        {activeTab === 'distribution' && (
          <VarianceDistributionChart
            variances={variances}
            toleranceBps={avgToleranceBps}
          />
        )}

        {activeTab === 'outliers' && (
          <OutlierTable
            variances={variances}
            onDealClick={handleDealClick}
          />
        )}

        {activeTab === 'scorecards' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-medium text-[color:var(--nfq-text-secondary)]">
                Originator
              </label>
              {originatorIds.length > 0 ? (
                <select
                  value={selectedOriginatorId}
                  onChange={(e) => setSelectedOriginatorId(e.target.value)}
                  className="nfq-select-field w-48 text-xs"
                >
                  <option value="">Select originator...</option>
                  {originatorIds.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedOriginatorId}
                  onChange={(e) => setSelectedOriginatorId(e.target.value)}
                  placeholder="Enter originator ID"
                  className="nfq-input-field w-48 text-xs"
                />
              )}
            </div>
            <OriginatorScorecardComponent
              scorecard={scorecard}
              isLoading={scorecardLoading}
            />
          </div>
        )}

        {activeTab === 'bands' && (
          <ToleranceBandEditor />
        )}

        {activeTab === 'exceptions' && (
          exceptionDealId ? (
            <PricingExceptionForm
              dealId={exceptionDealId}
              onSubmit={() => setExceptionDealId(null)}
              onCancel={() => setExceptionDealId(null)}
            />
          ) : (
            <div className="nfq-kpi-card flex items-center justify-center py-12">
              <div className="text-center">
                <FileWarning size={32} className="mx-auto mb-3 text-[color:var(--nfq-text-muted)]" />
                <p className="text-xs text-[color:var(--nfq-text-muted)]">
                  Click on an outlier deal from the Outliers tab to create a pricing exception.
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Cohort Drilldown Modal ── */}
      <CohortDrilldownModal
        isOpen={drilldownCohort !== null}
        onClose={() => setDrilldownCohort(null)}
        cohort={drilldownCohort}
        dateRange={dateRange}
      />
    </div>
  );
};

export default DisciplineDashboard;
