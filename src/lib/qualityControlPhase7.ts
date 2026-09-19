/**
 * PHASE 7: Quality Control & Validation
 * 
 * Prevents bad data from reaching backend/ML:
 * - Minimum quality thresholds
 * - Detection of tracking failures
 * - Real-time quality monitoring
 * - Blocking of invalid sessions
 */

import type { GazeFrame } from "@/types/gazeFrame";
import type { Fixation, Saccade, ExtractedMetrics } from "@/lib/featureExtractionPhase3";

// ============================================================================
// QUALITY THRESHOLDS (CLINICAL)
// ============================================================================

export interface QualityThresholds {
  // Temporal
  minFrameCount: number;
  minSessionDurationSec: number;
  targetSamplingRateHz: number;
  samplingRateTolerance: number;

  // Face Detection
  minFaceDetectionRate: number; // 0-1 (%)
  minAverageConfidence: number; // 0-1 (%)

  // Gaze Quality
  maxVerticalDeviation: number; // pixels
  maxHorizontalDeviation: number;

  // Reading Behavior
  minFixationCount: number;
  minSaccadeCount: number;
  minAverageFixationDuration: number; // ms
  maxAverageFixationDuration: number; // ms

  // Regression
  maxRegressionRate: number; // %

  // Noise
  maxVelocityOutliers: number; // % of frames
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minFrameCount: 600, // ~20 seconds at 30Hz
  minSessionDurationSec: 30,
  targetSamplingRateHz: 30,
  samplingRateTolerance: 5, // Hz tolerance

  minFaceDetectionRate: 0.70, // 70% of frames
  minAverageConfidence: 0.65, // 65% average

  maxVerticalDeviation: 100, // pixels
  maxHorizontalDeviation: 120,

  minFixationCount: 8,
  minSaccadeCount: 5,
  minAverageFixationDuration: 80, // ms
  maxAverageFixationDuration: 800, // ms

  maxRegressionRate: 80, // 80% of saccades max

  maxVelocityOutliers: 0.05, // 5% of frames
};

// ============================================================================
// QUALITY ASSESSMENT
// ============================================================================

export enum ValidationStatus {
  VALID = "VALID",
  WARNING = "WARNING",
  INVALID = "INVALID",
}

export interface QualityIssue {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  affectedMetric?: string;
  expectedValue?: any;
  actualValue?: any;
}

