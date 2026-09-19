/**
 * PHASE 7: useServerResponses Hook
 * Handle ACK, ML results, and errors from backend
 */

import { useEffect, useCallback, useRef } from 'react';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { AckPayload, MLResultPayload, ErrorPayload } from '../api/types';

export interface UseServerResponsesOptions {
  onAck?: (ack: AckPayload) => void;
  onResult?: (result: MLResultPayload) => void;
  onError?: (error: ErrorPayload) => void;
  enabled?: boolean;
}

/**
 * Hook to handle server responses from /user/queue/* destinations
 */
export function useServerResponses({
  onAck,
  onResult,
  onError,
  enabled = true,
}: UseServerResponsesOptions = {}) {
  const store = useGazeStore();
  const unsubscribeRef = useRef<Array<() => void>>([]);

  /**
   * Parse and handle ACK message
   */
  const handleAck = useCallback((message: { body: string }) => {
    try {
      const ack = JSON.parse(message.body) as AckPayload;

      // Update store
      store.recordAck(ack);

      // If rate limited, reduce frame send rate
      if (ack.status === 'RATE_LIMITED') {
        console.warn('[useServerResponses] Rate limited detected');
      }

      onAck?.(ack);
      console.log('[useServerResponses] ACK:', ack);
    } catch (error) {
      console.error('[useServerResponses] Failed to parse ACK:', error);
    }
  }, [store, onAck]);

  /**
   * Parse and handle ML result
   */
  const handleResult = useCallback((message: { body: string }) => {
    try {
      const result = JSON.parse(message.body) as MLResultPayload;

      // Update store with latest result
      store.setLatestResult(result);

      onResult?.(result);
      console.log('[useServerResponses] ML Result:', result);
    } catch (error) {
      console.error('[useServerResponses] Failed to parse result:', error);
    }
  }, [store, onResult]);

  /**
   * Parse and handle error message
   */
  const handleError = useCallback((message: { body: string }) => {
    try {
      const error = JSON.parse(message.body) as ErrorPayload;

      store.incrementDebugMetric('errorsReceived');

      onError?.(error);
      console.error('[useServerResponses] Server error:', error.message);
    } catch (err) {
      console.error('[useServerResponses] Failed to parse error:', err);
    }
  }, [store, onError]);

  /**
   * Setup subscriptions
   */
  useEffect(() => {
    if (!enabled || !stompClient.isConnected()) {
      return;
    }

    // Subscribe to ACK queue
    const unsubAck = stompClient.subscribe('/user/queue/ack', handleAck);
    unsubscribeRef.current.push(unsubAck);

    // Subscribe to result queue
    const unsubResult = stompClient.subscribe('/user/queue/result', handleResult);
    unsubscribeRef.current.push(unsubResult);

    // Subscribe to error queue
    const unsubError = stompClient.subscribe('/user/queue/errors', handleError);
    unsubscribeRef.current.push(unsubError);

    console.log('[useServerResponses] Subscriptions established');

    // Cleanup
    return () => {
      unsubscribeRef.current.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          console.error('[useServerResponses] Unsubscribe error:', error);
        }
      });
      unsubscribeRef.current = [];
    };
  }, [enabled, handleAck, handleResult, handleError]);

  return {
    isListening: enabled && stompClient.isConnected(),
  };
}

export default useServerResponses;
