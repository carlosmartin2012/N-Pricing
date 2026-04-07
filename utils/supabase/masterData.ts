import type { BusinessUnit, ClientEntity, ProductDefinition, UserProfile } from '../../types';
import { mapBUFromDB, mapClientFromDB, mapProductFromDB } from './mappers';
import { apiGet, apiPost, apiDelete } from '../apiFetch';
import { log } from './shared';

export const masterDataService = {
  async fetchClients(): Promise<ClientEntity[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/config/clients');
      return rows.map(mapClientFromDB);
    } catch { return []; }
  },

  async saveClient(client: ClientEntity) {
    try {
      await apiPost('/config/clients', client);
    } catch (err) {
      log.error('Error saving client', { error: String(err) });
    }
  },

  async deleteClient(id: string) {
    try {
      await apiDelete(`/config/clients/${id}`);
    } catch (err) {
      log.error('Error deleting client', { error: String(err) });
    }
  },

  async fetchBusinessUnits(): Promise<BusinessUnit[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/config/business-units');
      return rows.map(mapBUFromDB);
    } catch { return []; }
  },

  async saveBusinessUnit(unit: BusinessUnit) {
    try {
      await apiPost('/config/business-units', unit);
    } catch (err) {
      log.error('Error saving unit', { error: String(err) });
    }
  },

  async deleteBusinessUnit(id: string) {
    try {
      await apiDelete(`/config/business-units/${id}`);
    } catch (err) {
      log.error('Error deleting unit', { error: String(err) });
    }
  },

  async fetchProducts(): Promise<ProductDefinition[]> {
    try {
      const rows = await apiGet<Record<string, unknown>[]>('/config/products');
      return rows.map(mapProductFromDB);
    } catch { return []; }
  },

  async saveProduct(product: ProductDefinition) {
    try {
      await apiPost('/config/products', product);
    } catch (err) {
      log.error('Error saving product', { error: String(err) });
    }
  },

  async deleteProduct(id: string) {
    try {
      await apiDelete(`/config/products/${id}`);
    } catch (err) {
      log.error('Error deleting product', { error: String(err) });
    }
  },

  async fetchUsers(): Promise<UserProfile[]> {
    try {
      return await apiGet<UserProfile[]>('/config/users');
    } catch { return []; }
  },

  async upsertUser(user: UserProfile) {
    try {
      await apiPost('/config/users', user);
    } catch (err) {
      log.error('Error upserting user', { error: String(err) });
    }
  },

  async deleteUser(id: string) {
    try {
      await apiDelete(`/config/users/${id}`);
    } catch (err) {
      log.error('Error deleting user', { error: String(err) });
    }
  },

  trackPresence(_userId: string, _userDetails: unknown) {
    return { unsubscribe: () => {} };
  },
};
