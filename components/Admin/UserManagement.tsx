import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteUser, upsertUser } from '../../api/config';
import { Panel } from '../ui/LayoutComponents';
import type { UserProfile } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../utils/supabaseClient';
import { createLogger } from '../../utils/logger';
import { UserCard } from './UserCard';
import { UserEditorDrawer } from './UserEditorDrawer';
import { UserManagementToolbar } from './UserManagementToolbar';
const EntityOnboarding = React.lazy(() => import('./EntityOnboarding'));
import {
  createUserDraft,
  filterUsers,
  validateUserDraft,
  type UserDraft,
  type UserEditorMode,
} from './userManagementUtils';

interface Props {
  users: UserProfile[];
  setUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
}

const log = createLogger('UserManagement');

const UserManagement: React.FC<Props> = ({ users, setUsers }) => {
  const { t } = useUI();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editorMode, setEditorMode] = useState<UserEditorMode>('create');
  const [editingUser, setEditingUser] = useState<UserDraft | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setOnlineUsers([]);
      return;
    }

    const channel = supabase.channel('online-users');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = Array.from(
          new Set(
            Object.values(state)
              .flat()
              .map((presence) => {
                if (typeof presence === 'object' && presence && 'id' in presence) {
                  return String((presence as { id: string }).id);
                }
                return '';
              })
              .filter(Boolean),
          ),
        );
        setOnlineUsers(ids);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const filteredUsers = useMemo(
    () => filterUsers(users, searchTerm),
    [users, searchTerm],
  );

  const openCreateDrawer = () => {
    setEditorMode('create');
    setEditingUser(createUserDraft());
    setValidationError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (user: UserProfile) => {
    setEditorMode('edit');
    setEditingUser({ ...user });
    setValidationError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setValidationError(null);
  };

  const handleDraftChange = (draft: UserDraft) => {
    setEditingUser(draft);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSave = useCallback(async () => {
    if (!editingUser) {
      return;
    }

    const error = validateUserDraft(editingUser, users, editorMode);
    if (error) {
      setValidationError(error);
      return;
    }

    const userToSave: UserProfile = {
      ...editingUser,
      email: editingUser.email.trim(),
      name: editingUser.name.trim(),
      department: editingUser.department.trim(),
    };

    setUsers((previousUsers) => {
      const exists = previousUsers.some((user) => user.id === userToSave.id);
      if (exists) {
        return previousUsers.map((user) => (user.id === userToSave.id ? userToSave : user));
      }
      return [...previousUsers, userToSave];
    });

    if (isSupabaseConfigured) {
      try {
        await upsertUser(userToSave);
      } catch (saveError) {
        log.error('Failed to persist user', { userId: userToSave.id }, saveError instanceof Error ? saveError : undefined);
      }
    }

    closeDrawer();
  }, [editingUser, users, editorMode, setUsers]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t.confirmDeleteUser)) {
        return;
      }

      setUsers((previousUsers) => previousUsers.filter((user) => user.id !== id));

      if (isSupabaseConfigured) {
        try {
          await deleteUser(id);
        } catch (deleteError) {
          log.error('Failed to delete user', { userId: id }, deleteError instanceof Error ? deleteError : undefined);
        }
      }
    },
    [setUsers, t.confirmDeleteUser],
  );

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <Panel
      title={t.userAccessManagement}
      className="h-full"
      actions={
        isAdmin ? (
          <button
            onClick={() => setShowOnboarding(true)}
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-400"
          >
            {t.newEntity}
          </button>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col">
        <UserManagementToolbar
          searchTerm={searchTerm}
          totalUsers={filteredUsers.length}
          onSearchChange={setSearchTerm}
          onAddUser={openCreateDrawer}
        />

        <div className="flex-1 overflow-auto bg-slate-900 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isOnline={onlineUsers.includes(user.id)}
                onEdit={() => openEditDrawer(user)}
                onDelete={() => void handleDelete(user.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <UserEditorDrawer
        isOpen={isDrawerOpen}
        mode={editorMode}
        draft={editingUser}
        validationError={validationError}
        onClose={closeDrawer}
        onSave={() => void handleSave()}
        onChangeDraft={handleDraftChange}
      />

      {isAdmin && (
        <React.Suspense fallback={null}>
          <EntityOnboarding
            isOpen={showOnboarding}
            onClose={() => setShowOnboarding(false)}
          />
        </React.Suspense>
      )}
    </Panel>
  );
};

export default UserManagement;
