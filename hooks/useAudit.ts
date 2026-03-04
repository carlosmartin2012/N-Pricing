import { useCallback } from 'react';
import { storage } from '../utils/storage';
import { ViewState } from '../types';

interface AuditOptions {
  action: string;
  module: ViewState | string;
  description: string;
  details?: Record<string, unknown>;
}

export const useAudit = (user: { email?: string; name?: string } | null) => {
  const logAudit = useCallback(
    (opts: AuditOptions) => {
      storage.addAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        action: opts.action,
        module: opts.module as ViewState,
        description: opts.description,
        details: opts.details,
      });
    },
    [user?.email, user?.name]
  );

  return logAudit;
};
