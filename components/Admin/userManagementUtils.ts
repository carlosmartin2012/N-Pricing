import type { UserProfile } from '../../types';
import { generateId } from '../../utils/generateId';

export type UserEditorMode = 'create' | 'edit';
export type UserDraft = UserProfile;

export const USER_ROLE_OPTIONS: UserProfile['role'][] = [
  'Admin',
  'Trader',
  'Risk_Manager',
  'Auditor',
];

export const USER_STATUS_OPTIONS: UserProfile['status'][] = [
  'Active',
  'Inactive',
  'Locked',
];

export function createUserDraft(): UserDraft {
  return {
    id: generateId('USR'),
    name: '',
    email: '',
    role: 'Trader',
    status: 'Active',
    department: '',
    lastLogin: 'Never',
  };
}

export function filterUsers(users: UserProfile[], searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (!normalizedSearch) {
    return users;
  }

  return users.filter((user) =>
    [user.name, user.email, user.role, user.department].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );
}

export function getUserInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'NA';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function formatLastLogin(lastLogin: string) {
  if (lastLogin === 'Never') {
    return 'Never';
  }

  const parsedDate = new Date(lastLogin);
  return Number.isNaN(parsedDate.getTime()) ? 'Unknown' : parsedDate.toLocaleString();
}

export function validateUserDraft(
  draft: UserDraft,
  users: UserProfile[],
  mode: UserEditorMode,
) {
  if (!draft.name.trim()) {
    return 'Full name is required.';
  }

  if (!draft.email.trim()) {
    return 'Email address is required.';
  }

  const normalizedEmail = draft.email.trim().toLowerCase();
  const emailTaken = users.some(
    (user) =>
      user.email.toLowerCase() === normalizedEmail &&
      (mode === 'create' || user.id !== draft.id),
  );

  if (emailTaken) {
    return 'Another user already uses that email address.';
  }

  return null;
}
