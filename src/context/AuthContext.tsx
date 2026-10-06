import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authService, getStoredTokens, onTokenUpdate } from '../api/authService';
import { LoginRequest, RegisterRequest, AuthTokens, RegisterResponse } from '../api/types';
import { stompClient } from '../api/wsClient';

/**
 * Strict mapping from user role to primary dashboard URL.
 * Returns null if role is missing or unrecognized (NO fallback to STUDENT).
 */
export function getDashboardForRole(role: string | null | undefined): string | null {
  if (!role) {
    return null;
  }
  const norm = role.trim().toUpperCase();
  switch (norm) {
    case 'PARENT':
      return '/parent/dashboard';
    case 'TEACHER':
      return '/teacher/dashboard';
    case 'STUDENT':
      return '/student/dashboard';
    default:
      console.warn(`[getDashboardForRole] Unrecognized role: '${role}'`);
      return null;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  expiresAt: number | null;
}

interface AuthContextType extends AuthState {
  login: (request: LoginRequest) => Promise<AuthTokens>;
  register: (request: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => void;
  refreshAuthToken: () => Promise<AuthTokens>;
  isAuthenticated: () => boolean;
  getRoleDashboard: () => string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    role: null,
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from storage on mount and subscribe to background updates
  useEffect(() => {
    const tokens = getStoredTokens();
    if (tokens) {
      const normRole = tokens.role ? tokens.role.trim().toUpperCase() : null;
      setAuthState({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        role: normRole,
        expiresAt: tokens.expiresAt,
      });
    }
    setIsLoading(false);

    // Subscribe to external token updates (like axios refresh interceptor)
    const unsubscribe = onTokenUpdate((newTokens) => {
      if (newTokens) {
        const normRole = newTokens.role ? newTokens.role.trim().toUpperCase() : null;
        setAuthState({
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          role: normRole,
          expiresAt: newTokens.expiresAt,
        });
      } else {
        setAuthState({
          accessToken: null,
          refreshToken: null,
          role: null,
          expiresAt: null,
        });
      }
    });

    return unsubscribe;
  }, []);

  const login = async (request: LoginRequest): Promise<AuthTokens> => {
    const tokens = await authService.login(request);
    const normalizedRole = tokens.role ? tokens.role.trim().toUpperCase() : null;
    const tokensWithNormRole: AuthTokens = {
      ...tokens,
      role: normalizedRole || tokens.role,
    };

    setAuthState({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: normalizedRole,
      expiresAt: tokens.expiresAt,
    });

    return tokensWithNormRole;
  };

  const register = async (request: RegisterRequest): Promise<RegisterResponse> => {
    return await authService.register(request);
  };

  const logout = useCallback(() => {
    authService.logout();
    
    // Disconnect WebSocket
    try {
      stompClient.disconnect();
    } catch (e) {
      console.warn("Error disconnecting websocket on logout", e);
    }
    
    // Reset app state and redirect to login
    window.location.href = '/login';
  }, []);

  const refreshAuthToken = async (): Promise<AuthTokens> => {
    try {
      const newTokens = await authService.refreshToken();
      const normalizedRole = newTokens.role ? newTokens.role.trim().toUpperCase() : authState.role;
      const updatedTokens: AuthTokens = {
        ...newTokens,
        role: normalizedRole || newTokens.role,
      };

      setAuthState({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        role: normalizedRole,
        expiresAt: newTokens.expiresAt,
      });

      return updatedTokens;
    } catch (error) {
      logout();
      throw error;
    }
  };

  const isAuthenticated = () => {
    if (!authState.accessToken || !authState.expiresAt) return false;
    return Date.now() < authState.expiresAt;
  };

  useEffect(() => {
    (window as any).__logout = logout;
  }, [logout]);

  const getRoleDashboard = () => getDashboardForRole(authState.role);

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout, refreshAuthToken, isAuthenticated, getRoleDashboard, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
