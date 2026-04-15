import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users2, Upload } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';
import { useData } from '../../contexts/DataContext';
import CustomerRelationshipPanel from './CustomerRelationshipPanel';

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
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId === null && clients.length > 0) {
      setSelectedId(clients[0].id);
    }
  }, [clients, selectedId]);

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
          <Users2 className="h-5 w-5 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-white">
            Customer Pricing
          </h2>
          {activeEntity && (
            <span className="nfq-label text-[10px] text-slate-400">{activeEntity.shortCode}</span>
          )}
        </div>
        <a
          href="/api/customer360/import/positions"
          onClick={(e) => e.preventDefault()}
          title="POST a CSV body to /api/customer360/import/positions"
          className="nfq-btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs"
        >
          <Upload className="h-3 w-3" />
          Import positions (CSV)
        </a>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 pl-8 pr-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
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
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    }`}
                  >
                    <div className={`font-medium ${active ? 'text-white' : 'text-slate-200'}`}>{c.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {c.segment || '—'} · {c.rating || 'BBB'} · {c.id}
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-4 text-center text-xs text-slate-400">
                No clients match.
              </li>
            )}
          </ul>
        </aside>

        <section className="rounded-lg border border-white/5 bg-white/[0.02] p-4 md:p-6">
          {selectedId ? (
            <CustomerRelationshipPanel clientId={selectedId} />
          ) : (
            <div className="text-center text-xs text-slate-400">Select a client to see their relationship.</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CustomerPricingView;
