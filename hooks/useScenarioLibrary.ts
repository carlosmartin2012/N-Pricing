import { useCallback, useState } from 'react';
import type { PricingScenario } from '../components/Calculator/pricingComparisonUtils';

const STORAGE_KEY = 'n_pricing_saved_scenarios';

interface SavedScenario extends PricingScenario {
  savedAt: string;
  savedBy?: string;
}

function loadFromStorage(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(scenarios: SavedScenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

export function useScenarioLibrary() {
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(loadFromStorage);

  const saveScenario = useCallback(
    (scenario: PricingScenario, userName?: string) => {
      const saved: SavedScenario = {
        ...scenario,
        id: `saved-${Date.now()}`,
        savedAt: new Date().toISOString(),
        savedBy: userName,
      };
      setSavedScenarios((prev) => {
        const next = [saved, ...prev].slice(0, 20);
        saveToStorage(next);
        return next;
      });
      return saved;
    },
    []
  );

  const deleteScenario = useCallback(
    (id: string) => {
      setSavedScenarios((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveToStorage(next);
        return next;
      });
    },
    []
  );

  const renameScenario = useCallback(
    (id: string, name: string) => {
      setSavedScenarios((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, name } : s));
        saveToStorage(next);
        return next;
      });
    },
    []
  );

  return {
    savedScenarios,
    saveScenario,
    deleteScenario,
    renameScenario,
  };
}
