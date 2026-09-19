/**
 * PHASE 8: ML Readiness Validation
 * 
 * Ensures data is compatible with FastAPI ML service:
 * - Feature ranges realistic (within human expectations)
 * - Sampling rate sufficient for analysis
 * - Noise under tolerable levels
 * - Features extractable with confidence
 * 
 * Output: isMLReady flag + detailed report
 */

import type { GazeFrame } from "@/types/gazeFrame";
import type { Fixation, Saccade, ExtractedMetrics } from "@/lib/featureExtractionPhase3";

// ============================================================================
// ML REQUIREMENTS SPECIFICATION
// ============================================================================

export interface MLRequirements {
  // Temporal
  minSamplingRateHz: number;          // 30Hz required
  minFrameCount: number;              // Enough for feature extraction
  
  // Feature Value Ranges (Clinical)
  fixationDurationRange: [number, number];      // [ms, ms]
  saccadeAmplitudeRange: [number, number];      // [normalized, normalized]
  saccadeVelocityRange: [number, number];       // [px/ms, px/ms]
  regressionRateRange: [number, number];        // [%, %]
  readingSpeedRange: [number, number];          // [WPM, WPM]
  verticalStabilityRange: [number, number];     // [px, px]
  
  // Data Quality
  maxNoiseLevelPercentage: number;    // % of frames with high noise
  minVelocitySmoothnessRatio: number; // Ratio of smooth to jerky motion
}

export const DEFAULT_ML_REQUIREMENTS: MLRequirements = {
  minSamplingRateHz: 25, // Allow slight variance from 30Hz
  minFrameCount: 600,    // ~20 seconds at 30Hz

  // Clinical ranges for dyslexia detection
  fixationDurationRange: [50, 1000],        // 50-1000ms reasonable
  saccadeAmplitudeRange: [0.01, 0.8],       // 10px to most of screen
  saccadeVelocityRange: [0.05, 3.0],        // 50px/s to 3000px/s
  regressionRateRange: [0, 100],            // 0-100% (high = potential dyslexia marker)
  readingSpeedRange: [30, 500],             // 30-500 WPM
  verticalStabilityRange: [1, 300],         // 1-300px std dev

  maxNoiseLevelPercentage: 10,              // Max 10% noisy frames
  minVelocitySmoothnessRatio: 0.6,          // 60% of transitions smooth
};

// ============================================================================
// TYPE ALIASES
// ============================================================================

type NoiseStatus = "clean" | "acceptable" | "high";
type SmoothnesStatus = "smooth" | "acceptable" | "jerky";

// ============================================================================
// RANGE VALIDATION
// ============================================================================

export interface RangeValidationResult {
  isWithinRange: boolean;
  value: number;
  range: [number, number];
  percentOfRange: number; // 0-100
  isOutlier: boolean;
}

function validateRange(
  value: number,
  range: [number, number],
  outlierThreshold: number = 0.05 // 5% beyond range = outlier
): RangeValidationResult {
  const [min, max] = range;
  const rangeSize = max - min;

  const isWithinRange = value >= min && value <= max;
  const isOutlier = !isWithinRange && (
    value < (min - rangeSize * outlierThreshold) ||
    value > (max + rangeSize * outlierThreshold)
  );

  let percentOfRange: number;

  if (isWithinRange) {
    percentOfRange = ((value - min) / rangeSize) * 100;
  } else if (value < min) {
    percentOfRange = 0;
  } else {
    percentOfRange = 100;
  }

  return {
    isWithinRange,
    value,
    range,
    percentOfRange: Math.round(percentOfRange),
    isOutlier,
  };
}

// ============================================================================
// ML READINESS REPORT
// ============================================================================

export interface FeatureValidation {
  featureName: string;
  value: number;
  rangeCheck: RangeValidationResult;
  status: "valid" | "warning" | "invalid";
  message: string;
}

export interface MLReadinessReport {
  isMLReady: boolean;
  confidenceScore: number; // 0-100
  status: "ready" | "warning" | "not_ready";
  
  features: {
    samplingRate: FeatureValidation;
    frameCount: FeatureValidation;
    fixationDuration: FeatureValidation;
    saccadeAmplitude: FeatureValidation;
    saccadeVelocity: FeatureValidation;
    regressionRate: FeatureValidation;
    readingSpeed: FeatureValidation;
    verticalStability: FeatureValidation;
  };

