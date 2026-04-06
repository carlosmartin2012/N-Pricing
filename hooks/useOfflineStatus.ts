import { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/ui/Toast';

/**
 * Monitors network connectivity and shows toast notifications
 * when the app transitions between online and offline states.
 *
 * Does NOT fire on initial mount — only on state changes after mount.
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const { addToast } = useToast();
  const hasMounted = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (hasMounted.current) {
        addToast('success', 'Connection restored. Data will sync automatically.');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (hasMounted.current) {
        addToast('warning', 'You are offline. Changes are saved locally.');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mark as mounted after first render so we skip the initial notification
    hasMounted.current = true;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  return isOnline;
}
