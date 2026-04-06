import type { PhysicalRateCard, TransitionRateCard } from '../../../types';

export type EsgSubTab = 'TRANSITION' | 'PHYSICAL';

export type EditableEsgEntry =
  | (TransitionRateCard & { type: 'TRANSITION' })
  | (PhysicalRateCard & { type: 'PHYSICAL' });

export const createDefaultEsgEntry = (subTab: EsgSubTab): EditableEsgEntry =>
  subTab === 'TRANSITION'
    ? {
        id: Date.now(),
        type: 'TRANSITION',
        classification: 'Neutral',
        sector: 'General',
        adjustmentBps: 0,
        description: '',
      }
    : {
        id: Date.now(),
        type: 'PHYSICAL',
        riskLevel: 'Medium',
        locationType: 'Standard',
        adjustmentBps: 0,
        description: '',
      };

export const updateEsgGridEntry = <T extends TransitionRateCard | PhysicalRateCard>(grid: T[], nextItem: T) => {
  const exists = grid.some((item) => item.id === nextItem.id);
  return exists ? grid.map((item) => (item.id === nextItem.id ? nextItem : item)) : [...grid, nextItem];
};

export const createEditableEsgEntry = (
  subTab: EsgSubTab,
  item: TransitionRateCard | PhysicalRateCard
): EditableEsgEntry =>
  subTab === 'TRANSITION'
    ? { ...(item as TransitionRateCard), type: 'TRANSITION' }
    : { ...(item as PhysicalRateCard), type: 'PHYSICAL' };

export const toPersistedEsgEntry = (item: EditableEsgEntry): TransitionRateCard | PhysicalRateCard => {
  if (item.type === 'TRANSITION') {
    const { type, ...rest } = item;
    void type;
    return rest;
  }

  const { type, ...rest } = item;
  void type;
  return rest;
};
