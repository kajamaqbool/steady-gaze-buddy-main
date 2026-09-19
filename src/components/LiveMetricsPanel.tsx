/**
 * PHASE 8: LiveMetricsPanel Component
 * Display real-time streaming metrics
 */

import React, { useEffect, useState } from 'react';
import { useGazeStore } from '../store/gazeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, Zap, TrendingUp } from 'lucide-react';

export function LiveMetricsPanel() {
  const store = useGazeStore();
  const [sessionDuration, setSessionDuration] = useState<string>('0:00');

  // Update session duration
  useEffect(() => {
    const interval = setInterval(() => {
      if (store.session?.isActive) {
        const elapsedMs = Date.now() - store.session.startTime;
        const seconds = Math.floor((elapsedMs % 60000) / 1000);
        const minutes = Math.floor(elapsedMs / 60000);
        setSessionDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [store.session]);

  if (!store.session?.isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No active session</p>
        </CardContent>
      </Card>
    );
  }

  const fps = store.metrics.framesPerSecond;
  const fpsHealth = Math.min(100, (fps / 60) * 100); // 60 FPS = 100%
  const packetLoss = store.debug.framesDropped;
  const latency = store.metrics.latencyMs;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Duration */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Duration</span>
          <span className="text-2xl font-bold tabular-nums">{sessionDuration}</span>
        </div>

        {/* Frames Per Second */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Frame Rate</span>
            </div>
            <span className="text-sm font-mono">{fps.toFixed(1)} FPS</span>
          </div>
          <Progress value={fpsHealth} className="h-2" />
        </div>

        {/* ACK Latency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">Latency</span>
            </div>
            <span className="text-sm font-mono">{latency.toFixed(0)} ms</span>
          </div>
          <Progress
            value={Math.min(100, (latency / 500) * 100)} // 500ms = max
            className="h-2"
          />
        </div>

        {/* Frame Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <p className="text-2xl font-bold">{store.session.frameCount}</p>
            <p className="text-gray-600">Frames Sent</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{store.session.featureCount}</p>
            <p className="text-gray-600">Features</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{packetLoss}</p>
            <p className="text-gray-600">Dropped</p>
          </div>
        </div>

        {/* Rate Limit Warning */}
        {store.metrics.rateLimited && (
          <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span>Rate limited - reducing send frequency</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveMetricsPanel;
