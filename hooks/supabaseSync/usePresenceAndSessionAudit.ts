import { useEffect } from 'react';
import type { UserProfile } from '../../types';
import { isSupabaseConfigured } from '../../utils/supabaseClient';
import { sendAuditEntryKeepalive } from '../../utils/supabase/auditTransport';
import { masterDataService } from '../../utils/supabase/masterData';

interface Options {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
}

export function usePresenceAndSessionAudit({ currentUser, isAuthenticated }: Options) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    if (isAuthenticated && currentUser) {
      const presenceChannel = masterDataService.trackPresence(currentUser.id, {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      });

      return () => {
        presenceChannel.unsubscribe();
      };
    }
  }, [currentUser, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const handleBeforeUnload = () => {
      void sendAuditEntryKeepalive({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: 'SESSION_END',
        module: 'AUTH',
        description: `User ${currentUser.name} closed the application.`,
        details: {},
        timestamp: new Date().toISOString(),
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, isAuthenticated]);
}
