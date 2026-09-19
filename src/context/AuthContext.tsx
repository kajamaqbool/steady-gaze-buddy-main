import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authService, getStoredTokens, onTokenUpdate } from '../api/authService';
import { LoginRequest, RegisterRequest } from '../api/types';
import { stompClient } from '../api/wsClient';


interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  expiresAt: number | null;
}

interface AuthContextType extends AuthState {
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshAuthToken: () => Promise<void>;
  isAuthenticated: () => boolean;
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
      setAuthState({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        role: tokens.role,
        expiresAt: tokens.expiresAt,
      });
    }
    setIsLoading(false);

    // Subscribe to external token updates (like axios refresh interceptor)
    const unsubscribe = onTokenUpdate((newTokens) => {
      if (newTokens) {
        setAuthState({
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          role: newTokens.role,
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

  const login = async (request: LoginRequest) => {
    const tokens = await authService.login(request);
    setAuthState({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: tokens.role,
      expiresAt: tokens.expiresAt,
    });
  };

  const register = async (request: RegisterRequest) => {
    await authService.register(request);
    // Forced login flow: do not auto-login after registration
  };

  const logout = useCallback(() => {
    authService.logout();
    
    // Disconnect WebSocket
    try {
      stompClient.disconnect();
    } catch (e) {
      console.warn("Error disconnecting websocket on logout", e);
    }
    
    // Using window.location.href to fully reset app state and redirect
    window.location.href = '/login';
  }, []);

  const refreshAuthToken = async () => {
    try {
      const newTokens = await authService.refreshToken();
      setAuthState({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        role: newTokens.role,
        expiresAt: newTokens.expiresAt,
      });
    } catch (error) {
      logout();
      throw error;
    }
  };

  const isAuthenticated = () => {
    if (!authState.accessToken || !authState.expiresAt) return false;
    return Date.now() < authState.expiresAt;
  };

  // Provide global access to logout for wsClient or axios interceptors if needed
  useEffect(() => {
    (window as any).__logout = logout;
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout, refreshAuthToken, isAuthenticated, isLoading }}>
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
