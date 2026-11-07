import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TOKEN_KEY = 'harry_auth_token';
const LEGACY_TOKEN_KEY = 'nexo_auth_token';
const REFRESH_TOKEN_KEY = 'harry_refresh_token';
const LEGACY_REFRESH_TOKEN_KEY = 'nexo_refresh_token';

// Resolve a URL base da API de forma inteligente para Web, Emulador e Dispositivo Físico no Expo Go
function resolveBaseUrl(): string {
  // 1. Se for Web no navegador
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api/v1';
    }
    // Web acessado pelo celular no IP da rede local (ex: http://192.168.0.129:8081)
    if (host && !process.env.EXPO_PUBLIC_API_URL?.includes('onrender.com')) {
      return `http://${host}:3000/api/v1`;
    }
  }

  // 2. Se for dispositivo móvel nativo (iOS / Android no Expo Go)
  let apiUrl = process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra as any)?.apiUrl;

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const devIp = hostUri ? hostUri.split(':')[0] : null;

  // Em dispositivo físico no Expo Go, "localhost" ou "127.0.0.1" aponta para o próprio celular!
  // Substituímos automaticamente pelo IP da máquina host de desenvolvimento (ex: 192.168.0.129)
  if (Platform.OS !== 'web' && devIp && (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1'))) {
    apiUrl = `http://${devIp}:3000/api/v1`;
  }

  if (!apiUrl) {
    apiUrl = 'http://localhost:3000/api/v1';
  }

  const clean = apiUrl.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

const BASE_URL = resolveBaseUrl();
if (__DEV__) {
  console.log(`[Harry API] Conectando ao backend em: ${BASE_URL}`);
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
        }
        return null;
      }
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) return token;
      return await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(LEGACY_TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (e) {
      console.error('Erro ao salvar token', e);
    }
  },
  async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          return (
            localStorage.getItem(REFRESH_TOKEN_KEY) ||
            localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY)
          );
        }
        return null;
      }
      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refresh) return refresh;
      return await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async setRefreshToken(refreshToken: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          localStorage.setItem(LEGACY_REFRESH_TOKEN_KEY, refreshToken);
        }
      } else {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (e) {
      console.error('Erro ao salvar refresh token', e);
    }
  },
  async clearToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(LEGACY_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY).catch(() => {});
      }
    } catch (e) {
      console.error('Erro ao deletar token', e);
    }
  },
};

// Interceptor para injetar JWT em todas as requisições
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await tokenStorage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Erro ao ler token', error);
  }
  return config;
});

// Mutex / Fila para renovação transparente de Access Token em caso de 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');

    if (originalRequest._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    const storedRefreshToken = await tokenStorage.getRefreshToken();
    if (!storedRefreshToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken,
      });

      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      if (newAccessToken) {
        await tokenStorage.setToken(newAccessToken);
      }
      if (newRefreshToken) {
        await tokenStorage.setRefreshToken(newRefreshToken);
      }

      processQueue(null, newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await tokenStorage.clearToken();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
