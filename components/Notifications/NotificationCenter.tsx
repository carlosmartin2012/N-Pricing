import React, { useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Filter, Inbox } from 'lucide-react';
import { Panel } from '../ui/LayoutComponents';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { systemTranslations } from '../../translations/index';

type FilterType = 'all' | Notification['type'];

const TYPE_COLORS: Record<Notification['type'], string> = {
  APPROVAL_REQUEST: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-rose-500/20 text-rose-400',
  COMMENT: 'bg-cyan-500/20 text-cyan-400',
};

const TYPE_LABELS: Record<Notification['type'], string> = {
  APPROVAL_REQUEST: 'Approval Request',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMMENT: 'Comment',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { setCurrentView, language } = useUI();
  const ts = systemTranslations(language);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = notifications;
    if (filterType !== 'all') list = list.filter((n) => n.type === filterType);
    if (showUnreadOnly) list = list.filter((n) => !n.isRead);
    return list;
  }, [notifications, filterType, showUnreadOnly]);

  const handleNavigateToDeal = (dealId?: string) => {
    if (!dealId) return;
    setCurrentView('BLOTTER');
  };

  return (
    <Panel
      title={ts.sysNotificationsHeader}
      className="h-full"
      actions={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[var(--nfq-accent)] transition-colors hover:bg-[rgba(6,182,212,0.08)]"
            >
              <CheckCheck size={14} />
              {ts.sysNotificationsMarkAllRead} ({unreadCount})
            </button>
          )}
        </div>
      }
    >
      <div className="flex h-full flex-col">
        {/* Filters */}
        <div className="flex items-center gap-3 border-b border-[var(--nfq-border-ghost)] px-4 py-3">
          <Filter size={14} className="text-[var(--nfq-text-muted)]" />
          <div className="flex gap-1">
            {(['all', 'APPROVAL_REQUEST', 'APPROVED', 'REJECTED', 'COMMENT'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  filterType === type
                    ? 'bg-[rgba(6,182,212,0.12)] text-[var(--nfq-accent)]'
                    : 'text-[var(--nfq-text-muted)] hover:text-[var(--nfq-text-secondary)]'
                }`}
              >
                {type === 'all' ? 'All' : TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--nfq-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
            />
            Unread only
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Inbox size={36} className="text-[var(--nfq-text-muted)] opacity-40" />
              <p className="text-sm text-[var(--nfq-text-muted)]">
                {showUnreadOnly ? 'No unread notifications' : ts.sysNotificationsEmpty}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--nfq-border-ghost)]">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-4 px-5 py-4 transition-colors hover:bg-[var(--nfq-bg-elevated)] ${
                    !n.isRead ? 'bg-[rgba(6,182,212,0.02)]' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TYPE_COLORS[n.type]}`}>
                        {TYPE_LABELS[n.type]}
                      </span>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[var(--nfq-accent)]" />
                      )}
                      <span className="font-mono text-[10px] text-[var(--nfq-text-faint)]">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm leading-snug ${!n.isRead ? 'font-medium text-[var(--nfq-text-primary)]' : 'text-[var(--nfq-text-secondary)]'}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="mt-1 text-xs text-[var(--nfq-text-muted)]">{n.message}</p>
                    )}
                    {n.dealId && (
                      <button
                        onClick={() => handleNavigateToDeal(n.dealId)}
                        className="mt-1.5 font-mono text-[11px] text-[var(--nfq-accent)] hover:underline"
                      >
                        {n.dealId} →
                      </button>
                    )}
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-accent)]"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

export default NotificationCenter;
