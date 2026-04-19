import React from 'react';
import { Users } from 'lucide-react';
import { SelectInput } from '../../ui/LayoutComponents';
import type { UserProfile } from '../../../types';
import type { EntityUser } from '../../../types/entity';
import { ROLE_OPTIONS, type AssignedUser } from './types';

interface Props {
  users: UserProfile[];
  assignedUsers: AssignedUser[];
  onToggleUser: (userEmail: string) => void;
  onChangeRole: (userEmail: string, role: EntityUser['role']) => void;
}

export const EntityUserAssignmentStep: React.FC<Props> = ({
  users,
  assignedUsers,
  onToggleUser,
  onChangeRole,
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
      <Users size={20} className="text-amber-400" />
      <div>
        <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">Assign Users</p>
        <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
          Select users and assign their role within this entity.
        </p>
      </div>
    </div>

    {users.length === 0 && (
      <p className="text-xs text-[color:var(--nfq-text-faint)]">No users found in the system.</p>
    )}

    <div className="space-y-2">
      {users.map((user) => {
        const assigned = assignedUsers.some((a) => a.userId === user.email);
        const role = assignedUsers.find((a) => a.userId === user.email)?.role ?? 'Trader';
        return (
          <div
            key={user.id}
            className={`flex items-center gap-3 rounded border p-3 transition-colors ${
              assigned
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]'
            }`}
          >
            <input
              type="checkbox"
              checked={assigned}
              onChange={() => onToggleUser(user.email)}
              className="h-4 w-4 rounded accent-amber-500"
              aria-label={`Assign ${user.email}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {user.name}
              </p>
              <p className="truncate font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
                {user.email}
              </p>
            </div>
            {assigned && (
              <SelectInput
                value={role}
                onChange={(e) => onChangeRole(user.email, e.target.value as EntityUser['role'])}
                className="w-36 text-xs"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'Risk_Manager' ? 'Risk Manager' : r}
                  </option>
                ))}
              </SelectInput>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