  noiseAnalysis: {
    estimatedNoisePercentage: number;
    status: NoiseStatus;
    message: string;
  };

  smoothnessAnalysis: {
    velocitySmoothness: number; // 0-1
    transitionQuality: number;  // 0-1
    status: "smooth" | "acceptable" | "jerky";
  };

  recommendations: string[];
  incompatibilities: string[];
}

// ============================================================================
// ML VALIDATION PIPELINE
// ============================================================================

/**
 * Estimate noise percentage from velocity distribution
 * High velocity variance = high noise (tracking jitter)
 */
function analyzeNoiseLevel(frames: GazeFrame[]): {
  noisePercentage: number;
  noisyFrameIndices: number[];
} {
  if (frames.length === 0) {
    return { noisePercentage: 0, noisyFrameIndices: [] };
  }

  const velocities = frames.map((f) => f.velocity);
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
  const stdDev = Math.sqrt(variance);

  // Frames with velocity > 2.5 sigma from mean = noisy
  const noisyThreshold = mean + 2.5 * stdDev;
  const noisyFrames = frames
    .map((f, i) => (f.velocity > noisyThreshold ? i : -1))
    .filter((i) => i !== -1);

  const noisyPercentage = (noisyFrames.length / frames.length) * 100;

  return {
    noisePercentage: noisyPercentage,
    noisyFrameIndices: noisyFrames,
  };
}

/**
 * Analyze smoothness of velocity transitions
 * Smooth reading = gradual velocity changes
 * Noisy = sudden jerks
 */
function analyzeSmoothnessOfMotion(frames: GazeFrame[]): {
  smoothnessRatio: number; // 0-1, higher = smoother
  transitionQuality: number;
} {
  if (frames.length < 2) {
    return { smoothnessRatio: 1, transitionQuality: 1 };
  }

  // Check velocity changes between consecutive frames
  const velocityChanges: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const dvdt = Math.abs(frames[i].velocity - frames[i - 1].velocity);
    velocityChanges.push(dvdt);
  }

  const mean = velocityChanges.reduce((a, b) => a + b, 0) / velocityChanges.length;
  const variance = velocityChanges.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocityChanges.length;
  const stdDev = Math.sqrt(variance);

  // Smooth transitions have low acceleration
  // Count "smooth" transitions as those < 1 stdDev from mean
  const smoothThreshold = mean + stdDev;
  const smoothCount = velocityChanges.filter((v) => v < smoothThreshold).length;
  const smoothnessRatio = smoothCount / velocityChanges.length;

  // Transition quality: How well do transitions fit expected model
  // Ideal: exponential or sigmoid velocity profile
  const expectedSaccadePattern = 0.7; // Rough estimate
  const transitionQuality = smoothnessRatio * 0.7 + expectedSaccadePattern * 0.3;

  return {
    smoothnessRatio: Math.min(1, smoothnessRatio),
    transitionQuality: Math.min(1, transitionQuality),
  };
}

// ============================================================================
// HELPER: Determine status from validation results
// ============================================================================

function determineValidationStatus(check: RangeValidationResult): "valid" | "invalid" | "warning" {
  if (check.isWithinRange) return "valid";
  return check.isOutlier ? "invalid" : "warning";
}

function determineNoiseStatus(noisePercentage: number, maxNoise: number): NoiseStatus {
  if (noisePercentage < 5) return "clean";
  if (noisePercentage < maxNoise) return "acceptable";
  return "high";
}

function determineSmoothness(smoothnessRatio: number): SmoothnesStatus {
  if (smoothnessRatio > 0.75) return "smooth";
  if (smoothnessRatio > 0.6) return "acceptable";
  return "jerky";
}

function determineNoiseMessage(
  noiseStatus: NoiseStatus,
  noisePercentage: number
): string {
  if (noiseStatus === "clean") return "Low noise - clean tracking";
  if (noiseStatus === "acceptable") return `Moderate noise (${noisePercentage.toFixed(1)}%) - acceptable`;
  return `High noise (${noisePercentage.toFixed(1)}%) - may affect feature extraction`;
}

/**
 * Comprehensive ML readiness check
 */
