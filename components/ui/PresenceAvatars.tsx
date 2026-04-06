import React from 'react';
import type { PresenceUser } from '../../hooks/usePresenceAwareness';

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxVisible?: number;
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, maxVisible = 5 }) => {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  const roleColors: Record<string, string> = {
    Admin: '#F48B4A',
    Trader: '#06b6d4',
    Risk_Manager: '#E04870',
    Auditor: '#9B59B6',
  };

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => {
        const initials = user.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const color = roleColors[user.role] ?? '#666';

        return (
          <div
            key={user.userId}
            className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--nfq-bg-root)] text-[10px] font-bold transition-transform hover:z-10 hover:scale-110"
            style={{ backgroundColor: color + '22', color }}
            title={`${user.name} (${user.role}) — ${user.activeView}`}
          >
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-[var(--nfq-bg-root)]" />
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--nfq-bg-root)] bg-white/10 text-[10px] font-mono text-slate-400">
          +{overflow}
        </div>
      )}
    </div>
  );
};
