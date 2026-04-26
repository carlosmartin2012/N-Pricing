import React, { useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_COLORS: Record<Notification['type'], string> = {
  APPROVAL_REQUEST: 'bg-amber-500/20 text-amber-400',
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  REJECTED: 'bg-rose-500/20 text-rose-400',
  COMMENT: 'bg-cyan-500/20 text-cyan-400',
};

const TYPE_LABELS: Record<Notification['type'], string> = {
  APPROVAL_REQUEST: 'Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMMENT: 'Comment',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const NotificationPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-[380px] rounded-[var(--nfq-radius-card)] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center justify-between border-b border-[var(--nfq-border-ghost)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[var(--nfq-accent)]" />
          <span className="text-sm font-semibold text-[var(--nfq-text-primary)]">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--nfq-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium tracking-normal text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-secondary)]"
            >
              <CheckCheck size={12} />
              Mark all
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-text-secondary)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell size={28} className="text-[var(--nfq-text-muted)] opacity-40" />
            <p className="text-sm text-[var(--nfq-text-muted)]">No notifications yet</p>
            <p className="text-xs text-[var(--nfq-text-faint)]">
              Approval requests and system events will appear here
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--nfq-border-ghost)]">
            {notifications.slice(0, 50).map((n) => (
              <li
                key={n.id}
                className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--nfq-bg-elevated)] ${
                  !n.isRead ? 'bg-[rgba(6,182,212,0.03)]' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-medium ${TYPE_COLORS[n.type]}`}>
                      {TYPE_LABELS[n.type]}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--nfq-text-faint)]">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs leading-snug ${!n.isRead ? 'font-medium text-[var(--nfq-text-primary)]' : 'text-[var(--nfq-text-secondary)]'}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="mt-0.5 text-[11px] text-[var(--nfq-text-muted)] line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  {n.dealId && (
                    <span className="mt-1 inline-block font-mono text-[10px] text-[var(--nfq-accent)]">
                      {n.dealId}
                    </span>
                  )}
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[var(--nfq-accent)]"
                    title="Mark as read"
                  >
                    <Check size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
