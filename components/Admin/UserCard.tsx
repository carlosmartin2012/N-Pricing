import React from 'react';
import { Calendar, Edit, Lock, Mail, Trash2, Unlock } from 'lucide-react';
import { Badge } from '../ui/LayoutComponents';
import type { UserProfile } from '../../types';
import { formatLastLogin, getUserInitials } from './userManagementUtils';

interface Props {
  user: UserProfile;
  isOnline: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function getAvatarClassName(role: UserProfile['role']) {
  if (role === 'Admin') {
    return 'border-purple-800 bg-purple-900/20 text-purple-400';
  }
  if (role === 'Risk_Manager') {
    return 'border-red-800 bg-red-900/20 text-red-400';
  }
  if (role === 'Auditor') {
    return 'border-amber-800 bg-amber-900/20 text-amber-400';
  }
  return 'border-slate-700 bg-slate-800 text-cyan-400';
}

export const UserCard: React.FC<Props> = React.memo(({
  user,
  isOnline,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="group relative rounded-lg border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-slate-600">
      <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onEdit} className="text-slate-400 hover:text-cyan-400">
          <Edit size={14} />
        </button>
        <button onClick={onDelete} className="text-slate-400 hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mb-4 flex items-start gap-3">
        <div className="relative">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${getAvatarClassName(user.role)}`}
          >
            {getUserInitials(user.name)}
          </div>
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-slate-950 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-200">{user.name}</h4>
            {isOnline && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-500">
                Online
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 min-w-0">
            <Mail size={10} className="shrink-0" /> <span className="truncate">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-900 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Role</span>
          <Badge variant="default">{user.role.replace('_', ' ')}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Department</span>
          <span className="text-slate-300">{user.department}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Status</span>
          <div className="flex items-center gap-1">
            {user.status === 'Active' ? (
              <Unlock size={10} className="text-emerald-500" />
            ) : (
              <Lock size={10} className="text-red-500" />
            )}
            <span className={user.status === 'Active' ? 'text-emerald-400' : 'text-red-400'}>
              {user.status}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 pt-2 font-mono text-[9px] text-slate-600">
        <Calendar size={10} /> Last Login: {formatLastLogin(user.lastLogin)}
      </div>
    </div>
  );
});
