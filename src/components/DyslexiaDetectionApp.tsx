/**
 * PHASE 8-11: DyslexiaDetectionApp Component
 * Complete integration example showing full pipeline
 */

import React, { useEffect } from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';
import { useServerResponses } from '../hooks/useServerResponses';
import { useFeaturePublisher } from '../hooks/useFeaturePublisher';
import { useGazeStore } from '../store/gazeStore';
import { ConnectionStatus } from './ConnectionStatus';
import { SessionControls } from './SessionControls';
import { LiveMetricsPanel } from './LiveMetricsPanel';
import { RiskIndicator } from './RiskIndicator';
import { DebugPanel } from './DebugPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Main dyslexia detection app component
 * Demonstrates complete STOMP pipeline integration
 */
export function DyslexiaDetectionApp() {
  const { status, isConnected } = useWebSocketConnection({ autoConnect: false });
  const store = useGazeStore();
  const { publishFixation, publishSaccade } = useFeaturePublisher();

  // Setup response handlers
  useServerResponses({
    enabled: true,
    onAck: (ack) => {
      // Handle ACK
      if (ack.status === 'RATE_LIMITED') {
        console.warn('Rate limited - reducing frame rate');
      }
    },
    onResult: (result) => {
      // Handle ML result
      console.log('ML Result:', result);
    },
    onError: (error) => {
      // Handle error
      console.error('Server error:', error.message);
    },
  });

  // Demo feature generation removed: use real publisher hooks from app logic

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Real-Time Dyslexia Detection System
          </h1>
          <p className="text-gray-600">
            Live gaze tracking and ML-based risk assessment
          </p>
        </div>

        {/* Authentication Status */}
        {!isConnected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Not Connected</AlertTitle>
            <AlertDescription>
              WebSocket connection is required. Make sure you're logged in and the server is running.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Connected</AlertTitle>
            <AlertDescription className="text-green-800">
              WebSocket connection established and ready for gaze streaming.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            <ConnectionStatus />
            <SessionControls />
          </div>

          {/* Center Column - Metrics */}
          <div className="lg:col-span-1 space-y-6">
            <LiveMetricsPanel />
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-1 space-y-6">
            <RiskIndicator />
          </div>
        </div>

        {/* Debug Panel */}
        <DebugPanel />

        {/* Architecture Info */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">System Architecture</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-900 space-y-2">
            <p>
              <strong>Transport:</strong> STOMP over SockJS WebSocket at /ws/gaze
            </p>
            <p>
              <strong>Authentication:</strong> JWT token in STOMP CONNECT headers
            </p>
            <p>
              <strong>Destinations:</strong>
            </p>
            <ul className="ml-4 space-y-1 font-mono text-xs">
              <li>• Send: /app/gaze.frame, /app/gaze.feature, /app/gaze.session.*</li>
              <li>• Receive: /user/queue/ack, /user/queue/result, /user/queue/errors</li>
            </ul>
            <p>
              <strong>Features:</strong> 60Hz gaze streaming, auto-reconnect, rate limiting,
              live metrics, ML result display
            </p>
          </CardContent>
        </Card>

        {/* Integration Notes */}
        <Card className="border-gray-300">
          <CardHeader>
            <CardTitle className="text-gray-900">Integration Checklist</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <IntegrationItem
              done={isConnected}
              label="WebSocket connected"
            />
            <IntegrationItem
              done={isConnected && status === 'CONNECTED'}
              label="STOMP handshake complete"
            />
            <IntegrationItem
              done={!!store.session}
              label="Session started"
            />
            <IntegrationItem
              done={store.session?.frameCount ?? 0 > 0}
              label="Frames streaming"
            />
            <IntegrationItem
              done={!!store.latestResult}
              label="ML results received"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IntegrationItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
          done
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        {done && <div className="w-2 h-2 bg-green-500 rounded-sm" />}
      </div>
      <span className={done ? 'text-green-700' : 'text-gray-600'}>{label}</span>
    </div>
  );
}

export default DyslexiaDetectionApp;
