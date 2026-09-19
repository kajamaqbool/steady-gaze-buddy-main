import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { MLResultPayload } from '../api/types';

interface MlError {
  type: string;
  message: string;
  timestamp: number;
}

const MlResultDisplay: React.FC = () => {
  const storeResult = useGazeStore(state => state.latestResult);
  const connectionStatus = useGazeStore(state => state.connectionStatus);
  
  const [result, setResult] = useState<MLResultPayload | null>(storeResult);
  const [error, setError] = useState<MlError | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync with store
  useEffect(() => {
    if (storeResult && !result) {
      setResult(storeResult);
    }
  }, [storeResult, result]);

  // Handle subscriptions
  useEffect(() => {
    if (connectionStatus === 'CONNECTED') {
      setError(null);
      
      const unsubscribeResult = stompClient.subscribe('/user/queue/result', (message) => {
        try {
          const mlResult = JSON.parse(message.body);
          setResult(mlResult);
          useGazeStore.getState().setLatestResult(mlResult);
          setLoading(false);
        } catch (e) {
          console.error('Failed to parse ML result:', e);
        }
      });

      const unsubscribeErrors = stompClient.subscribe('/user/queue/errors', (message) => {
        try {
          const errorMsg = JSON.parse(message.body);
          setError({
            type: 'ML_ERROR',
            message: errorMsg.message || 'ML analysis failed',
            timestamp: Date.now()
          });
          setLoading(false);
        } catch (e) {
          console.error('Failed to parse error message:', e);
        }
      });

      return () => {
        unsubscribeResult();
        unsubscribeErrors();
      };
    } else if (connectionStatus === 'ERROR' || connectionStatus === 'DISCONNECTED') {
      if (!result && !storeResult) {
        setError({
          type: 'CONNECTION_ERROR',
          message: 'Disconnected from server.',
          timestamp: Date.now()
        });
      }
    }
  }, [connectionStatus]); // Only re-subscribe on connection status changes

  const getRiskColor = (classification: string): string => {
    switch (classification) {
      case 'LOW': return 'text-green-600';
      case 'MODERATE': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBgColor = (classification: string): string => {
    switch (classification) {
      case 'LOW': return 'bg-green-50 border-green-200';
      case 'MODERATE': return 'bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getRiskProgressColor = (classification: string): string => {
    switch (classification) {
      case 'LOW': return '#16a34a';
      case 'MODERATE': return '#ca8a04';
      case 'HIGH': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Error state
  if (error && !result) {
    return (
      <div className="bg-red-50 p-8 flex items-center justify-center rounded-xl shadow-sm border border-red-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-600 mb-4">
             ⚠️
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {error.type === 'CONNECTION_ERROR' ? 'Connection Error' : 'Analysis Failed'}
          </h3>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !result) {
    return (
      <div className="bg-blue-50 p-8 flex items-center justify-center rounded-xl border border-blue-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing Gaze Data</h3>
          <p className="text-gray-600">Running ML analysis... This may take a few seconds.</p>
        </div>
      </div>
    );
  }

  // No result state
  if (!result) {
    return (
      <div className="bg-gray-50 p-8 flex items-center justify-center rounded-xl border border-gray-200">
        <div className="text-center text-gray-400">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Awaiting ML Analysis</h3>
          <p className="text-gray-600">Finish your reading session to see the results here.</p>
        </div>
      </div>
    );
  }

  const riskPercentage = Math.round(result.riskScore * 100);
  const breakdownData = result.breakdown ? [
    { name: 'Rule-Based', value: Math.round(result.breakdown.ruleScore * 100) },
    { name: 'Random Forest', value: Math.round(result.breakdown.rfScore * 100) }
  ] : [];

  const pieData = result.breakdown ? [
    { name: 'Rule-Based (70%)', value: result.breakdown.ruleScore * 70 },
    { name: 'Random Forest (30%)', value: result.breakdown.rfScore * 30 }
  ] : [];

  const COLORS = ['#3b82f6', '#f59e0b'];

  return (
    <div className="w-full">
      <div className={`rounded-2xl border-2 p-8 mb-8 shadow-sm ${getRiskBgColor(result.classification)}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Risk Score Circle */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-300" />
                <circle cx="64" cy="64" r="60" stroke={getRiskProgressColor(result.classification)} strokeWidth="4" fill="none" strokeDasharray={`${(riskPercentage / 100) * 377} 377`} className="transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getRiskColor(result.classification)}`}>{riskPercentage}%</div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-bold ${getRiskColor(result.classification)}`}>{result.classification} RISK</div>
              <div className="text-gray-600 text-sm mt-1">Confidence: {Math.round(result.confidence * 100)}%</div>
            </div>
          </div>

          {/* Classification Details */}
          <div className="flex flex-col justify-center">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Risk Classification</label>
                <div className={`px-4 py-2 rounded-lg font-bold text-white text-center ${
                  result.classification === 'LOW' ? 'bg-green-500' :
                  result.classification === 'MODERATE' ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {result.classification}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confidence Level</label>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${
                    result.confidence > 0.7 ? 'bg-green-500' :
                    result.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${result.confidence * 100}%` }}></div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Risk Score</label>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${
                    result.riskScore < 0.33 ? 'bg-green-500' :
                    result.riskScore < 0.66 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${result.riskScore * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="flex flex-col justify-center border-l pl-8 border-black/10">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Analysis Time</label>
                <div className="text-sm text-gray-800">{formatDate(result.timestamp)}</div>
              </div>
              {result.metadata && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Samples Analyzed</label>
                    <div className="text-sm text-gray-800">{result.metadata.sampleCount} frames</div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Session Duration</label>
                    <div className="text-sm text-gray-800">{formatDuration(result.metadata.duration || 0)}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {result.breakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Algorithm Scores</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={breakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Model Contribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${(value * 100).toFixed(1)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default MlResultDisplay;
