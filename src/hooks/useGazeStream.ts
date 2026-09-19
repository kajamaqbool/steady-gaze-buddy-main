import { useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { GazeFrameDto } from '../api/types';
import { GazeDataPoint } from '../types/gaze';

interface UseGazeStreamOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Hook for event-based streaming of gaze frames to backend.
 * Streams data dynamically only when new frames are provided via streamFrame.
 */
/**
 * PHASE 3: Real-time gaze frame streaming via STOMP
 * 
 * CRITICAL: Only streams frames AFTER:
 * 1. WebSocket is CONNECTED
 * 2. Session is STARTED
 * 3. streamFrame() is called with real gaze data
 */
export function useGazeStream({
  enabled = false,
  onError,
}: UseGazeStreamOptions = {}) {
  const frameCountRef = useRef<number>(0);
  const isStreamingRef = useRef<boolean>(false);
  const store = useGazeStore();

  /**
   * Send a single real gaze frame to backend via STOMP
   * 
   * Guards:
   * - Must be streaming (started)
   * - WebSocket must be connected
   * - Session must exist and be started
   */
  const streamFrame = useCallback((point: GazeDataPoint) => {
    // Guard 1: Check streaming state
    if (!isStreamingRef.current) {
      return; // Not started yet, silently ignore
    }

    // Guard 2: Check WebSocket connection
    if (!stompClient.isConnected()) {
      console.warn('[useGazeStream] ⚠️ WebSocket disconnected, dropping frame');
      store.incrementDebugMetric('framesDropped');
      return;
    }

    // Guard 3: Check session exists
    const sessionId = store.session?.sessionId;
    if (!sessionId) {
      console.warn('[useGazeStream] ⚠️ No active session, dropping frame');
      store.incrementDebugMetric('framesDropped');
      return;
    }

    // Guard 4: Check rate limit
    if (store.metrics.rateLimited) {
      store.incrementDebugMetric('framesDropped');
      return;
    }

    // Convert real tracking point to backend DTO
    const frame: GazeFrameDto = {
      frameId: uuidv4(),
      timestamp: Date.now(),
      gazeX: point.gazeX,
      gazeY: point.gazeY,
      confidence: point.confidence || 0,
      validFrame: point.faceDetected,
    };

    // Publish to STOMP
    try {
      stompClient.publish('/app/gaze.frame', {
        ...frame,
        sessionId,
      });

      store.incrementFrameCount();
      frameCountRef.current++;

      // Log every 30 frames
      if (frameCountRef.current % 30 === 0) {
        store.calculateFramesPerSecond();
        console.log('[useGazeStream] 💯 Streamed', frameCountRef.current, 'frames');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      console.error('[useGazeStream] ❌ Send error:', err);
    }
  }, [store, onError]);

  /**
   * Start streaming (enables streamFrame)
   * 
   * Prerequisites:
   * - WebSocket must be CONNECTED
   * - Session must exist
   */
  const start = useCallback(async () => {
    if (isStreamingRef.current) {
      console.log('[useGazeStream] ⚠️ Already streaming');
      return;
    }

    // Verify connection
    if (!stompClient.isConnected()) {
      const error = new Error('WebSocket not connected');
      onError?.(error);
      console.error('[useGazeStream] ❌ Start failed: WebSocket not connected');
      throw error;
    }
    console.log('[useGazeStream] ✓ WebSocket connected');

    // Verify session exists
    const currentSession = useGazeStore.getState().session;
    if (!currentSession?.sessionId) {
      const error = new Error('No active session');
      onError?.(error);
      console.error('[useGazeStream] ❌ Start failed: No active session');
      throw error;
    }
    console.log('[useGazeStream] ✓ Session active:', currentSession.sessionId);

    isStreamingRef.current = true;
    frameCountRef.current = 0;

    console.log('[useGazeStream] 🚀 Event-based streaming STARTED');
  }, [onError]);

  /**
   * Stop streaming (disables streamFrame)
   */
  const stop = useCallback(() => {
    if (!isStreamingRef.current) {
      return;
    }

    isStreamingRef.current = false;
    useGazeStore.getState().calculateFramesPerSecond();
    console.log('[useGazeStream] 🛑 Stopped streaming. Sent', frameCountRef.current, 'frames total');
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  /**
   * Start/stop based on enabled flag
   */
  useEffect(() => {
    if (enabled) {
      start().catch(err => {
        console.error('[useGazeStream] Failed to start:', err);
      });
    } else {
      stop();
    }
  }, [enabled, start, stop]);

  return {
    isStreaming: isStreamingRef.current,
    frameCount: frameCountRef.current,
    start,
    stop,
    streamFrame,
  };
}

export default useGazeStream;
