import apiClient from './apiClient';

export interface ApiKey {
  id: number;
  name: string;
  role: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export const apiKeysService = {
  async getApiKeys(): Promise<ApiKey[]> {
    const response = await apiClient.get<ApiKey[]>('/admin/api-keys');
    return response.data;
  },

  async createApiKey(name: string): Promise<CreatedApiKey> {
    const response = await apiClient.post<CreatedApiKey>('/admin/api-keys', { name });
    return response.data;
  },

  async revokeApiKey(id: number): Promise<void> {
    await apiClient.post(`/admin/api-keys/${id}/revoke`);
  },
};

export default apiKeysService;
