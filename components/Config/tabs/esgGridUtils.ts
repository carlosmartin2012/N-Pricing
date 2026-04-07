import type { GreeniumRateCard, PhysicalRateCard, TransitionRateCard } from '../../../types';

export type EsgSubTab = 'TRANSITION' | 'PHYSICAL' | 'GREENIUM';

export type EditableEsgEntry =
  | (TransitionRateCard & { type: 'TRANSITION' })
  | (PhysicalRateCard & { type: 'PHYSICAL' })
  | (GreeniumRateCard & { type: 'GREENIUM' });

export const createDefaultEsgEntry = (subTab: EsgSubTab): EditableEsgEntry => {
  if (subTab === 'TRANSITION') {
    return {
      id: Date.now(),
      type: 'TRANSITION',
      classification: 'Neutral',
      sector: 'General',
      adjustmentBps: 0,
      description: '',
    };
  }
  if (subTab === 'GREENIUM') {
    return {
      id: Date.now(),
      type: 'GREENIUM',
      greenFormat: 'Green_Bond',
      sector: 'All',
      adjustmentBps: -10,
      description: '',
    };
  }
  return {
    id: Date.now(),
    type: 'PHYSICAL',
    riskLevel: 'Medium',
    locationType: 'Standard',
    adjustmentBps: 0,
    description: '',
  };
};

export const updateEsgGridEntry = <T extends TransitionRateCard | PhysicalRateCard | GreeniumRateCard>(grid: T[], nextItem: T) => {
  const exists = grid.some((item) => item.id === nextItem.id);
  return exists ? grid.map((item) => (item.id === nextItem.id ? nextItem : item)) : [...grid, nextItem];
};

export const createEditableEsgEntry = (
  subTab: EsgSubTab,
  item: TransitionRateCard | PhysicalRateCard | GreeniumRateCard
): EditableEsgEntry => {
  if (subTab === 'TRANSITION') return { ...(item as TransitionRateCard), type: 'TRANSITION' };
  if (subTab === 'GREENIUM') return { ...(item as GreeniumRateCard), type: 'GREENIUM' };
  return { ...(item as PhysicalRateCard), type: 'PHYSICAL' };
};

export const toPersistedEsgEntry = (item: EditableEsgEntry): TransitionRateCard | PhysicalRateCard | GreeniumRateCard => {
  const { type, ...rest } = item;
  void type;
  return rest as TransitionRateCard | PhysicalRateCard | GreeniumRateCard;
};
