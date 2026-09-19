/**
 * PHASE 8: useResultResubscriber Hook
 * Auto-resubscribe to result queues on reconnection
 * Ensure no messages are missed after disconnect/reconnect
 */

import { useEffect, useRef, useCallback } from 'react';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { MLResultPayload, ErrorPayload, AckPayload } from '../api/types';

export interface UseResultResubscriberOptions {
  onResultsRestored?: (count: number) => void;
  onResubscribed?: () => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * Hook to handle resubscription on reconnect
 */
export function useResultResubscriber({
  onResultsRestored,
  onResubscribed,
  onError,
  enabled = true,
}: UseResultResubscriberOptions = {}) {
  const store = useGazeStore();
  const unsubscribeRefs = useRef<Map<string, () => void>>(new Map());
  const reconnectCountRef = useRef(0);
  const isSubscribedRef = useRef(false);

  /**
   * Handle result message with delivery confirmation
   */
  const handleResult = useCallback((message: any) => {
    try {
      const result = JSON.parse(message.body) as MLResultPayload;

      // Validate result
      if (!result.sessionId || !result.timestamp) {
        console.warn('[useResultResubscriber] Invalid result format:', result);
        return;
      }

      // Update store
      store.setLatestResult(result);
      store.incrementDebugMetric('resultsReceived');

      // Send ACK to backend if needed
      try {
        message.ack?.();
      } catch (error) {
        console.debug('[useResultResubscriber] Manual ACK not needed');
      }

      console.log('[useResultResubscriber] Result received:', {
        sessionId: result.sessionId,
        riskLevel: result.riskLevel,
        timestamp: new Date(result.timestamp).toLocaleTimeString(),
      });
    } catch (error) {
      console.error('[useResultResubscriber] Failed to handle result:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [store, onError]);

  /**
   * Handle ACK with rate limit detection
   */
  const handleAck = useCallback((message: any) => {
    try {
      const ack = JSON.parse(message.body) as AckPayload;

      store.recordAck(ack);

      if (ack.status === 'RATE_LIMITED') {
        console.warn('[useResultResubscriber] Rate limit detected:', ack);
      }

      console.debug('[useResultResubscriber] ACK:', {
        framesReceived: ack.framesReceived,
        framesDropped: ack.framesDropped,
        status: ack.status,
      });
    } catch (error) {
      console.error('[useResultResubscriber] Failed to handle ACK:', error);
    }
  }, [store]);

  /**
   * Handle error messages
   */
  const handleError = useCallback((message: any) => {
    try {
      const errorPayload = JSON.parse(message.body) as ErrorPayload;

      store.incrementDebugMetric('errorsReceived');

      console.error('[useResultResubscriber] Server error:', {
        errorCode: errorPayload.errorCode,
        message: errorPayload.message,
        severity: errorPayload.severity,
      });

      onError?.(new Error(`Server error: ${errorPayload.message}`));
    } catch (error) {
      console.error('[useResultResubscriber] Failed to handle error message:', error);
    }
  }, [store, onError]);

  /**
   * Subscribe to all result queues
   */
  const subscribe = useCallback(() => {
    if (!stompClient.isConnected()) {
      console.warn('[useResultResubscriber] Not connected, cannot subscribe');
      return false;
    }

    try {
      // Clear old subscriptions
      unsubscribeRefs.current.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          console.debug('[useResultResubscriber] Old unsubscribe error:', error);
        }
      });
      unsubscribeRefs.current.clear();

      // Subscribe to result queue
      const unsubResult = stompClient.subscribe('/user/queue/result', handleResult);
      unsubscribeRefs.current.set('/user/queue/result', unsubResult);

      // Subscribe to ACK queue
      const unsubAck = stompClient.subscribe('/user/queue/ack', handleAck);
      unsubscribeRefs.current.set('/user/queue/ack', unsubAck);

      // Subscribe to error queue
      const unsubError = stompClient.subscribe('/user/queue/errors', handleError);
      unsubscribeRefs.current.set('/user/queue/errors', unsubError);

      isSubscribedRef.current = true;
      reconnectCountRef.current++;

      console.log('[useResultResubscriber] Resubscribed to all queues (reconnect #' + reconnectCountRef.current + ')');
      onResubscribed?.();

      return true;
    } catch (error) {
      console.error('[useResultResubscriber] Subscription error:', error);
      isSubscribedRef.current = false;
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }, [handleResult, handleAck, handleError, onResubscribed, onError]);

  /**
   * Monitor connection status and resubscribe on reconnect
   */
  useEffect(() => {
    if (!enabled) return;

    // Monitor connection changes
    const unsubscribeConnection = stompClient.onConnectionChange(status => {
      console.log('[useResultResubscriber] Connection status:', status);

      if (status === 'CONNECTED') {
        // Delay subscription to ensure STOMP fully ready
        const timer = setTimeout(() => {
          const success = subscribe();
          if (success) {
            store.incrementDebugMetric('reconnectCount');
          }
        }, 500);

        return () => clearTimeout(timer);
      } else if (status === 'DISCONNECTED' || status === 'ERROR') {
        // Mark as unsubscribed
        isSubscribedRef.current = false;
      }
    });

    return () => {
      unsubscribeConnection?.();
      // Clean up subscriptions
      unsubscribeRefs.current.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          console.debug('[useResultResubscriber] Cleanup unsubscribe error:', error);
        }
      });
      unsubscribeRefs.current.clear();
    };
  }, [enabled, subscribe, store]);

  /**
   * Manual resubscribe function
   */
  const resubscribe = useCallback(() => {
    console.log('[useResultResubscriber] Manual resubscribe requested');
    return subscribe();
  }, [subscribe]);

  /**
   * Check subscription status
   */
  const isSubscribed = useCallback(() => {
    return isSubscribedRef.current && stompClient.isConnected();
  }, []);

  /**
   * Get reconnect stats
   */
  const getStats = useCallback(() => {
    return {
      reconnectCount: reconnectCountRef.current,
      isSubscribed: isSubscribedRef.current,
      isConnected: stompClient.isConnected(),
    };
  }, []);

  return {
    resubscribe,
    isSubscribed,
    getStats,
  };
}

export default useResultResubscriber;
