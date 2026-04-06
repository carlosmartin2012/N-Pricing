import type { FtpRateCard, YieldCurvePoint } from '../../../types';

const readString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const createDefaultRateCardDraft = (): FtpRateCard => ({
  id: `RC-NEW-${Math.floor(Math.random() * 1000)}`,
  name: '',
  type: 'Liquidity',
  currency: 'USD',
  points: [{ tenor: '1Y', rate: 0 }],
});

export const normalizeRateCardDraft = (
  draft: Partial<FtpRateCard>,
): FtpRateCard => ({
  id: readString(draft.id, `RC-${Math.floor(Math.random() * 100000)}`),
  name: readString(draft.name, 'Untitled Curve'),
  type: (draft.type || 'Liquidity') as FtpRateCard['type'],
  currency: readString(draft.currency, 'USD'),
  points: (draft.points || []).map((point): YieldCurvePoint => ({
    tenor: readString(point.tenor, '1Y'),
    rate: readNumber(point.rate, 0),
    prev: point.prev == null ? undefined : readNumber(point.prev, readNumber(point.rate, 0)),
  })),
});

export const upsertRateCard = (
  cards: FtpRateCard[],
  nextCard: FtpRateCard,
) => {
  const exists = cards.some(card => card.id === nextCard.id);
  return exists
    ? cards.map(card => (card.id === nextCard.id ? nextCard : card))
    : [...cards, nextCard];
};

export const removeRateCard = (
  cards: FtpRateCard[],
  id: string,
) => cards.filter(card => card.id !== id);
