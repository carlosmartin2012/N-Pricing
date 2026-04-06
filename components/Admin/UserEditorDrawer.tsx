import React from 'react';
import { Shield } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { InputGroup, SelectInput, TextInput } from '../ui/LayoutComponents';
import type { UserProfile } from '../../types';
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  type UserDraft,
  type UserEditorMode,
} from './userManagementUtils';

interface Props {
  isOpen: boolean;
  mode: UserEditorMode;
  draft: UserDraft | null;
  validationError: string | null;
  onClose: () => void;
  onSave: () => void;
  onChangeDraft: (draft: UserDraft) => void;
}

export const UserEditorDrawer: React.FC<Props> = ({
  isOpen,
  mode,
  draft,
  validationError,
  onClose,
  onSave,
  onChangeDraft,
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create New User' : 'Edit User Profile'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500"
          >
            Save Profile
          </button>
        </div>
      }
    >
      {draft && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-900 p-4">
            <Shield size={24} className="text-slate-500" />
            <div>
              <h4 className="text-xs font-bold text-slate-300">Security Credentials</h4>
              <p className="text-[10px] text-slate-500">
                Manage access level and profile details.
              </p>
            </div>
          </div>

          {validationError && (
            <div className="rounded border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {validationError}
            </div>
          )}

          <InputGroup label="Full Name">
            <TextInput
              value={draft.name}
              onChange={(event) => onChangeDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. John Doe"
            />
          </InputGroup>

          <InputGroup label="Email Address">
            <TextInput
              value={draft.email}
              onChange={(event) => onChangeDraft({ ...draft, email: event.target.value })}
              placeholder="john.doe@nexus.bank"
            />
          </InputGroup>

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Role">
              <SelectInput
                value={draft.role}
                onChange={(event) =>
                  onChangeDraft({ ...draft, role: event.target.value as UserProfile['role'] })
                }
              >
                {USER_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role === 'Risk_Manager' ? 'Risk Manager' : role === 'Admin' ? 'Administrator' : role}
                  </option>
                ))}
              </SelectInput>
            </InputGroup>
            <InputGroup label="Status">
              <SelectInput
                value={draft.status}
                onChange={(event) =>
                  onChangeDraft({ ...draft, status: event.target.value as UserProfile['status'] })
                }
              >
                {USER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectInput>
            </InputGroup>
          </div>

          <InputGroup label="Department">
            <TextInput
              value={draft.department}
              onChange={(event) => onChangeDraft({ ...draft, department: event.target.value })}
            />
          </InputGroup>
        </div>
      )}
    </Drawer>
  );
};