// eslint-disable sonarjs/cognitive-complexity
// eslint-disable-next-line complexity
export function checkMLReadiness(
  frames: GazeFrame[],
  fixations: Fixation[],
  saccades: Saccade[],
  metrics: ExtractedMetrics,
  sessionDurationSec: number,
  requirements: MLRequirements = DEFAULT_ML_REQUIREMENTS
): MLReadinessReport {
  const features: MLReadinessReport["features"] = {
    samplingRate: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    frameCount: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    fixationDuration: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    saccadeAmplitude: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    saccadeVelocity: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    regressionRate: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    readingSpeed: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
    verticalStability: { featureName: "", value: 0, rangeCheck: { isWithinRange: false, value: 0, range: [0, 1], percentOfRange: 0, isOutlier: false }, status: "invalid", message: "" },
  };

  const recommendations: string[] = [];
  const incompatibilities: string[] = [];

  let confidenceScore = 100;

  // ========== TEMPORAL ==========

  const actualSamplingRate = sessionDurationSec > 0 ? frames.length / sessionDurationSec : 0;
  const samplingRateCheck = validateRange(actualSamplingRate, [requirements.minSamplingRateHz, 100]);

  features.samplingRate = {
    featureName: "Sampling Rate (Hz)",
    value: actualSamplingRate,
    rangeCheck: samplingRateCheck,
    status: determineValidationStatus(samplingRateCheck),
    message: `${actualSamplingRate.toFixed(1)} Hz (required: ${requirements.minSamplingRateHz}+ Hz)`,
  };

  if (!samplingRateCheck.isWithinRange) {
    confidenceScore -= samplingRateCheck.isOutlier ? 30 : 10;
    if (samplingRateCheck.isOutlier) {
      incompatibilities.push("Sampling rate too low for saccade detection");
    }
  }

  const frameCountCheck = validateRange(frames.length, [requirements.minFrameCount, 1000000]);

  features.frameCount = {
    featureName: "Frame Count",
    value: frames.length,
    rangeCheck: frameCountCheck,
    status: frameCountCheck.isWithinRange ? "valid" : "warning",
    message: `${frames.length} frames (required: ${requirements.minFrameCount}+)`,
  };

  if (!frameCountCheck.isWithinRange) {
    confidenceScore -= 15;
    recommendations.push("Collect more data for better feature stability");
  }

  // ========== FIXATION FEATURES ==========

  const fixDurationCheck = validateRange(
    metrics.averageFixationDuration,
    requirements.fixationDurationRange
  );

  features.fixationDuration = {
    featureName: "Avg Fixation Duration (ms)",
    value: metrics.averageFixationDuration,
    rangeCheck: fixDurationCheck,
    status: determineValidationStatus(fixDurationCheck),
    message: `${metrics.averageFixationDuration.toFixed(0)}ms ${fixDurationCheck.isWithinRange ? "✓" : "⚠"}`,
  };

  if (!fixDurationCheck.isWithinRange) {
    confidenceScore -= fixDurationCheck.isOutlier ? 20 : 5;
    if (fixDurationCheck.isOutlier && metrics.averageFixationDuration < 50) {
      incompatibilities.push("Fixations too short - may be tracking noise, not real fixations");
    }
  }

  // ========== SACCADE FEATURES ==========

  const avgSaccadeAmp = saccades.length > 0
    ? saccades.reduce((sum, s) => sum + s.amplitudeNormalized, 0) / saccades.length
    : 0;

  const saccAmpCheck = validateRange(avgSaccadeAmp, requirements.saccadeAmplitudeRange);

  features.saccadeAmplitude = {
    featureName: "Avg Saccade Amplitude",
    value: avgSaccadeAmp,
    rangeCheck: saccAmpCheck,
    status: saccAmpCheck.isWithinRange ? "valid" : "warning",
    message: `${(avgSaccadeAmp * 100).toFixed(0)}% screen ${saccAmpCheck.isWithinRange ? "✓" : "⚠"}`,
  };

  if (!saccAmpCheck.isWithinRange) {
    confidenceScore -= 10;
  }

  const avgSaccadeVel = saccades.length > 0
    ? saccades.reduce((sum, s) => sum + s.peakVelocity, 0) / saccades.length
    : 0;

  const saccVelCheck = validateRange(avgSaccadeVel, requirements.saccadeVelocityRange);

  features.saccadeVelocity = {
    featureName: "Avg Saccade Velocity (px/ms)",
    value: avgSaccadeVel,
    rangeCheck: saccVelCheck,
    status: determineValidationStatus(saccVelCheck),
    message: `${avgSaccadeVel.toFixed(2)} px/ms ${saccVelCheck.isWithinRange ? "✓" : "⚠"}`,
  };

  if (!saccVelCheck.isWithinRange) {
    confidenceScore -= saccVelCheck.isOutlier ? 15 : 5;
    if (saccVelCheck.isOutlier && avgSaccadeVel < 0.05) {
      incompatibilities.push("Saccade detection may be imprecise - velocity too low");
    }
  }

  // ========== READING METRICS ==========

  const regressionCheck = validateRange(metrics.regressionRate, requirements.regressionRateRange);

  features.regressionRate = {
    featureName: "Regression Rate (%)",
    value: metrics.regressionRate,
    rangeCheck: regressionCheck,
    status: "valid", // High regression is interesting, not invalid
    message: `${metrics.regressionRate.toFixed(0)}% (possible dyslexia marker)`,
  };

  if (metrics.regressionRate > 40) {
    recommendations.push(
      "High regression rate detected - consistent with dyslexic reading patterns"
    );
  }

  const wpmCheck = validateRange(metrics.readingSpeed, requirements.readingSpeedRange);

  features.readingSpeed = {
    featureName: "Est. Reading Speed (WPM)",
    value: metrics.readingSpeed,
    rangeCheck: wpmCheck,
    status: wpmCheck.isWithinRange ? "valid" : "warning",
    message: `${metrics.readingSpeed.toFixed(0)} WPM ${wpmCheck.isWithinRange ? "✓" : "⚠"}`,
  };

  if (!wpmCheck.isWithinRange) {
    confidenceScore -= 5;
  }

  // ========== STABILITY ==========

  const stabCheck = validateRange(metrics.verticalStability, requirements.verticalStabilityRange);

  features.verticalStability = {
    featureName: "Vertical Stability (px)",
    value: metrics.verticalStability,
    rangeCheck: stabCheck,
    status: stabCheck.isWithinRange ? "valid" : "warning",
    message: `${metrics.verticalStability.toFixed(0)}px std-dev ${stabCheck.isWithinRange ? "✓" : "⚠"}`,
  };

  if (!stabCheck.isWithinRange) {
    confidenceScore -= 10;
    recommendations.push("High vertical instability - check head position stability");
  }

  // ========== NOISE ANALYSIS ==========

  const { noisePercentage } = analyzeNoiseLevel(frames);

  const noiseStatus = determineNoiseStatus(noisePercentage, requirements.maxNoiseLevelPercentage);
  const noiseMessage = determineNoiseMessage(noiseStatus, noisePercentage);

  const noiseAnalysis = {
    estimatedNoisePercentage: noisePercentage,
    status: noiseStatus,
    message: noiseMessage,
  };

  if (noiseAnalysis.status === "high") {
    confidenceScore -= 20;
    incompatibilities.push("Noise level too high - recommend re-running session");
  }

  // ========== SMOOTHNESS ANALYSIS ==========

  const { smoothnessRatio, transitionQuality } = analyzeSmoothnessOfMotion(frames);

  const smoothnessAnalysis = {
    velocitySmoothness: smoothnessRatio,
    transitionQuality,
    status: determineSmoothness(smoothnessRatio),
  };

  if (smoothnessAnalysis.status !== "smooth") {
    confidenceScore -= 10;
    recommendations.push("Motion contains jerky transitions - may indicate lighting or tracking issues");
  }

  // ========== FINAL STATUS ==========

  const isMLReady =
    incompatibilities.length === 0 &&
    confidenceScore >= 70 &&
    features.samplingRate.status !== "invalid" &&
    features.frameCount.status !== "invalid";

  let status: "ready" | "warning" | "not_ready";

  if (isMLReady && confidenceScore >= 85) {
    status = "ready";
  } else if (confidenceScore >= 70) {
    status = "warning";
  } else {
    status = "not_ready";
  }

  return {
    isMLReady,
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    status,
    features,
    noiseAnalysis,
    smoothnessAnalysis,
    recommendations,
    incompatibilities,
  };
}

