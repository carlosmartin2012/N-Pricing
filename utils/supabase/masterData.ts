import type { BusinessUnit, ClientEntity, ProductDefinition, UserProfile } from '../../types';
import { mapBUFromDB, mapClientFromDB, mapProductFromDB } from './mappers';
import { log, supabase } from './shared';

export const masterDataService = {
  async fetchClients(): Promise<ClientEntity[]> {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) return [];
    return (data || []).map(mapClientFromDB);
  },

  async saveClient(client: ClientEntity) {
    const { error } = await supabase.from('clients').upsert(client);
    if (error) log.error('Error saving client', { code: error.code });
  },

  async deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) log.error('Error deleting client', { code: error.code });
  },

  async fetchBusinessUnits(): Promise<BusinessUnit[]> {
    const { data, error } = await supabase.from('business_units').select('*');
    if (error) return [];
    return (data || []).map(mapBUFromDB);
  },

  async saveBusinessUnit(unit: BusinessUnit) {
    const { error } = await supabase.from('business_units').upsert(unit);
    if (error) log.error('Error saving unit', { code: error.code });
  },

  async deleteBusinessUnit(id: string) {
    const { error } = await supabase.from('business_units').delete().eq('id', id);
    if (error) log.error('Error deleting unit', { code: error.code });
  },

  async fetchProducts(): Promise<ProductDefinition[]> {
    const { data, error } = await supabase.from('products').select('*');
    if (error) return [];
    return (data || []).map(mapProductFromDB);
  },

  async saveProduct(product: ProductDefinition) {
    const { error } = await supabase.from('products').upsert(product);
    if (error) log.error('Error saving product', { code: error.code });
  },

  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) log.error('Error deleting product', { code: error.code });
  },

  async fetchUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return [];
    return (data || []) as UserProfile[];
  },

  async upsertUser(user: UserProfile) {
    const { error } = await supabase.from('users').upsert(user);
    if (error) log.error('Error upserting user', { code: error.code });
  },

  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) log.error('Error deleting user', { code: error.code });
  },

  trackPresence(userId: string, userDetails: any) {
    const room = supabase.channel('online-users');
    return room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        log.debug('Online users updated', { userCount: Object.keys(state).length });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            id: userId,
            online_at: new Date().toISOString(),
            ...userDetails,
          });
        }
      });
  },
};
