import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useEntity } from '../contexts/EntityContext';
import { useConfigPersistence } from './supabaseSync/useConfigPersistence';
import { useInitialHydration } from './supabaseSync/useInitialHydration';
// Realtime and presence disabled — Supabase Realtime WebSocket reconnection loop
// blocks the main thread when DB tables are empty or RLS blocks anonymous access.
// Re-enable when Supabase has seeded data and proper auth flow.
// import { usePresenceAndSessionAudit } from './supabaseSync/usePresenceAndSessionAudit';
// import { useRealtimeSync } from './supabaseSync/useRealtimeSync';

/**
 * Orchestrates Supabase lifecycle concerns through focused hooks:
 * hydration, realtime updates, presence/session audit, and persistence.
 */
export const useSupabaseSync = () => {
  const data = useData();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const { activeEntity, isGroupScope, isLoading: isEntityLoading } = useEntity();

  useInitialHydration({
    data,
    currentUser,
    activeEntityId: activeEntity?.id,
    isGroupScope,
    isEntityLoading,
    addToast,
  });
  // useRealtimeSync(data);  // Disabled: WebSocket reconnection loop blocks UI
  // usePresenceAndSessionAudit({ currentUser, isAuthenticated });  // Disabled: depends on Realtime
  useConfigPersistence(data);
};
