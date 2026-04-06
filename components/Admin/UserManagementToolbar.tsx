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
    <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-64 rounded border border-slate-700 bg-slate-950 py-1.5 pl-9 pr-3 text-xs text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-500">
          <strong>{totalUsers}</strong> registered users
        </div>
      </div>

      <button
        onClick={onAddUser}
        className="flex items-center gap-1 rounded border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-900/20 transition-colors hover:bg-cyan-500"
      >
        <Plus size={12} /> Add User
      </button>
    </div>
  );
};
