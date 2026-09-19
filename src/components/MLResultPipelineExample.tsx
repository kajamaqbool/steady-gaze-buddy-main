/**
 * COMPLETE ML RESULT PIPELINE EXAMPLE
 * 
 * Demonstrates all 8 phases working together:
 * 1. STOMP subscription to /user/queue/result
 * 2. Result handler with parsing and validation
 * 3. State management with result history
 * 4. UI components for display
 * 5. Smooth animations without flickering
 * 6. Error handling from /user/queue/errors
 * 7. JWT security in STOMP headers
 * 8. Auto-reconnect and resubscribe
 */

import React, { useEffect, useState } from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';
import { useResultResubscriber } from '../hooks/useResultResubscriber';
import { useSmoothResultUpdate } from '../hooks/useSmoothResultUpdate';
import { useGazeStore } from '../store/gazeStore';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { RiskIndicator } from '../components/RiskIndicator';
import { MetricsPanel } from '../components/MetricsPanel';
import { ErrorHandler, useErrorHandler } from '../components/ErrorHandler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { processResult, extractInsights } from '../api/resultProcessor';
import { getResultHistoryManager } from '../api/resultHistoryManager';

/**
 * Phase 1-8 Integration Example Component
 */
export function MLResultPipelineExample() {
  const store = useGazeStore();
  const { errors, addError } = useErrorHandler();

  // PHASE 7 & 8: WebSocket connection with JWT (auto-reconnect)
  const { status, isConnected, connect, disconnect } = useWebSocketConnection({
    autoConnect: false,
    onConnected: () => {
      console.log('✅ WebSocket connected with JWT');
    },
    onError: (error) => {
      addError({
        errorCode: 'WS_ERROR',
        message: error.message,
        timestamp: Date.now(),
        severity: 'ERROR',
      });
    },
  });

  // PHASE 8: Resubscribe to result queues on reconnect
  const { resubscribe, isSubscribed, getStats } = useResultResubscriber({
    onResubscribed: () => {
      console.log('✅ Resubscribed to result queues');
    },
    onError: (error) => {
      addError({
        errorCode: 'SUBSCRIPTION_ERROR',
        message: error.message,
        timestamp: Date.now(),
        severity: 'ERROR',
      });
    },
  });

  // PHASE 5: Smooth result updates without flickering
  const smoothResult = useSmoothResultUpdate(store.latestResult, {
    debounceMs: 100,
    transitionDurationMs: 300,
    onlyOnChange: true,
  });

  const historyManager = getResultHistoryManager();
  const [processedResult, setProcessedResult] = useState<any>(null);

  // PHASE 2: Process and validate results
  useEffect(() => {
    if (!store.latestResult) return;

    // Simulate JSON from backend (in real app, this comes from STOMP)
    const rawJson = JSON.stringify(store.latestResult);

    // PHASE 1-2: Parse and validate
    const processed = processResult(rawJson, smoothResult.previous);

    if (!processed.isValid) {
      console.warn('❌ Result validation failed:', processed.errors);
      addError({
        errorCode: 'RESULT_VALIDATION_ERROR',
        message: `Failed to validate result: ${processed.errors[0]?.message || 'Unknown error'}`,
        timestamp: Date.now(),
        severity: 'WARNING',
      });
    }

    // Emit warnings
    if (processed.warnings.length > 0) {
      console.warn('⚠️ Anomalies detected:', processed.warnings);
    }

    // PHASE 3: Update history
    historyManager.addResult(processed.normalized, 10);

    setProcessedResult(processed);
  }, [store.latestResult, smoothResult.previous]);

  // Handlers
  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleResubscribe = () => {
    resubscribe();
  };

  const stats = getStats();
  const historyStats = historyManager.getStats();

  return (
    <div className="w-full space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* PHASE 6: Error Handler - Display errors */}
      <ErrorHandler
        errors={errors}
        maxVisibleErrors={3}
        autoDismiss={true}
      />

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">ML Result Pipeline</h1>
        <p className="text-gray-600">Real-time dyslexia detection results with 8-phase implementation</p>
      </div>

      {/* Connection Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PHASE 7: JWT Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Connection Status (with JWT)</span>
              <Badge variant="outline">{status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConnectionStatus />

            <div className="space-y-2">
              <div className="text-sm">
                <p className="text-gray-600">WebSocket Status</p>
                <p className="font-mono text-sm">
                  {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </p>
              </div>

              <div className="text-sm">
                <p className="text-gray-600">Result Subscriptions</p>
                <p className="font-mono text-sm">
                  {isSubscribed() ? '✅ Active' : '❌ Inactive'}
                </p>
              </div>

              <div className="text-sm">
                <p className="text-gray-600">Reconnects</p>
                <p className="font-mono text-sm">{stats.reconnectCount}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={isConnected}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Connect
              </button>
              <button
                onClick={handleDisconnect}
                disabled={!isConnected}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                Disconnect
              </button>
              <button
                onClick={handleResubscribe}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Resubscribe
              </button>
            </div>
          </CardContent>
        </Card>

        {/* PHASE 3: Result History Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Result History Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Total Results</p>
                <p className="text-2xl font-bold">{historyStats.totalResults}</p>
              </div>
              <div>
                <p className="text-gray-600">Avg Risk Score</p>
                <p className="text-2xl font-bold">
                  {historyStats.averageRiskScore.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600">Trend</p>
                <p className="text-xl font-bold">
                  {historyStats.riskTrend === 'improving' && '📈 Improving'}
                  {historyStats.riskTrend === 'degrading' && '📉 Degrading'}
                  {historyStats.riskTrend === 'stable' && '➡️ Stable'}
                  {historyStats.riskTrend === 'insufficient_data' && '❓ No Data'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Avg Confidence</p>
                <p className="text-lg font-bold">
                  {(historyStats.averageConfidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Validation Status */}
            {processedResult && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                  {processedResult.isValid ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  Result Validation: {processedResult.isValid ? 'Valid' : 'Invalid'}
                </p>
                {processedResult.errors.length > 0 && (
                  <ul className="text-xs text-red-700 mt-2 space-y-1">
                    {processedResult.errors.slice(0, 2).map((err: any, i: number) => (
                      <li key={i}>• {err.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PHASE 4: UI Components for Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PHASE 5: Smooth animated risk indicator */}
        <div>
          <RiskIndicator />
        </div>

        {/* PHASE 5: Smooth animated metrics */}
        <div>
          <MetricsPanel />
        </div>
      </div>

      {/* PHASE 2: Insights from processed result */}
      {processedResult && processedResult.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {processedResult.insights.map((insight: any, i: number) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 mt-1">
                    {insight.severity === 'critical' && <AlertCircle className="w-5 h-5 text-red-600" />}
                    {insight.severity === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                    {insight.severity === 'info' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{insight.type.replace('_', ' ')}</p>
                    <p className="text-gray-600">{insight.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Debug Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Frames Sent</p>
              <p className="text-lg font-bold">{store.debug.framesSent}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Results Received</p>
              <p className="text-lg font-bold">{store.debug.resultsReceived}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">ACKs Received</p>
              <p className="text-lg font-bold">{store.debug.acksReceived}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Errors</p>
              <p className="text-lg font-bold">{store.debug.errorsReceived}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Frames Dropped</p>
              <p className="text-lg font-bold">{store.debug.framesDropped}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Latency</p>
              <p className="text-lg font-bold">{store.metrics.latencyMs.toFixed(0)}ms</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">FPS</p>
              <p className="text-lg font-bold">{store.metrics.framesPerSecond.toFixed(1)}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <p className="text-gray-600">Uptime</p>
              <p className="text-lg font-bold">
                {Math.floor(store.debug.uptime / 1000)}s
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 1: STOMP subscription to /user/queue/result</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 2: Result handler with parsing & validation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 3: State management with result history</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 4: UI components (RiskIndicator, MetricsPanel)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 5: Smooth animations without flickering</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 6: Error handler for /user/queue/errors</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 7: JWT security in STOMP headers</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm">PHASE 8: Auto-reconnect & resubscribe</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p>1. Click "Connect" to establish WebSocket connection (JWT sent automatically)</p>
          <p>2. Result subscriptions activate automatically on connect</p>
          <p>3. Backend sends ML results → Automatically parsed & validated</p>
          <p>4. Results stored in history → Smooth UI updates with animations</p>
          <p>5. Errors display as toast notifications (auto-dismiss)</p>
          <p>6. On disconnect → Auto-reconnect & resubscribe (Phase 8)</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default MLResultPipelineExample;
