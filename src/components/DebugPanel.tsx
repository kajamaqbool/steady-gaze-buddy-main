/**
 * PHASE 8: DebugPanel Component
 * Display system diagnostics and performance metrics
 */

import React, { useState } from 'react';
import { useGazeStore } from '../store/gazeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const store = useGazeStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const debug = store.debug;
  const metrics = store.metrics;
  const session = store.session;

  const handleReset = () => {
    store.resetDebugMetrics();
  };

  return (
    <Card className="bg-slate-50">
      <CardHeader
        className="cursor-pointer hover:bg-slate-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Debug Info</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Session Info */}
          {session && (
            <div className="bg-white p-3 rounded-lg border text-xs space-y-1 font-mono">
              <p>
                <span className="text-gray-600">Session ID:</span>{' '}
                <span className="text-blue-600">{session.sessionId.slice(0, 8)}...</span>
              </p>
              <p>
                <span className="text-gray-600">Task ID:</span> {session.taskId}
              </p>
            </div>
          )}

          {/* Streaming Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricBox label="Frames Sent" value={debug.framesSent} />
            <MetricBox label="Frames Dropped" value={debug.framesDropped} color="text-red-600" />
            <MetricBox label="Features Sent" value={debug.featuresSent} />
            <MetricBox label="ACKs Received" value={debug.acksReceived} />
            <MetricBox label="Results" value={debug.resultsReceived} color="text-green-600" />
            <MetricBox label="Errors" value={debug.errorsReceived} color="text-red-600" />
          </div>

          {/* Connection Stats */}
          <div className="bg-white p-3 rounded-lg border text-xs space-y-1 font-mono">
            <p>
              <span className="text-gray-600">Reconnect Count:</span> {debug.reconnectCount}
            </p>
            <p>
              <span className="text-gray-600">Uptime:</span>{' '}
              {formatDuration(debug.uptime)}
            </p>
            <p>
              <span className="text-gray-600">Avg Latency:</span> {metrics.latencyMs.toFixed(0)} ms
            </p>
            <p>
              <span className="text-gray-600">Rate Limited:</span>{' '}
              <span className={metrics.rateLimited ? 'text-red-600' : 'text-green-600'}>
                {metrics.rateLimited ? 'Yes' : 'No'}
              </span>
            </p>
          </div>

          {/* Store State */}
          <div className="bg-white p-3 rounded-lg border text-xs overflow-auto max-h-40">
            <details>
              <summary className="cursor-pointer font-semibold mb-2">Full State</summary>
              <pre className="text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(
                  {
                    connection: store.connectionStatus,
                    session: session
                      ? {
                          sessionId: session.sessionId.slice(0, 8),
                          frameCount: session.frameCount,
                          featureCount: session.featureCount,
                        }
                      : null,
                    metrics: {
                      fps: metrics.framesPerSecond.toFixed(1),
                      latency: metrics.latencyMs,
                      dropped: metrics.framesDropped,
                    },
                    debug: {
                      framesSent: debug.framesSent,
                      resultsReceived: debug.resultsReceived,
                      uptime: formatDuration(debug.uptime),
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function MetricBox({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white p-2 rounded border">
      <p className="text-gray-600 text-xs">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export default DebugPanel;
