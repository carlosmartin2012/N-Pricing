import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../../types';
import {
  createUserDraft,
  filterUsers,
  getUserInitials,
  validateUserDraft,
} from '../../components/Admin/userManagementUtils';

const users: UserProfile[] = [
  {
    id: 'USR-1',
    name: 'Carlos Martin',
    email: 'carlos@nfq.es',
    role: 'Admin',
    status: 'Active',
    department: 'Treasury',
    lastLogin: 'Never',
  },
  {
    id: 'USR-2',
    name: 'Ana Lopez',
    email: 'ana@nfq.es',
    role: 'Trader',
    status: 'Active',
    department: 'Markets',
    lastLogin: 'Never',
  },
];

describe('userManagementUtils', () => {
  it('creates a new user draft with required defaults', () => {
    const draft = createUserDraft();

    expect(draft.id).toContain('USR-');
    expect(draft.role).toBe('Trader');
    expect(draft.status).toBe('Active');
  });

  it('filters users by multiple fields', () => {
    expect(filterUsers(users, 'markets')).toHaveLength(1);
    expect(filterUsers(users, 'ana@nfq.es')).toHaveLength(1);
    expect(filterUsers(users, 'admin')).toHaveLength(1);
  });

  it('returns stable initials for names', () => {
    expect(getUserInitials('Carlos Martin')).toBe('CM');
    expect(getUserInitials('Ana')).toBe('A');
    expect(getUserInitials('')).toBe('NA');
  });

  it('validates duplicate emails on create', () => {
    const draft = {
      ...createUserDraft(),
      name: 'Another Carlos',
      email: 'carlos@nfq.es',
    };

    expect(validateUserDraft(draft, users, 'create')).toBe(
      'Another user already uses that email address.',
    );
  });
});
