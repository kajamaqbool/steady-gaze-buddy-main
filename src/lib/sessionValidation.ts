/**
 * Session Validation - Strict Clinical Checks
 * Validates gaze session meets quality standards before classification
 */

import type { GazeDataPoint } from "@/types/gaze";
import type { Fixation } from "./fixationDetectionEnhanced";
import type { Saccade } from "./saccadeDetectionEnhanced";

export interface SessionQuality {
  isValid: boolean;
  overallScore: number; // 0-100
  failureReasons: string[];
  metrics: {
    trackingConfidence: number; // avg confidence %
    faceStability: number; // percentage of frames with face detected
    verticalDeviation: number; // std dev pixels
    horizontalDeviation: number;
    jitterAmount: number; // px
    skippedWordRate: number; // %
    saccadeCount: number;
    regressionRate: number; // %
    fixationDuration: number; // avg ms
    readingFlow: boolean; // in-order word fixation
  };
}

export interface ValidationThresholds {
  minTrackingConfidence: number; // 0-100, default 70%
  minFaceStability: number; // 0-100, default 60%
  maxVerticalDeviation: number; // pixels, default 100px
  maxSkippedWordRate: number; // percent, default 40%
  minSaccadeCount: number; // min per session, default 10
  maxRegressionRate: number; // percent, default 80%
  minFixationDuration: number; // ms, default 100ms
  allowedJitter: number; // pixels, default 10px
}

export const CLINICAL_THRESHOLDS: ValidationThresholds = {
  minTrackingConfidence: 70,
  minFaceStability: 60,
  maxVerticalDeviation: 100,
  maxSkippedWordRate: 40,
  minSaccadeCount: 10,
  maxRegressionRate: 80,
  minFixationDuration: 100,
  allowedJitter: 10,
};

/**
 * Calculate tracking confidence (average of all gaze point confidences)
 */
export function calculateTrackingConfidence(gazePoints: GazeDataPoint[]): number {
  if (gazePoints.length === 0) return 0;
  const sum = gazePoints.reduce((acc, p) => acc + p.confidence, 0);
  return (sum / gazePoints.length) * 100;
}

/**
 * Calculate face stability (% of frames where face detected)
 */
export function calculateFaceStability(gazePoints: GazeDataPoint[]): number {
  if (gazePoints.length === 0) return 0;
  const detected = gazePoints.filter((p) => p.faceDetected).length;
  return (detected / gazePoints.length) * 100;
}

/**
 * Calculate vertical deviation (std dev of Y coordinates)
 */
export function calculateVerticalDeviation(gazePoints: GazeDataPoint[]): number {
  const validPoints = gazePoints.filter((p) => p.faceDetected);
  if (validPoints.length === 0) return 0;

  const ys = validPoints.map((p) => p.gazeY);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance = ys.reduce((sum, y) => sum + (y - mean) ** 2, 0) / ys.length;
  return Math.sqrt(variance);
}

/**
 * Calculate horizontal deviation (std dev of X coordinates)
 */
