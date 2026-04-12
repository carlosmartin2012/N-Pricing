import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { ViewState } from '../types';
import { viewToPath } from '../appNavigation';

/**
 * Quick-nav shortcuts: digit keys 1-9 map to main nav views in order.
 * Only fires when no input/textarea/select is focused and no modifier keys
 * (except Meta/Ctrl for ⌘K).
 */
const QUICK_NAV: ViewState[] = [
  'CALCULATOR',   // 1
  'RAROC',        // 2
  'SHOCKS',       // 3
  'BLOTTER',      // 4
  'ACCOUNTING',   // 5
  'REPORTING',    // 6
  'MARKET_DATA',  // 7
  'METHODOLOGY',  // 8
  'BEHAVIOURAL',  // 9
];

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((document.activeElement as HTMLElement)?.isContentEditable) return true;
  return false;
}

interface UseKeyboardShortcutsOptions {
  onToggleSearch?: () => void;
  onCloseModal?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // ⌘K / Ctrl+K — toggle search / command palette
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        options.onToggleSearch?.();
        return;
      }

      // Escape — close modals/drawers
      if (e.key === 'Escape') {
        options.onCloseModal?.();
        return;
      }

      // Skip remaining shortcuts when typing in an input
      if (isInputFocused()) return;
      if (isMeta || e.altKey) return;

      // Digit 1-9 — quick navigation
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9 && QUICK_NAV[digit - 1]) {
        e.preventDefault();
        navigate(viewToPath(QUICK_NAV[digit - 1]));
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, options]);
}
