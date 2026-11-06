import { apiClient, tokenStorage } from './api';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
  UpdateProfileDto,
} from '../../../packages/shared/src';

export const authService = {
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const { data } = await apiClient.post<AuthResponseDto>('/auth/register', dto);
    await tokenStorage.setToken(data.accessToken);
    if (data.refreshToken) {
      await tokenStorage.setRefreshToken(data.refreshToken);
    }
    return data;
  },

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const { data } = await apiClient.post<AuthResponseDto>('/auth/login', dto);
    await tokenStorage.setToken(data.accessToken);
    if (data.refreshToken) {
      await tokenStorage.setRefreshToken(data.refreshToken);
    }
    return data;
  },

  async googleAuth(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    const { data } = await apiClient.post<AuthResponseDto>('/auth/google', dto);
    await tokenStorage.setToken(data.accessToken);
    if (data.refreshToken) {
      await tokenStorage.setRefreshToken(data.refreshToken);
    }
    return data;
  },

  async refresh(): Promise<AuthResponseDto> {
    const refreshToken = await tokenStorage.getRefreshToken();
    const { data } = await apiClient.post<AuthResponseDto>('/auth/refresh', {
      refreshToken,
    });
    await tokenStorage.setToken(data.accessToken);
    if (data.refreshToken) {
      await tokenStorage.setRefreshToken(data.refreshToken);
    }
    return data;
  },

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean; message: string; devCode?: string }> {
    const { data } = await apiClient.post('/auth/forgot-password', dto);
    return data;
  },

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post('/auth/reset-password', dto);
    return data;
  },

  async getMe() {
    const token = await tokenStorage.getToken();
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!token && !refreshToken) {
      return null;
    }
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  async updateProfile(dto: UpdateProfileDto) {
    const { data } = await apiClient.put('/auth/profile', dto);
    return data;
  },

  async updatePhone(phoneNumber: string) {
    const { data } = await apiClient.put('/auth/phone', { phoneNumber });
    return data;
  },

  async logout(): Promise<void> {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    } finally {
      await tokenStorage.clearToken();
    }
  },
};
