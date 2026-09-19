/**
 * Real-time quality monitor component
 * Displays tracking confidence, face stability, gaze jitter
 */

import React from "react";
import type { SessionQuality } from "@/types/gazeProcessing";

interface QualityMonitorProps {
  quality: SessionQuality | null;
  isTracking: boolean;
}

export const QualityMonitor: React.FC<QualityMonitorProps> = ({
  quality,
  isTracking,
}) => {
  if (!isTracking || !quality) {
    return null;
  }

  // Color coding for metrics
  const getMetricColor = (value: number, threshold: number): string => {
    if (value >= threshold * 0.9) return "text-green-500";
    if (value >= threshold * 0.7) return "text-yellow-500";
    return "text-red-500";
  };

  const getJitterColor = (jitter: number): string => {
    if (jitter < 10) return "text-green-500";
    if (jitter < 25) return "text-yellow-500";
    return "text-red-500";
  };

  const getDeviationColor = (deviation: number, threshold: number): string => {
    if (deviation < threshold * 0.3) return "text-green-500";
    if (deviation < threshold * 0.7) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-xs">
      {/* Header */}
      <div className="border-b border-blue-500 pb-2 mb-2">
        <div className="font-bold flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              quality.isValid ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {quality.isValid ? "✅ VALID" : "❌ INVALID"}
        </div>
      </div>

      {/* Tracking Confidence */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Tracking</span>
          <span
            className={getMetricColor(
              quality.trackingConfidence,
              0.7
            )}
          >
            {(quality.trackingConfidence * 100).toFixed(0)}%
          </span>
        </div>
        <ProgressBar
          value={quality.trackingConfidence}
          threshold={0.7}
        />
      </div>

      {/* Face Stability */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Face Stable</span>
          <span
            className={getMetricColor(quality.faceStability, 0.8)}
          >
            {(quality.faceStability * 100).toFixed(0)}%
          </span>
        </div>
        <ProgressBar value={quality.faceStability} threshold={0.8} />
      </div>

      {/* Gaze Jitter */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Gaze Jitter</span>
          <span className={getJitterColor(quality.gazeJitter)}>
            {quality.gazeJitter.toFixed(1)}px
          </span>
        </div>
      </div>

      {/* Vertical Deviation */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Vert. Dev</span>
          <span
            className={getDeviationColor(
              quality.verticalDeviation,
              100
            )}
          >
            {quality.verticalDeviation.toFixed(0)}px
          </span>
        </div>
      </div>

      {/* Skipped Words */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Skipped</span>
          <span
            className={getMetricColor(
              1 - quality.skippedWordRate,
              0.6
            )}
          >
            {(quality.skippedWordRate * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Saccades */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Saccades</span>
          <span
            className={
              quality.saccadeCount >= 10 ? "text-green-500" : "text-red-500"
            }
          >
            {quality.saccadeCount}
          </span>
        </div>
      </div>

      {/* Fixations */}
      <div className="mb-3">
        <div className="flex justify-between">
          <span>Fixations</span>
          <span className="text-blue-500">{quality.fixationCount}</span>
        </div>
      </div>

      {/* Invalid Reasons */}
      {!quality.isValid && quality.invalidReasons.length > 0 && (
        <div className="border-t border-red-500 pt-2">
          <div className="text-red-400 font-bold mb-1">Issues:</div>
          {quality.invalidReasons.map((reason) => (
            <div key={reason} className="text-red-400 text-xs mb-1">
              • {reason}
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {quality.isValid && (
        <div className="border-t border-green-500 pt-2">
          <div className="text-green-400 text-xs">
            ✓ Good tracking quality
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
  value: number; // 0-1
  threshold: number; // Green threshold
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, threshold }) => {
  const percentage = Math.min(100, value * 100);
  const isGood = value >= threshold;

  return (
    <div className="w-full bg-gray-700 rounded h-1.5 overflow-hidden mb-1">
      <div
        style={{
          width: `${percentage}%`,
          backgroundColor: isGood ? "#22c55e" : "#eab308",
        }}
        className="h-full transition-all duration-200"
      />
    </div>
  );
};
