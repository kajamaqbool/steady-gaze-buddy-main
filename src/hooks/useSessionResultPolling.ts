/**
 * Custom Hook: useSessionResultPolling
 * REST fallback + WebSocket race handling for ML Session Results
 * 
 * Rules:
 * 1. Polls GET /api/gaze/sessions/{sessionId}/result every 1s (max 20 attempts).
 * 2. Stops immediately on 200 OK.
 * 3. Uses resultAlreadyReceived flag to avoid WS vs REST race conditions.
 * 4. Displays "Still processing — this is taking longer than usual" after 20 attempts.
 * 5. Stops immediately on 401/403 errors and sets auth/permission error state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGazeStore } from '../store/gazeStore';
import { fetchSessionResult, SessionResultError } from '../api/sessionManager';
import { stompClient } from '../api/wsClient';
import { MLResultPayload } from '../api/types';

export interface UseSessionResultPollingOptions {
  sessionId?: string | null;
  enabled?: boolean;
}

export interface UseSessionResultPollingReturn {
  result: MLResultPayload | null;
  status: 'idle' | 'polling' | 'success' | 'slow' | 'error';
  error: { message: string; status?: number; isForbidden?: boolean; isUnauthorized?: boolean } | null;
  attemptCount: number;
  checkAgain: () => void;
  isPolling: boolean;
}

export function useSessionResultPolling({
  sessionId,
  enabled = true,
}: UseSessionResultPollingOptions = {}): UseSessionResultPollingReturn {
  const storeResult = useGazeStore(state => state.latestResult);
  const lastEndedSessionId = useGazeStore(state => state.lastEndedSessionId);
  
  const targetSessionId = sessionId || lastEndedSessionId;

  const [result, setResult] = useState<MLResultPayload | null>(storeResult);
  const [status, setStatus] = useState<'idle' | 'polling' | 'success' | 'slow' | 'error'>(
    storeResult ? 'success' : 'idle'
  );
  const [error, setError] = useState<{ message: string; status?: number; isForbidden?: boolean; isUnauthorized?: boolean } | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const resultAlreadyReceivedRef = useRef<boolean>(!!storeResult);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with global storeResult if set externally
  useEffect(() => {
    if (storeResult && !resultAlreadyReceivedRef.current) {
      resultAlreadyReceivedRef.current = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setResult(storeResult);
      setStatus('success');
    }
  }, [storeResult]);

  // Subscribe to WebSocket /user/queue/result for push delivery
  useEffect(() => {
    if (!enabled || !stompClient.isConnected()) return;

    const unsubResult = stompClient.subscribe('/user/queue/result', (message) => {
      try {
        const mlResult = JSON.parse(message.body) as MLResultPayload;
        if (resultAlreadyReceivedRef.current) {
          console.log('[useSessionResultPolling] WS result received but already handled (ignoring duplicate)');
          return;
        }

        resultAlreadyReceivedRef.current = true;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        console.log('[useSessionResultPolling] ✅ Result received via WebSocket push');
        useGazeStore.getState().setLatestResult(mlResult);
        setResult(mlResult);
        setStatus('success');
      } catch (err) {
        console.error('[useSessionResultPolling] Error parsing WS result:', err);
      }
    });

    return () => {
      unsubResult();
    };
  }, [enabled]);

  const executePollCycle = useCallback(async (sessionIdToPoll: string) => {
    if (resultAlreadyReceivedRef.current) return;

    setStatus('polling');
    setError(null);
    let attempts = 0;

    const pollStep = async () => {
      if (resultAlreadyReceivedRef.current) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }

      attempts++;
      setAttemptCount(attempts);
      console.log(`[useSessionResultPolling] Poll #${attempts}/20 for session: ${sessionIdToPoll}`);

      try {
        const restResult = await fetchSessionResult(sessionIdToPoll);

        if (restResult) {
          if (resultAlreadyReceivedRef.current) return;

          resultAlreadyReceivedRef.current = true;
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          console.log('[useSessionResultPolling] ✅ Result received via REST fallback');
          useGazeStore.getState().setLatestResult(restResult);
          setResult(restResult);
          setStatus('success');
          return;
        }

        // 202 status returned (pending)
        if (attempts >= 20) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          if (!resultAlreadyReceivedRef.current) {
            console.warn('[useSessionResultPolling] 20 polling attempts completed. ML processing is taking longer than usual.');
            setStatus('slow');
          }
        }
      } catch (err) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        if (err instanceof SessionResultError) {
          console.error(`[useSessionResultPolling] Auth/Permission error (${err.status}):`, err.message);
          setError({
            message: err.message,
            status: err.status,
            isForbidden: err.isForbidden,
            isUnauthorized: err.isUnauthorized,
          });
          setStatus('error');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useSessionResultPolling] Error polling result:', message);
          setError({ message });
          setStatus('error');
        }
      }
    };

    // Execute first poll immediately
    await pollStep();

    // Schedule remaining polls every 1 second (1000ms)
    if (!resultAlreadyReceivedRef.current && attempts < 20) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(pollStep, 1000);
    }
  }, []);

  // Trigger polling loop when targetSessionId changes and no result is loaded
  useEffect(() => {
    if (!enabled || !targetSessionId || resultAlreadyReceivedRef.current) return;

    executePollCycle(targetSessionId);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, targetSessionId, executePollCycle]);

  const checkAgain = useCallback(() => {
    if (!targetSessionId) return;
    resultAlreadyReceivedRef.current = false;
    setAttemptCount(0);
    executePollCycle(targetSessionId);
  }, [targetSessionId, executePollCycle]);

  return {
    result,
    status,
    error,
    attemptCount,
    checkAgain,
    isPolling: status === 'polling',
  };
}

export default useSessionResultPolling;
