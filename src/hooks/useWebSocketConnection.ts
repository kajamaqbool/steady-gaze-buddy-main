/**
 * PHASE 3 + 9: useWebSocketConnection Hook
 * Manages STOMP connection lifecycle with auto-reconnect
 */

import { useEffect, useCallback, useRef } from 'react';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { authService } from '../api/authService';
import { ConnectionStatus } from '../api/types';

export interface UseWebSocketConnectionOptions {
  autoConnect?: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to manage WebSocket connection with auto-reconnect
 */
export function useWebSocketConnection({
  autoConnect = false,
  onConnected,
  onDisconnected,
  onError,
}: UseWebSocketConnectionOptions = {}) {
  // Only subscribe to connectionStatus instead of the entire store
  const connectionStatus = useGazeStore(state => state.connectionStatus);
  const statusUnsubscribeRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Handle connection status changes
   */
  const handleStatusChange = useCallback(
    (status: ConnectionStatus) => {
      // Use getState() to avoid dependency cycles
      useGazeStore.getState().setConnectionStatus(status);

      switch (status) {
        case 'CONNECTED':
          onConnected?.();
          console.log('[useWebSocketConnection] Connected');
          break;

        case 'DISCONNECTED':
          onDisconnected?.();
          console.log('[useWebSocketConnection] Disconnected');
          break;

        case 'RECONNECTING':
          console.log('[useWebSocketConnection] Attempting to reconnect...');
          // Exponential backoff: wait before retrying
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnect();
          }, 3000);
          break;

        case 'ERROR':
          const error = new Error('WebSocket connection error');
          onError?.(error);
          console.error('[useWebSocketConnection] Connection error');
          break;

        default:
          break;
      }
    },
    [onConnected, onDisconnected, onError] // store removed from dependencies
  );

  /**
   * Connect to WebSocket and wait until CONNECTED
   */
  const connect = useCallback(async () => {
    try {
      // Ensure authenticated
      if (!authService.isAuthenticated()) {
        console.error('[useWebSocketConnection] ❌ Not authenticated');
        throw new Error('Not authenticated - please log in first');
      }

      console.log('[useWebSocketConnection] 🔌 Initiating WebSocket connect');
      useGazeStore.getState().setConnectionStatus('CONNECTING');
      await stompClient.connect();
      
      // Wait until actually connected (not just CONNECTING)
      await new Promise<void>((resolve, reject) => {
        const maxWait = 10000; // 10 second timeout
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
          if (stompClient.isConnected()) {
            clearInterval(checkInterval);
            console.log('[useWebSocketConnection] ✅ WebSocket CONNECTED');
            resolve();
            return;
          }
          
          if (Date.now() - startTime > maxWait) {
            clearInterval(checkInterval);
            console.error('[useWebSocketConnection] ❌ Connection timeout');
            reject(new Error('WebSocket connection timeout'));
          }
        }, 50);
      });
      
      useGazeStore.getState().incrementDebugMetric('reconnectCount');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[useWebSocketConnection] ❌ Connection failed:', err.message);
      useGazeStore.getState().setConnectionStatus('ERROR');
      onError?.(err);
      throw err;
    }
  }, [onError]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    stompClient.disconnect();
    useGazeStore.getState().setConnectionStatus('DISCONNECTED');
  }, []);

  /**
   * Force reconnect
   */
  const reconnect = useCallback(async () => {
    console.log('[useWebSocketConnection] Force reconnecting...');
    try {
      disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      await connect();
    } catch (error) {
      console.error('[useWebSocketConnection] Reconnect failed:', error);
    }
  }, [connect, disconnect]);

  /**
   * Setup status listener on mount
   */
  useEffect(() => {
    statusUnsubscribeRef.current = stompClient.onConnectionChange(handleStatusChange);

    return () => {
      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current();
      }
    };
  }, [handleStatusChange]);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect && authService.isAuthenticated() && !stompClient.isConnected()) {
      connect().catch(err => {
        console.error('[useWebSocketConnection] Auto-connect failed:', err);
      });
    }

    return () => {
      // Cleanup on unmount (optional - depends on app design)
      // disconnect();
    };
  }, [autoConnect, connect]);

  return {
    status: connectionStatus,
    isConnected: stompClient.isConnected(),
    connect,
    disconnect,
    reconnect,
  };
}

export default useWebSocketConnection;
