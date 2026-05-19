import React from 'react';
import { Plus, Search } from 'lucide-react';

interface Props {
  searchTerm: string;
  totalUsers: number;
  onSearchChange: (value: string) => void;
  onAddUser: () => void;
}

export const UserManagementToolbar: React.FC<Props> = ({
  searchTerm,
  totalUsers,
  onSearchChange,
  onAddUser,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-slate-700 bg-[var(--nfq-bg-elevated)] p-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--nfq-text-faint)]"
          />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-64 rounded border border-slate-700 bg-[var(--nfq-bg-root)] py-1.5 pl-9 pr-3 text-xs text-[color:var(--nfq-text-primary)] focus:border-[color:var(--nfq-accent)] focus:outline-none"
          />
        </div>
        <div className="text-xs text-[color:var(--nfq-text-faint)]">
          <strong>{totalUsers}</strong> registered users
        </div>
      </div>

      <button
        onClick={onAddUser}
        className="flex items-center gap-1 rounded border border-[color:var(--nfq-accent)] bg-[var(--nfq-accent)] px-3 py-1.5 text-xs font-bold text-[color:var(--nfq-text-primary)] shadow-lg shadow-[color:var(--nfq-accent)]/30 transition-colors hover:bg-[var(--nfq-accent-hover)]"
      >
        <Plus size={12} /> Add User
      </button>
    </div>
  );
};
