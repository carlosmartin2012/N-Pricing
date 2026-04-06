import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfigPersistence } from './supabaseSync/useConfigPersistence';
import { useInitialHydration } from './supabaseSync/useInitialHydration';
import { usePresenceAndSessionAudit } from './supabaseSync/usePresenceAndSessionAudit';
import { useRealtimeSync } from './supabaseSync/useRealtimeSync';

/**
 * Orchestrates Supabase lifecycle concerns through focused hooks:
 * hydration, realtime updates, presence/session audit, and persistence.
 */
export const useSupabaseSync = () => {
  const data = useData();
  const { currentUser, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  useInitialHydration({ data, currentUser, addToast });
  useRealtimeSync(data);
  usePresenceAndSessionAudit({ currentUser, isAuthenticated });
  useConfigPersistence(data);
};
