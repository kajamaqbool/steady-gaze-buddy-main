/**
 * PHASE 8: SessionControls Component
 * Start/stop gaze tracking session
 */

import React, { useState } from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';
import { stompClient } from '../api/wsClient';
import { useGazeStream } from '../hooks/useGazeStream';
import { useServerResponses } from '../hooks/useServerResponses';
import { useGazeStore } from '../store/gazeStore';
import SessionManager from '../api/sessionManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Square } from 'lucide-react';

export function SessionControls() {
  const { status, connect } = useWebSocketConnection();
  const store = useGazeStore();
  const session = store.session;

  const [taskId, setTaskId] = useState('reading-task-001');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isStreaming, start: startStream, stop: stopStream } = useGazeStream({
    enabled: !!session,
  });

  // Listen for server responses
  useServerResponses({ enabled: !!session });

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);

    try {
      if (status !== 'CONNECTED') {
        // Try to connect (will refresh token if needed)
        await connect();
      }

      if (status !== 'CONNECTED' && !stompClient.isConnected()) {
        throw new Error('WebSocket not connected');
      }

      const sessionId = await SessionManager.startSession(taskId, {
        userId: 'current-user',
        timestamp: Date.now(),
      });

      console.log('Session started:', sessionId);
      await startStream();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to start session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    setLoading(true);
    setError(null);

    try {
      stopStream();
      await SessionManager.endSession();
      console.log('Session ended');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to end session:', err);
    } finally {
      setLoading(false);
    }
  };

  const isRunning = !!session;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Task ID</label>
        <Input
          value={taskId}
          onChange={e => setTaskId(e.target.value)}
          placeholder="Enter task identifier"
          disabled={isRunning}
        />
      </div>

      <div className="flex gap-3">
        {!isRunning ? (
          <Button
            onClick={handleStartSession}
            disabled={status !== 'CONNECTED' || loading}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        ) : (
          <Button
            onClick={handleEndSession}
            disabled={loading}
            variant="destructive"
            className="flex-1"
          >
            <Square className="w-4 h-4 mr-2" />
            End Session
          </Button>
        )}
      </div>

      {isRunning && (
        <Badge variant="outline" className="w-full justify-center py-2">
          Session active • {store.metrics.framesPerSecond.toFixed(1)} FPS
        </Badge>
      )}

      {error && (
        <div className="flex gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default SessionControls;
