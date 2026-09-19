/**
 * PHASE 4: MetricsPanel Component
 * Display detailed ML metrics and feature breakdown
 */

import React from 'react';
import { useGazeStore } from '../store/gazeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  color?: 'green' | 'yellow' | 'red' | 'blue';
}

function MetricCard({ label, value, unit = '', min = 0, max = 100, color = 'blue' }: MetricCardProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const safePercentage = Math.max(0, Math.min(100, percentage));

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-mono font-bold text-gray-900">
          {value.toFixed(value > 10 ? 1 : 2)}{unit}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${safePercentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * MetricsPanel - Display comprehensive ML metrics
 */
export function MetricsPanel() {
  const latestResult = useGazeStore(state => state.latestResult);

  if (!latestResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Waiting for ML results...</p>
        </CardContent>
      </Card>
    );
  }

  const { features } = latestResult;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Feature Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fixation Stability */}
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">Fixation Stability</h3>
            <MetricCard
              label="Stability Score"
              value={features.fixationStability * 100}
              unit="%"
              max={100}
              color={features.fixationStability > 0.7 ? 'green' : features.fixationStability > 0.4 ? 'yellow' : 'red'}
            />
            <p className="text-xs text-gray-600">
              {features.fixationStability > 0.7
                ? 'Excellent fixation stability during reading'
                : features.fixationStability > 0.4
                ? 'Moderate fixation stability - some wobbling detected'
                : 'Low fixation stability - attention may be scattered'}
            </p>
          </div>

          {/* Saccade Pattern */}
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
            <h3 className="font-semibold text-purple-900">Saccade Pattern</h3>
            <MetricCard
              label="Pattern Quality"
              value={features.saccadePattern * 100}
              unit="%"
              max={100}
              color={features.saccadePattern > 0.7 ? 'green' : features.saccadePattern > 0.4 ? 'yellow' : 'red'}
            />
            <p className="text-xs text-gray-600">
              {features.saccadePattern > 0.7
                ? 'Smooth, regular eye movements'
                : features.saccadePattern > 0.4
                ? 'Irregular saccades detected - may indicate reading difficulty'
                : 'Highly irregular saccade patterns - possible dyslexia marker'}
            </p>
          </div>

          {/* Reading Speed */}
          <div className="space-y-3 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-900">Reading Speed</h3>
            <MetricCard
              label="Speed Index"
              value={features.readingSpeed * 100}
              unit="%"
              max={100}
              color={features.readingSpeed > 0.7 ? 'green' : features.readingSpeed > 0.4 ? 'yellow' : 'red'}
            />
            <p className="text-xs text-gray-600">
              {features.readingSpeed > 0.7
                ? 'Fast reading pace detected'
                : features.readingSpeed > 0.4
                ? 'Normal reading pace'
                : 'Slow reading pace - may indicate processing delays'}
            </p>
          </div>

          {/* Comprehension */}
          <div className="space-y-3 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-900">Comprehension Index</h3>
            <MetricCard
              label="Comprehension"
              value={features.comprehensionIndex * 100}
              unit="%"
              max={100}
              color={features.comprehensionIndex > 0.7 ? 'green' : features.comprehensionIndex > 0.4 ? 'yellow' : 'red'}
            />
            <p className="text-xs text-gray-600">
              {features.comprehensionIndex > 0.7
                ? 'Strong comprehension indicators'
                : features.comprehensionIndex > 0.4
                ? 'Moderate comprehension'
                : 'Comprehension index low - may need support'}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <h3 className="font-semibold text-gray-900">Summary</h3>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Average Score</p>
              <p className="text-lg font-bold text-gray-900">
                {(
                  (features.fixationStability + 
                   features.saccadePattern + 
                   features.readingSpeed + 
                   features.comprehensionIndex) / 4 * 100
                ).toFixed(1)}%
              </p>
            </div>
            
            <div>
              <p className="text-gray-600">Confidence</p>
              <p className="text-lg font-bold text-gray-900">
                {(latestResult.confidence * 100).toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-gray-600">Strongest Metric</p>
              <p className="text-lg font-bold text-blue-600">
                {
                  Math.max(
                    features.fixationStability,
                    features.saccadePattern,
                    features.readingSpeed,
                    features.comprehensionIndex,
                  ) === features.fixationStability ? 'Fixation'
                    : Math.max(
                      features.fixationStability,
                      features.saccadePattern,
                      features.readingSpeed,
                      features.comprehensionIndex,
                    ) === features.saccadePattern ? 'Saccade'
                    : Math.max(
                      features.fixationStability,
                      features.saccadePattern,
                      features.readingSpeed,
                      features.comprehensionIndex,
                    ) === features.readingSpeed ? 'Speed'
                    : 'Comprehension'
                }
              </p>
            </div>

            <div>
              <p className="text-gray-600">Weakest Metric</p>
              <p className="text-lg font-bold text-red-600">
                {
                  Math.min(
                    features.fixationStability,
                    features.saccadePattern,
                    features.readingSpeed,
                    features.comprehensionIndex,
                  ) === features.fixationStability ? 'Fixation'
                    : Math.min(
                      features.fixationStability,
                      features.saccadePattern,
                      features.readingSpeed,
                      features.comprehensionIndex,
                    ) === features.saccadePattern ? 'Saccade'
                    : Math.min(
                      features.fixationStability,
                      features.saccadePattern,
                      features.readingSpeed,
                      features.comprehensionIndex,
                    ) === features.readingSpeed ? 'Speed'
                    : 'Comprehension'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Update Info */}
        <div className="text-xs text-gray-500 text-right pt-2 border-t">
          Last updated: {new Date(latestResult.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricsPanel;
