import { useCallback } from 'react';
import { supabaseService } from '../utils/supabaseService';
import { AuditModule } from '../types';

interface AuditOptions {
  action: string;
  module: AuditModule;
  description: string;
  details?: Record<string, unknown>;
}

export const useAudit = (user: { email?: string; name?: string } | null) => {
  const logAudit = useCallback(
    (opts: AuditOptions) => {
      supabaseService.addAuditEntry({
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        action: opts.action,
        module: opts.module,
        description: opts.description,
        details: opts.details,
      });
    },
    [user?.email, user?.name]
  );

  return logAudit;
};
