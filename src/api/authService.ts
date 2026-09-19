/**
 * PHASE 2: Authentication Service
 * JWT login + axios interceptor for automatic token refresh
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, RefreshRequest, RefreshResponse, AuthTokens } from './types';

interface ApiErrorBody {
  message?: string;
  error?: string;
  details?: Record<string, string>;
}

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  if (!error.response) {
    return 'We could not reach the account service. Please check that the server is running and try again.';
  }

  const data = error.response.data;
  const details = data?.details
    ? Object.entries(data.details).map(([field, message]) => `${field}: ${message}`).join(' ')
    : '';
  return details || data?.message || data?.error || fallback;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Token storage (memory-first, fallback to localStorage)
let tokenCache: AuthTokens | null = null;

// Auth Event Bus to sync React state
type TokenUpdateListener = (tokens: AuthTokens | null) => void;
const tokenListeners = new Set<TokenUpdateListener>();

export const onTokenUpdate = (listener: TokenUpdateListener): (() => void) => {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
};

const notifyTokenUpdate = (tokens: AuthTokens | null) => {
  tokenListeners.forEach(listener => listener(tokens));
};

export const getStoredTokens = (): AuthTokens | null => {
  // Try memory cache first (preferred)
  if (tokenCache) {
    return tokenCache;
  }
  
  // Fallback to localStorage if available
  try {
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      tokenCache = JSON.parse(stored);
      return tokenCache;
    }
  } catch (e) {
    console.warn('Failed to retrieve tokens from localStorage');
  }
  
  return null;
};

// Helper: mask token for safe debug logging (shows prefix and suffix only)
export const maskToken = (token: string | null | undefined): string => {
  if (!token) return '<none>';
  if (token.length <= 10) return '***';
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
};

export const setStoredTokens = (tokens: AuthTokens): void => {
  tokenCache = tokens;
  
  // Also persist to localStorage as fallback
  try {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  } catch (e) {
    console.warn('Failed to persist tokens to localStorage');
  }
  notifyTokenUpdate(tokens);
};

export const clearStoredTokens = (): void => {
  tokenCache = null;
  try {
    localStorage.removeItem('auth_tokens');
  } catch (e) {
    console.warn('Failed to clear tokens from localStorage');
  }
  notifyTokenUpdate(null);
};

export const isTokenExpired = (): boolean => {
  const tokens = getStoredTokens();
  if (!tokens) return true;
  return Date.now() >= tokens.expiresAt;
};

// Create axios instance with auth header
export const createAuthAxios = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  // Request interceptor: attach Authorization header
  instance.interceptors.request.use(
    (config) => {
      const tokens = getStoredTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle 401 + token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;

      // If 401 and we have a refresh token, try to refresh
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const tokens = getStoredTokens();
          if (tokens?.refreshToken) {
            // Call refresh endpoint
            const refreshPayload: RefreshRequest = { refreshToken: tokens.refreshToken };
            const response = await axios.post<RefreshResponse>(
              `${API_BASE_URL}/api/auth/refresh`,
              refreshPayload
            );

            if (response.data.accessToken) {
              const newTokens: AuthTokens = {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                role: tokens.role, // carry over role
                expiresAt: response.data.expiresAt,
              };
              setStoredTokens(newTokens);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              return instance(originalRequest);
            }
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and let app handle re-login
          clearStoredTokens();
          console.error('Token refresh failed:', refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Auth service
export const authService = {
  async login(request: LoginRequest): Promise<AuthTokens> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/login`,
        request
      );

      const tokens: AuthTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        role: response.data.role,
        expiresAt: response.data.expiresAt,
      };

      setStoredTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await axios.post<RegisterResponse>(
        `${API_BASE_URL}/api/auth/register`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  logout(): void {
    clearStoredTokens();
  },

  async refreshToken(): Promise<AuthTokens> {
    const tokens = getStoredTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const refreshPayload: RefreshRequest = { refreshToken: tokens.refreshToken };
      const response = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/api/auth/refresh`,
        refreshPayload
      );

      const newTokens: AuthTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        role: tokens.role, // role might not be returned in refresh
        expiresAt: response.data.expiresAt,
      };

      setStoredTokens(newTokens);
      return newTokens;
    } catch (error) {
      clearStoredTokens();
      throw error;
    }
  },

  getAccessToken(): string | null {
    const tokens = getStoredTokens();
    return tokens?.accessToken ?? null;
  },

  isAuthenticated(): boolean {
    const tokens = getStoredTokens();
    if (!tokens) return false;
    return Date.now() < tokens.expiresAt;
  },
};

export const axiosInstance = createAuthAxios();
