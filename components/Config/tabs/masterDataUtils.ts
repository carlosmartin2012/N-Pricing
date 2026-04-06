import type {
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
} from '../../../types';

export type MasterDataEditorState =
  | { kind: 'client'; isNew: boolean; value: Partial<ClientEntity> }
  | { kind: 'product'; isNew: boolean; value: Partial<ProductDefinition> }
  | { kind: 'businessUnit'; isNew: boolean; value: Partial<BusinessUnit> }
  | null;

export const createClientDraft = (): MasterDataEditorState => ({
  kind: 'client',
  isNew: true,
  value: { id: '', name: '', type: 'Corporate', segment: '', rating: 'BB' },
});

export const createProductDraft = (): MasterDataEditorState => ({
  kind: 'product',
  isNew: true,
  value: { id: '', name: '', category: 'Asset' },
});

export const createBusinessUnitDraft = (): MasterDataEditorState => ({
  kind: 'businessUnit',
  isNew: true,
  value: { id: '', name: '', code: '' },
});

export const editClientDraft = (client: ClientEntity): MasterDataEditorState => ({
  kind: 'client',
  isNew: false,
  value: { ...client },
});

export const editProductDraft = (product: ProductDefinition): MasterDataEditorState => ({
  kind: 'product',
  isNew: false,
  value: { ...product },
});

export const editBusinessUnitDraft = (businessUnit: BusinessUnit): MasterDataEditorState => ({
  kind: 'businessUnit',
  isNew: false,
  value: { ...businessUnit },
});

export const upsertEntityById = <T extends { id: string }>(
  items: T[],
  nextItem: T,
) => {
  const exists = items.some(item => item.id === nextItem.id);
  return exists
    ? items.map(item => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem];
};

export const removeEntityById = <T extends { id: string }>(
  items: T[],
  id: string,
) => items.filter(item => item.id !== id);
