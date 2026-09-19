/**
 * PHASE 4: Session Manager
 * Handles session lifecycle + STOMP communication
 * 
 * CRITICAL: Enforces strict lifecycle:
 * 1. WebSocket must be CONNECTED
 * 2. Session START must be sent
 * 3. Session START verified before streaming frames
 * 4. Session END sent at completion
 */

import { stompClient } from './wsClient';
import { useGazeStore } from '../store/gazeStore';
import { SessionStartPayload, SessionEndPayload } from './types';

export class SessionManager {
  /**
   * Start a gaze tracking session
   * 
   * FLOW:
   * 1. Verify WebSocket CONNECTED
   * 2. Create session in store
   * 3. Publish /app/gaze.session.start
   * 4. Return session ID (with logging)
   */
  static async startSession(
    taskId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    console.log('[SessionManager] 🚀 Starting session for task:', taskId);
    
    if (!stompClient.isConnected()) {
      console.error('[SessionManager] ❌ WebSocket NOT connected');
      throw new Error('WebSocket not connected - cannot start session');
    }
    console.log('[SessionManager] ✓ WebSocket connected');

    // Start session in store
    useGazeStore.getState().startSession(taskId, metadata);
    const session = useGazeStore.getState().session;

    if (!session) {
      console.error('[SessionManager] ❌ Failed to create session in store');
      throw new Error('Failed to initialize session in store');
    }
    console.log('[SessionManager] ✓ Session created in store:', session.sessionId);

    // Prepare payload
    const payload: SessionStartPayload = {
      sessionId: session.sessionId,
      taskId,
      metadata: {
        userId: metadata.userId || 'anonymous',
        timestamp: Date.now(),
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
        ...metadata,
      },
    };

    // Send to server
    try {
      console.log('[SessionManager] 📤 Publishing /app/gaze.session.start');
      stompClient.publish('/app/gaze.session.start', payload);
      
      console.log('[SessionManager] ✅ Session START published:', session.sessionId);
      return session.sessionId;
    } catch (error) {
      console.error('[SessionManager] ❌ Failed to start session:', error);
      useGazeStore.getState().endSession();
      throw error;
    }
  }

  /**
   * End the current gaze tracking session
   */
  static async endSession(): Promise<void> {
    console.log('[SessionManager] 🛑 Ending session');
    
    if (!stompClient.isConnected()) {
      console.warn('[SessionManager] ⚠️ WebSocket not connected, ending session locally only');
    }

    const session = useGazeStore.getState().endSession();
    if (!session) {
      console.warn('[SessionManager] ⚠️ No active session to end');
      return;
    }

    const metrics = useGazeStore.getState().metrics;
    const durationMs = Date.now() - session.startTime;

    // Prepare payload
    const payload: SessionEndPayload = {
      sessionId: session.sessionId,
      frameCount: session.frameCount,
      featureCount: session.featureCount,
      durationMs,
      metrics: {
        avgFixationDuration: metrics.latencyMs,
        readingPace: metrics.framesPerSecond,
      },
    };

    // Send to server (best effort)
    if (stompClient.isConnected()) {
      try {
        console.log('[SessionManager] 📤 Publishing /app/gaze.session.end');
        stompClient.publish('/app/gaze.session.end', payload);
        console.log('[SessionManager] ✓ Session END sent:', session.sessionId);
        console.log('[SessionManager] ✅ Session ended. Stats: duration=', durationMs, 'ms, frames=', session.frameCount);
      } catch (error) {
        console.error('[SessionManager] ❌ Failed to send session end:', error);
      }
    }
  }

  /**
   * Get current session ID
   */
  static getCurrentSessionId(): string | null {
    return useGazeStore.getState().session?.sessionId || null;
  }

  /**
   * Check if session is active
   */
  static isSessionActive(): boolean {
    return useGazeStore.getState().isSessionActive();
  }

  /**
   * Get session summary
   */
  static getSessionSummary() {
    const session = useGazeStore.getState().session;
    const metrics = useGazeStore.getState().metrics;

    if (!session) return null;

    return {
      sessionId: session.sessionId,
      taskId: session.taskId,
      duration: Date.now() - session.startTime,
      frameCount: session.frameCount,
      featureCount: session.featureCount,
      framesPerSecond: metrics.framesPerSecond,
      acksReceived: metrics.acksReceived,
      framesDropped: metrics.framesDropped,
      averageLatency: metrics.latencyMs,
      rateLimited: metrics.rateLimited,
    };
  }
}

export default SessionManager;