export interface QualityReport {
  status: ValidationStatus;
  qualityScore: number; // 0-100
  issues: QualityIssue[];
  metrics: {
    frameCount: number;
    sessionDurationSec: number;
    actualSamplingRateHz: number;
    faceDetectionRate: number;
    averageConfidence: number;
    verticalDeviation: number;
    horizontalDeviation: number;
    fixationCount: number;
    saccadeCount: number;
    averageFixationDuration: number;
    regressionRate: number;
    velocityOutlierPercentage: number;
  };
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Calculate vertical deviation (std dev of Y)
 */
function calculateVerticalDeviation(
  frames: GazeFrame[],
  screenHeight: number = 720
): number {
  if (frames.length === 0) return 0;

  const faceDetectedFrames = frames.filter((f) => f.faceDetected);
  if (faceDetectedFrames.length === 0) return 0;

  const ys = faceDetectedFrames.map((f) => f.gazeY * screenHeight);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance = ys.reduce((sum, y) => sum + (y - mean) ** 2, 0) / ys.length;

  return Math.sqrt(variance);
}

/**
 * Calculate horizontal deviation (std dev of X)
 */
function calculateHorizontalDeviation(
  frames: GazeFrame[],
  screenWidth: number = 1280
): number {
  if (frames.length === 0) return 0;

  const faceDetectedFrames = frames.filter((f) => f.faceDetected);
  if (faceDetectedFrames.length === 0) return 0;

  const xs = faceDetectedFrames.map((f) => f.gazeX * screenWidth);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / xs.length;

  return Math.sqrt(variance);
}

/**
 * Calculate velocity outlier percentage
 * Frames with velocity > 2.5 sigma from mean
 */
function calculateVelocityOutlierPercentage(frames: GazeFrame[]): number {
  if (frames.length < 2) return 0;

  const velocities = frames.map((f) => f.velocity);
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
  const stdDev = Math.sqrt(variance);
  const threshold = mean + 2.5 * stdDev;

  const outliers = velocities.filter((v) => v > threshold).length;
  return outliers / frames.length;
}

/**
 * Comprehensive quality validation
 */
// eslint-disable sonarjs/cognitive-complexity
// eslint-disable-next-line complexity
export function validateSessionQuality(
  frames: GazeFrame[],
  fixations: Fixation[],
  saccades: Saccade[],
  metrics: ExtractedMetrics,
  screenWidth: number = 1280,
  screenHeight: number = 720,
  sessionDurationSec: number = 60
): QualityReport {
  const thresholds = DEFAULT_QUALITY_THRESHOLDS;
  const issues: QualityIssue[] = [];
  let scorePoints = 100;

  // ========== TEMPORAL VALIDATION ==========

  if (frames.length < thresholds.minFrameCount) {
    issues.push({
      id: "low_frame_count",
      severity: "error",
      message: `Frame count ${frames.length} below minimum ${thresholds.minFrameCount}`,
      affectedMetric: "frameCount",
      expectedValue: thresholds.minFrameCount,
      actualValue: frames.length,
    });
    scorePoints -= 30;
  }

  if (sessionDurationSec < thresholds.minSessionDurationSec) {
    issues.push({
      id: "short_session",
      severity: "warning",
      message: `Session duration ${sessionDurationSec}s below minimum ${thresholds.minSessionDurationSec}s`,
      expectedValue: thresholds.minSessionDurationSec,
      actualValue: sessionDurationSec,
    });
    scorePoints -= 15;
  }

  const actualSamplingRate =
    sessionDurationSec > 0 ? frames.length / sessionDurationSec : 0;

  if (
    Math.abs(actualSamplingRate - thresholds.targetSamplingRateHz) >
    thresholds.samplingRateTolerance
  ) {
    issues.push({
      id: "sampling_rate_deviation",
      severity: "warning",
      message: `Sampling rate ${actualSamplingRate.toFixed(1)}Hz deviates from target ${thresholds.targetSamplingRateHz}Hz`,
      expectedValue: thresholds.targetSamplingRateHz,
      actualValue: actualSamplingRate.toFixed(1),
    });
    scorePoints -= 10;
  }

  // ========== FACE DETECTION ==========

  const faceDetectionRate = frames.filter((f) => f.faceDetected).length / frames.length;

  if (faceDetectionRate < thresholds.minFaceDetectionRate) {
    issues.push({
      id: "low_face_detection",
      severity: "error",
      message: `Face detection rate ${(faceDetectionRate * 100).toFixed(0)}% below ${(thresholds.minFaceDetectionRate * 100).toFixed(0)}%`,
      expectedValue: thresholds.minFaceDetectionRate,
      actualValue: faceDetectionRate.toFixed(3),
    });
    scorePoints -= 25;
  }

  const averageConfidence = frames.reduce((sum, f) => sum + f.confidence, 0) / frames.length;

  if (averageConfidence < thresholds.minAverageConfidence) {
    issues.push({
      id: "low_confidence",
      severity: "error",
      message: `Average confidence ${(averageConfidence * 100).toFixed(0)}% below ${(thresholds.minAverageConfidence * 100).toFixed(0)}%`,
      expectedValue: thresholds.minAverageConfidence,
      actualValue: averageConfidence.toFixed(3),
    });
    scorePoints -= 20;
  }

  // ========== GAZE STABILITY ==========

  const verticalDeviation = calculateVerticalDeviation(frames, screenHeight);

  if (verticalDeviation > thresholds.maxVerticalDeviation) {
    issues.push({
      id: "high_vertical_deviation",
      severity: "warning",
      message: `Vertical deviation ${verticalDeviation.toFixed(0)}px exceeds maximum ${thresholds.maxVerticalDeviation}px`,
      expectedValue: thresholds.maxVerticalDeviation,
      actualValue: verticalDeviation.toFixed(1),
    });
    scorePoints -= 15;
  }

  const horizontalDeviation = calculateHorizontalDeviation(frames, screenWidth);

  if (horizontalDeviation > thresholds.maxHorizontalDeviation) {
    issues.push({
      id: "high_horizontal_deviation",
      severity: "warning",
      message: `Horizontal deviation ${horizontalDeviation.toFixed(0)}px exceeds maximum ${thresholds.maxHorizontalDeviation}px`,
      expectedValue: thresholds.maxHorizontalDeviation,
      actualValue: horizontalDeviation.toFixed(1),
    });
    scorePoints -= 10;
  }

  // ========== READING BEHAVIOR ==========

  if (fixations.length < thresholds.minFixationCount) {
    issues.push({
      id: "low_fixation_count",
      severity: "error",
      message: `Fixation count ${fixations.length} below minimum ${thresholds.minFixationCount}`,
      expectedValue: thresholds.minFixationCount,
      actualValue: fixations.length,
    });
    scorePoints -= 20;
  }

  if (saccades.length < thresholds.minSaccadeCount) {
    issues.push({
      id: "low_saccade_count",
      severity: "warning",
      message: `Saccade count ${saccades.length} below minimum ${thresholds.minSaccadeCount}`,
      expectedValue: thresholds.minSaccadeCount,
      actualValue: saccades.length,
    });
    scorePoints -= 15;
  }

  if (metrics.averageFixationDuration < thresholds.minAverageFixationDuration) {
    issues.push({
      id: "short_fixations",
      severity: "warning",
      message: `Average fixation duration ${metrics.averageFixationDuration.toFixed(0)}ms below ${thresholds.minAverageFixationDuration}ms`,
      expectedValue: thresholds.minAverageFixationDuration,
      actualValue: metrics.averageFixationDuration.toFixed(1),
    });
    scorePoints -= 10;
  }

  if (metrics.averageFixationDuration > thresholds.maxAverageFixationDuration) {
    issues.push({
      id: "long_fixations",
      severity: "info",
      message: `Average fixation duration ${metrics.averageFixationDuration.toFixed(0)}ms exceeds expected ${thresholds.maxAverageFixationDuration}ms`,
      expectedValue: thresholds.maxAverageFixationDuration,
      actualValue: metrics.averageFixationDuration.toFixed(1),
    });
    scorePoints -= 5;
  }

  // ========== REGRESSION RATE ==========

  if (metrics.regressionRate > thresholds.maxRegressionRate) {
    issues.push({
      id: "high_regression_rate",
      severity: "info",
      message: `Regression rate ${metrics.regressionRate.toFixed(0)}% exceeds expected ${thresholds.maxRegressionRate}%`,
      expectedValue: thresholds.maxRegressionRate,
      actualValue: metrics.regressionRate.toFixed(1),
    });
    scorePoints -= 5; // Possible dyslexia marker, not necessarily invalid
  }

  // ========== NOISE ==========

  const velocityOutliers = calculateVelocityOutlierPercentage(frames);

  if (velocityOutliers > thresholds.maxVelocityOutliers) {
    issues.push({
      id: "high_velocity_noise",
      severity: "warning",
      message: `Velocity outliers ${(velocityOutliers * 100).toFixed(1)}% exceed threshold ${(thresholds.maxVelocityOutliers * 100).toFixed(1)}%`,
      expectedValue: thresholds.maxVelocityOutliers,
      actualValue: velocityOutliers.toFixed(4),
    });
    scorePoints -= 12;
  }

  // ========== DETERMINE STATUS ==========

  const qualityScore = Math.max(0, Math.min(100, scorePoints));

  let status: ValidationStatus;

  const errorCount = issues.filter((i) => i.severity === "error").length;

  if (errorCount > 0 || qualityScore < 50) {
    status = ValidationStatus.INVALID;
  } else if (issues.filter((i) => i.severity === "warning").length > 2 || qualityScore < 70) {
    status = ValidationStatus.WARNING;
  } else {
    status = ValidationStatus.VALID;
  }

  return {
    status,
    qualityScore,
    issues,
    metrics: {
      frameCount: frames.length,
      sessionDurationSec,
      actualSamplingRateHz: actualSamplingRate,
      faceDetectionRate,
      averageConfidence,
      verticalDeviation,
      horizontalDeviation,
      fixationCount: fixations.length,
      saccadeCount: saccades.length,
      averageFixationDuration: metrics.averageFixationDuration,
      regressionRate: metrics.regressionRate,
      velocityOutlierPercentage: velocityOutliers,
    },
  };
}

// ============================================================================
// REAL-TIME QUALITY MONITOR
// ============================================================================

export class RealtimeQualityMonitor {
  private readonly thresholds: QualityThresholds;
  private frames: GazeFrame[] = [];
  private startTimeMs: number = Date.now();

