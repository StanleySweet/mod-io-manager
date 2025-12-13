import apiClient from './apiClient';

export interface Mod {
  id: number;
  name: string;
  status: 0 | 1 | 3;
  mod_io_id: number;
  mod_io_url: string;
  summary?: string;
  latest_version?: string;
  current_version?: string | null;
  current_signed?: boolean | null;
  latest_signed?: boolean | null;
  is_signed: boolean;
  filesize?: number;
  version_count: number;
  version_uploaded_at?: string;
  last_uploaded_at?: string;
}

export interface ModVersion {
  id: number;
  version: string;
  is_signed: boolean;
  uploaded_at: string;
  is_current: boolean;
  md5: string;
  filesize: number;
  created_at: string;
}

export interface ModVersionsResponse {
  mod: {
    id: number;
    name: string;
    mod_io_id: number;
    mod_io_url: string;
  };
  versions: ModVersion[];
}

export interface ModsListResponse {
  mods: Mod[];
}

export const modsService = {
  async getAllMods(params?: { outdated?: boolean }): Promise<Mod[]> {
    const response = await apiClient.get<ModsListResponse>('/mods', {
      params: params?.outdated ? { outdated: params.outdated } : undefined,
    });
    return response.data.mods;
  },

  async getModVersions(modId: number): Promise<ModVersionsResponse> {
    const response = await apiClient.get<ModVersionsResponse>(`/mods/${modId}/versions`);
    return response.data;
  },
};

export default modsService;
