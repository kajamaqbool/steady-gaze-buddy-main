/**
 * PHASE 8: ConnectionStatus Component
 * Displays WebSocket connection state with visual indicator
 */

import React from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';
import { useGazeStore } from '../store/gazeStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ConnectionStatus() {
  const { status, isConnected, connect, disconnect, reconnect } = useWebSocketConnection();
  const connectionStatus = useGazeStore(state => state.connectionStatus);

  const statusConfig = {
    CONNECTED: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Connected',
      color: 'bg-green-100 text-green-800 border-green-300',
      action: null,
    },
    DISCONNECTED: {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Disconnected',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      action: () => connect(),
      actionLabel: 'Connect',
    },
    CONNECTING: {
      icon: <AlertTriangle className="w-4 h-4 animate-pulse" />,
      label: 'Connecting...',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      action: null,
    },
    RECONNECTING: {
      icon: <AlertTriangle className="w-4 h-4 animate-pulse" />,
      label: 'Reconnecting...',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      action: null,
    },
    ERROR: {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Error',
      color: 'bg-red-100 text-red-800 border-red-300',
      action: () => reconnect(),
      actionLabel: 'Retry',
    },
  };

  const config = statusConfig[connectionStatus];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.color}`}>
      {config.icon}
      <span className="text-sm font-medium">{config.label}</span>
      {config.action && (
        <Button
          size="sm"
          variant="outline"
          onClick={config.action}
          className="ml-auto"
        >
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}

export default ConnectionStatus;
