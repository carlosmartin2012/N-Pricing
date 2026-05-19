import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users2, Upload, Layers, TrendingUp, History, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useEntity } from '../../contexts/EntityContext';
import { useData } from '../../contexts/DataContext';
import CustomerRelationshipPanel from './CustomerRelationshipPanel';
import LtvProjectionCard from './LtvProjectionCard';
import ClientTimeline from './ClientTimeline';
import NbaRecommendationCard from './NbaRecommendationCard';

type CustomerTab = 'snapshot' | 'ltv' | 'timeline' | 'nba';

const TABS: Array<{ id: CustomerTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'snapshot', label: 'Snapshot', icon: Layers },
  { id: 'ltv',      label: 'LTV projection', icon: TrendingUp },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'nba',      label: 'Next-Best-Action', icon: Sparkles },
];

/**
 * Customer Pricing — full-page view that lets a banker:
 *   1. Browse / search the entity's clients (sourced from DataContext)
 *   2. See a single client's full relationship panel + applicable targets
 *
 * Cohabits with the existing client-related screens; this is the relational
 * lens promised by Phase 1, not a replacement for the per-deal calculator.
 */

const CustomerPricingView: React.FC = () => {
  const { activeEntity } = useEntity();
  const { clients } = useData();
  const [searchParams] = useSearchParams();
  const presetId = searchParams.get('id');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(presetId);
  const [activeTab, setActiveTab] = useState<CustomerTab>('snapshot');

  useEffect(() => {
    // Preset wins on first load; fall back to first client
    if (presetId && selectedId !== presetId) {
      setSelectedId(presetId);
      return;
    }
    if (selectedId === null && clients.length > 0) {
      setSelectedId(clients[0].id);
    }
  }, [clients, selectedId, presetId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.segment ?? '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users2 className="h-5 w-5 text-[color:var(--nfq-success)]" />
          <h1 className="nfq-headline">
            Customer Pricing
          </h1>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-[color:var(--nfq-text-muted)]">{activeEntity.shortCode}</span>
          )}
        </div>
        <a
          href="/api/customer360/import/positions"
          onClick={(e) => e.preventDefault()}
          title="POST a CSV body to /api/customer360/import/positions"
          className="nfq-button nfq-button-ghost flex items-center gap-2 px-3 py-1.5 text-xs"
        >
          <Upload className="h-3 w-3" />
          Import positions (CSV)
        </a>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--nfq-text-faint)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] py-2 pl-8 pr-3 font-mono text-xs text-[color:var(--nfq-text-primary)] placeholder:text-[color:var(--nfq-text-faint)] focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
            {filtered.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'border-emerald-400/50 bg-emerald-400/5'
                        : 'border-[color:var(--nfq-border-ghost)] bg-white/[0.02] hover:border-[color:var(--nfq-border-ghost)]'
                    }`}
                  >
                    <div className={`font-medium ${active ? 'text-[color:var(--nfq-text-primary)]' : 'text-[color:var(--nfq-text-secondary)]'}`}>{c.name}</div>
                    <div className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">
                      {c.segment || '—'} · {c.rating || 'BBB'} · {c.id}
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] px-3 py-4 text-center text-xs text-[color:var(--nfq-text-muted)]">
                No clients match.
              </li>
            )}
          </ul>
        </aside>

        <section className="space-y-4">
          {selectedId ? (
            <>
              <nav className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-1">
                {TABS.map(({ id, label, icon: Icon }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-mono tracking-normal transition-colors ${
                        isActive
                          ? 'bg-white/[0.08] text-[color:var(--nfq-text-primary)]'
                          : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-secondary)]'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  );
                })}
              </nav>

              {activeTab === 'snapshot' && <CustomerRelationshipPanel clientId={selectedId} />}
              {activeTab === 'ltv'      && <LtvProjectionCard     clientId={selectedId} />}
              {activeTab === 'timeline' && <ClientTimeline        clientId={selectedId} />}
              {activeTab === 'nba'      && <NbaRecommendationCard clientId={selectedId} />}
            </>
          ) : (
            <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-white/[0.02] p-4 text-center text-xs text-[color:var(--nfq-text-muted)]">
              Select a client to see their relationship.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CustomerPricingView;
