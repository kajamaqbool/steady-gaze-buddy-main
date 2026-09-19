/**
 * PHASE 8: RiskIndicator Component
 * Display dyslexia risk level and ML result details
 */

import React from 'react';
import { useGazeStore } from '../store/gazeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RiskIndicator() {
  const latestResult = useGazeStore(state => state.latestResult);

  if (!latestResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Waiting for ML results...</p>
        </CardContent>
      </Card>
    );
  }

  const riskConfig = {
    LOW: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-900',
      badge: 'bg-green-100 text-green-800',
      label: 'Low Risk',
    },
    MODERATE: {
      icon: <AlertTriangle className="w-8 h-8 text-yellow-600" />,
      color: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-900',
      badge: 'bg-yellow-100 text-yellow-800',
      label: 'Moderate Risk',
    },
    HIGH: {
      icon: <AlertCircle className="w-8 h-8 text-red-600" />,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-900',
      badge: 'bg-red-100 text-red-800',
      label: 'High Risk',
    },
  };

  const config = riskConfig[latestResult.riskLevel];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Level Display */}
        <div className={`p-6 rounded-lg border-2 ${config.color}`}>
          <div className="flex items-start gap-4">
            {config.icon}
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${config.textColor}`}>{config.label}</h3>
              <p className={`text-sm mt-1 ${config.textColor}`}>
                {latestResult.classification}
              </p>
            </div>
          </div>

          {/* Risk Score */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Risk Score</span>
              <span className={`text-2xl font-bold ${config.textColor}`}>
                {latestResult.riskScore.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  latestResult.riskLevel === 'LOW' && 'bg-green-500',
                  latestResult.riskLevel === 'MODERATE' && 'bg-yellow-500',
                  latestResult.riskLevel === 'HIGH' && 'bg-red-500'
                )}
                style={{ width: `${latestResult.riskScore}%` }}
              />
            </div>
          </div>

          {/* Confidence */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Confidence</span>
              <span className="text-sm font-mono">
                {(latestResult.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Feature Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Feature Analysis</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <FeatureMetric
              label="Fixation Stability"
              value={latestResult.features.fixationStability}
            />
            <FeatureMetric
              label="Saccade Pattern"
              value={latestResult.features.saccadePattern}
            />
            <FeatureMetric
              label="Reading Speed"
              value={latestResult.features.readingSpeed}
            />
            <FeatureMetric
              label="Comprehension"
              value={latestResult.features.comprehensionIndex}
            />
          </div>
        </div>

        {/* Recommendations */}
        {latestResult.recommendations && latestResult.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recommendations</h4>
            <ul className="space-y-1">
              {latestResult.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Updated: {new Date(latestResult.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="p-2 bg-gray-50 rounded-lg">
      <p className="text-gray-600">{label}</p>
      <p className="text-lg font-bold">{(value * 100).toFixed(0)}%</p>
    </div>
  );
}

export default RiskIndicator;