  constructor(thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Add frame and check quality
   */
  addFrame(frame: GazeFrame): QualityReport | null {
    this.frames.push(frame);

    // Only evaluate every 30 frames (if at 30Hz, every ~1 second)
    if (this.frames.length % 30 !== 0) {
      return null;
    }

    return this.getQualityReport();
  }

  getQualityReport(): QualityReport | null {
    if (this.frames.length === 0) return null;

    const durationSec = (Date.now() - this.startTimeMs) / 1000;

    // Create placeholder metrics (real implementation would extract from frames)
    const metrics: ExtractedMetrics = {
      fixationCount: 0,
      saccadeCount: 0,
      regressionCount: 0,
      regressionRate: 0,
      averageFixationDuration: 200,
      minFixationDuration: 80,
      maxFixationDuration: 500,
      averageSaccadeAmplitude: 0.15,
      readingSpeed: 150,
      verticalStability: 30,
      horizontalStability: 40,
      totalFixationTime: durationSec * 1000 * 0.8,
      totalSaccadeTime: durationSec * 1000 * 0.1,
      fixationPercentage: 80,
    };

    return validateSessionQuality(
      this.frames,
      [],
      [],
      metrics,
      1280,
      720,
      durationSec
    );
  }

  reset(): void {
    this.frames = [];
    this.startTimeMs = Date.now();
  }

  getFrameCount(): number {
    return this.frames.length;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported in their interface definitions above
