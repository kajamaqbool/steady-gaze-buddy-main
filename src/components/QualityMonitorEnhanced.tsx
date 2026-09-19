/**
 * Real-Time Quality Monitor Component
 * Displays live tracking quality metrics with visual feedback
 */

import React, { useMemo } from "react";
import type { SessionQuality } from "@/lib/sessionValidation";

interface QualityMonitorProps {
  quality: SessionQuality;
  isLive?: boolean;
}

// Helper functions for ternary operations
function getStabilityLabel(verticalDeviation: number): string {
  if (verticalDeviation <= 50) return "Excellent";
  if (verticalDeviation <= 100) return "Good";
  return "Poor";
}

function getJitterLabel(jitterAmount: number): string {
  if (jitterAmount <= 5) return "Smooth";
  if (jitterAmount <= 10) return "Stable";
  return "Noisy";
}

export const QualityMonitor: React.FC<QualityMonitorProps> = ({ quality, isLive = true }) => {
  const statusColor = useMemo(() => {
    if (quality.overallScore >= 80) return "bg-green-500";
    if (quality.overallScore >= 60) return "bg-yellow-500";
    return "bg-red-500";
  }, [quality.overallScore]);

  const statusIcon = useMemo(() => {
    if (quality.overallScore >= 80) return "✅";
    if (quality.overallScore >= 60) return "⚠️";
    return "❌";
  }, [quality.overallScore]);

  const metricStatus = (value: number, min: number, max: number) => {
    if (value >= min && value <= max) return "text-green-600";
    if (value >= min * 0.8) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isLive ? "👁️ Live Tracking" : "📊 Quality Report"}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusIcon}</span>
          <div>
            <div className="text-xs text-muted-foreground">Overall Score</div>
            <div className={`text-lg font-bold ${statusColor.replace("bg-", "text-")}`}>
              {quality.overallScore}%
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tracking Confidence */}
        <div className="p-2 bg-muted/50 rounded">
          <div className="text-xs text-muted-foreground">Tracking</div>
          <div className={`text-lg font-semibold ${metricStatus(quality.metrics.trackingConfidence, 70, 100)}`}>
            {quality.metrics.trackingConfidence.toFixed(0)}%
          </div>
          <div className="w-full bg-muted h-1.5 rounded mt-1">
            <div
              className="h-full bg-green-500 rounded transition-all"
              style={{ width: `${quality.metrics.trackingConfidence}%` }}
            />
          </div>
        </div>

        {/* Face Stability */}
        <div className="p-2 bg-muted/50 rounded">
          <div className="text-xs text-muted-foreground">Face Aligned</div>
          <div className={`text-lg font-semibold ${metricStatus(quality.metrics.faceStability, 60, 100)}`}>
            {quality.metrics.faceStability.toFixed(0)}%
          </div>
          <div className="w-full bg-muted h-1.5 rounded mt-1">
            <div
              className="h-full bg-blue-500 rounded transition-all"
              style={{ width: `${quality.metrics.faceStability}%` }}
            />
          </div>
        </div>

        {/* Vertical Stability */}
        <div className="p-2 bg-muted/50 rounded">
          <div className="text-xs text-muted-foreground">Stability</div>
          <div className={`text-lg font-semibold ${quality.metrics.verticalDeviation <= 100 ? "text-green-600" : "text-red-600"}`}>
            {quality.metrics.verticalDeviation.toFixed(0)}px
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {getStabilityLabel(quality.metrics.verticalDeviation)}
          </div>
        </div>

        {/* Jitter */}
        <div className="p-2 bg-muted/50 rounded">
          <div className="text-xs text-muted-foreground">Jitter</div>
          <div className={`text-lg font-semibold ${quality.metrics.jitterAmount <= 10 ? "text-green-600" : "text-yellow-600"}`}>
            {quality.metrics.jitterAmount.toFixed(1)}px
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {getJitterLabel(quality.metrics.jitterAmount)}
          </div>
        </div>
      </div>

      {/* Reading Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-muted/50 rounded text-center">
          <div className="text-xs text-muted-foreground">Saccades</div>
          <div className="text-xl font-bold text-primary">{quality.metrics.saccadeCount}</div>
          <div className="text-xs text-muted-foreground">
            {quality.metrics.saccadeCount < 10 ? "⚠️ Low" : "✓"}
          </div>
        </div>

        <div className="p-2 bg-muted/50 rounded text-center">
          <div className="text-xs text-muted-foreground">Fixation</div>
          <div className="text-xl font-bold text-primary">
            {quality.metrics.fixationDuration.toFixed(0)}ms
          </div>
          <div className="text-xs text-muted-foreground">
            {quality.metrics.fixationDuration >= 100 ? "✓" : "⚠️"}
          </div>
        </div>

        <div className="p-2 bg-muted/50 rounded text-center">
          <div className="text-xs text-muted-foreground">Skipped</div>
          <div className="text-xl font-bold text-primary">
            {quality.metrics.skippedWordRate.toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground">
            {quality.metrics.skippedWordRate < 40 ? "✓" : "⚠️"}
          </div>
        </div>
      </div>

      {/* Failure Reasons (if any) */}
      {quality.failureReasons.length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded">
          <div className="text-xs font-semibold text-destructive mb-2">Quality Issues</div>
          <ul className="space-y-1">
            {quality.failureReasons.map((reason) => (
              <li key={reason} className="text-xs text-muted-foreground">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions for Poor Quality */}
      {quality.overallScore < 60 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2">
            📋 Suggestions to improve
          </div>
          <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
            {quality.metrics.faceStability < 60 && (
              <li>• Move closer to camera and keep your face centered</li>
            )}
            {quality.metrics.trackingConfidence < 70 && (
              <li>• Ensure good lighting on your face</li>
            )}
            {quality.metrics.verticalDeviation > 100 && (
              <li>• Try to keep your head still while reading</li>
            )}
            {quality.metrics.skippedWordRate > 40 && (
              <li>• Slow down and focus on the text</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default QualityMonitor;
