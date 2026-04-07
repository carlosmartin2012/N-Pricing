import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ALL_TOURS, type WalkthroughStep, type WalkthroughTour } from '../constants/walkthroughTours';
import { useUI } from './UIContext';
import type { ViewState } from '../types';

const STORAGE_KEY = 'nfq-tours-completed';

function getCompletedTours(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function markTourCompleted(tourId: string) {
  const completed = getCompletedTours();
  if (!completed.includes(tourId)) {
    completed.push(tourId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }
}

interface WalkthroughContextType {
  isActive: boolean;
  currentStep: number;
  steps: WalkthroughStep[];
  tourId: string | null;
  startTour: (tourId: string) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  hasCompletedTour: (tourId: string) => boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType | null>(null);

export const WalkthroughProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ui = useUI();
  const [activeTour, setActiveTour] = useState<WalkthroughTour | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const navigateToStepView = useCallback(
    (step: WalkthroughStep) => {
      if (step.view && ui.currentView !== step.view) {
        ui.setCurrentView(step.view as ViewState);
      }
    },
    [ui],
  );

  const startTour = useCallback(
    (tourId: string) => {
      const tour = ALL_TOURS[tourId];
      if (!tour) return;
      setActiveTour(tour);
      setCurrentStep(0);
      if (tour.steps[0]) navigateToStepView(tour.steps[0]);
    },
    [navigateToStepView],
  );

  const closeTour = useCallback(() => {
    if (activeTour) markTourCompleted(activeTour.id);
    setActiveTour(null);
    setCurrentStep(0);
  }, [activeTour]);

  const next = useCallback(() => {
    if (!activeTour) return;
    const nextIdx = currentStep + 1;
    if (nextIdx >= activeTour.steps.length) {
      closeTour();
    } else {
      setCurrentStep(nextIdx);
      navigateToStepView(activeTour.steps[nextIdx]);
    }
  }, [activeTour, currentStep, closeTour, navigateToStepView]);

  const prev = useCallback(() => {
    if (!activeTour || currentStep <= 0) return;
    const prevIdx = currentStep - 1;
    setCurrentStep(prevIdx);
    navigateToStepView(activeTour.steps[prevIdx]);
  }, [activeTour, currentStep, navigateToStepView]);

  const hasCompletedTour = useCallback((tourId: string) => getCompletedTours().includes(tourId), []);

  const value = useMemo<WalkthroughContextType>(
    () => ({
      isActive: activeTour !== null,
      currentStep,
      steps: activeTour?.steps ?? [],
      tourId: activeTour?.id ?? null,
      startTour,
      next,
      prev,
      skip: closeTour,
      hasCompletedTour,
    }),
    [activeTour, currentStep, startTour, next, prev, closeTour, hasCompletedTour],
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
};

export function useWalkthrough() {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) throw new Error('useWalkthrough must be used within WalkthroughProvider');
  return ctx;
}