export function calculateHorizontalDeviation(gazePoints: GazeDataPoint[]): number {
  const validPoints = gazePoints.filter((p) => p.faceDetected);
  if (validPoints.length === 0) return 0;

  const xs = validPoints.map((p) => p.gazeX);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * Calculate jitter (short-term positional noise)
 */
export function calculateJitter(gazePoints: GazeDataPoint[]): number {
  if (gazePoints.length < 2) return 0;

  const distances: number[] = [];
  for (let i = 1; i < gazePoints.length; i++) {
    const dx = gazePoints[i].gazeX - gazePoints[i - 1].gazeX;
    const dy = gazePoints[i].gazeY - gazePoints[i - 1].gazeY;
    distances.push(Math.sqrt(dx * dx + dy * dy));
  }

  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  return mean;
}

/**
 * Calculate skipped word rate
 */
export function calculateSkippedWordRate(
  fixations: Fixation[],
  totalWords: number
): number {
  if (totalWords === 0) return 0;
  const fixatedWords = new Set(fixations.map((f) => f.word).filter((w) => w.length > 0));
  const skipped = Math.max(0, totalWords - fixatedWords.size);
  return (skipped / totalWords) * 100;
}



/**
 * Comprehensive session quality assessment
 */
export function assessSessionQuality(
  gazePoints: GazeDataPoint[],
  fixations: Fixation[],
  saccades: Saccade[],
  totalWords: number = 100,
  thresholds: ValidationThresholds = CLINICAL_THRESHOLDS
): SessionQuality {
  const failureReasons: string[] = [];
  let scorePoints = 100;

  // Calculate metrics
  const trackingConfidence = calculateTrackingConfidence(gazePoints);
  const faceStability = calculateFaceStability(gazePoints);
  const verticalDeviation = calculateVerticalDeviation(gazePoints);
  const horizontalDeviation = calculateHorizontalDeviation(gazePoints);
  const jitter = calculateJitter(gazePoints);
  const skippedWordRate = calculateSkippedWordRate(fixations, totalWords);
  const regressions = saccades.filter((s) => s.isRegression).length;
  const regressionRate = saccades.length > 0 ? (regressions / saccades.length) * 100 : 0;
  const avgFixationDuration =
    fixations.length > 0
      ? fixations.reduce((sum, f) => sum + f.duration, 0) / fixations.length
      : 0;

  // Validate tracking confidence
  if (trackingConfidence < thresholds.minTrackingConfidence) {
    failureReasons.push(
      `Tracking confidence ${trackingConfidence.toFixed(1)}% below minimum ${thresholds.minTrackingConfidence}%`
    );
    scorePoints -= 20;
  }

  // Validate face stability
  if (faceStability < thresholds.minFaceStability) {
    failureReasons.push(
      `Face detection ${faceStability.toFixed(1)}% below minimum ${thresholds.minFaceStability}%`
    );
    scorePoints -= 20;
  }

  // Validate vertical deviation
  if (verticalDeviation > thresholds.maxVerticalDeviation) {
    failureReasons.push(
      `Vertical instability ${verticalDeviation.toFixed(1)}px exceeds maximum ${thresholds.maxVerticalDeviation}px`
    );
    scorePoints -= 15;
  }

  // Validate skipped word rate
  if (skippedWordRate > thresholds.maxSkippedWordRate) {
    failureReasons.push(
      `Skipped word rate ${skippedWordRate.toFixed(1)}% exceeds maximum ${thresholds.maxSkippedWordRate}%`
    );
    scorePoints -= 15;
  }

  // Validate saccade count
  if (saccades.length < thresholds.minSaccadeCount) {
    failureReasons.push(
      `Saccade count ${saccades.length} below minimum ${thresholds.minSaccadeCount}`
    );
    scorePoints -= 15;
  }

  // Validate regression rate
  if (regressionRate > thresholds.maxRegressionRate) {
    failureReasons.push(
      `Regression rate ${regressionRate.toFixed(1)}% exceeds maximum ${thresholds.maxRegressionRate}%`
    );
    scorePoints -= 10;
  }

  // Validate fixation duration
  if (avgFixationDuration < thresholds.minFixationDuration) {
    failureReasons.push(
      `Average fixation ${avgFixationDuration.toFixed(1)}ms below minimum ${thresholds.minFixationDuration}ms`
    );
    scorePoints -= 10;
  }

  // Validate jitter
  if (jitter > thresholds.allowedJitter) {
    failureReasons.push(
      `Jitter ${jitter.toFixed(1)}px exceeds maximum ${thresholds.allowedJitter}px`
    );
    scorePoints -= 5;
  }

  const overallScore = Math.max(0, scorePoints);
  const isValidSession =
    failureReasons.length === 0 || overallScore >= 60; // Pass at 60% or all checks pass

  return {
    isValid: isValidSession,
    overallScore,
    failureReasons,
    metrics: {
      trackingConfidence,
      faceStability,
      verticalDeviation,
      horizontalDeviation,
      jitterAmount: jitter,
      skippedWordRate,
      saccadeCount: saccades.length,
      regressionRate,
      fixationDuration: avgFixationDuration,
      readingFlow: fixations.length > 0, // Placeholder - would check word order
    },
  };
}

/**
 * Session validation verdict
 */
export function getSessionVerdictMessage(quality: SessionQuality): string {
  if (quality.overallScore >= 80) {
    return "✅ Excellent reading session - data is reliable";
  } else if (quality.overallScore >= 60) {
    return "⚠️ Good quality session - acceptable for analysis";
  } else if (quality.failureReasons.length > 0) {
    return `❌ Session quality too low to analyze: ${quality.failureReasons.slice(0, 2).join(", ")}`;
  } else {
    return "❌ Session validation failed";
  }
}

/**
 * Check if session is suitable for clinical use
 */
export function isSessionClinicallyValid(quality: SessionQuality): boolean {
  // Clinical use requires:
  // 1. Valid quality assessment
  // 2. No critical failures
  // 3. Score >= 70
  const hasCriticalFailure = quality.failureReasons.some((r) =>
    ["Tracking confidence", "Face detection", "Vertical instability"].some((c) => r.includes(c))
  );

  return quality.overallScore >= 70 && !hasCriticalFailure;
}
