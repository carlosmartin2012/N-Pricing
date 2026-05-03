import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useEntity } from '../contexts/EntityContext';
import { useConfigPersistence } from './supabaseSync/useConfigPersistence';
import { useInitialHydration } from './supabaseSync/useInitialHydration';
import { usePresenceAndSessionAudit } from './supabaseSync/usePresenceAndSessionAudit';
import { useRealtimeSync } from './supabaseSync/useRealtimeSync';

const realtimeEnabled =
  String(import.meta.env?.VITE_REALTIME_SYNC_ENABLED ?? '').toLowerCase() === 'true';

/**
 * Orchestrates Supabase lifecycle concerns through focused hooks:
 * hydration, realtime updates, presence/session audit, and persistence.
 */
export const useSupabaseSync = () => {
  const data = useData();
  const { currentUser, isAuthenticated } = useAuth();
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
  // Realtime/presence caused a WebSocket reconnection loop in empty/RLS-blocked
  // tenants. Keep it wired but opt-in until the tenant has seeded data and a
  // monitored rollout window.
  useRealtimeSync(data, { enabled: realtimeEnabled });
  usePresenceAndSessionAudit({
    currentUser,
    isAuthenticated: isAuthenticated && realtimeEnabled,
  });
  useConfigPersistence(data);
};
