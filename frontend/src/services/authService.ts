import apiClient from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: 'mod_signer' | 'admin';
  };
}

export interface RegisterRequest {
  email: string;
  nickname: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  userId: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/change-password', data);
    return response.data;
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },
};

export default authService;
