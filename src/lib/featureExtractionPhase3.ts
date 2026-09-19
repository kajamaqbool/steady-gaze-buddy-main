/**
 * PHASE 3: Feature Extraction Module
 * 
 * Extracts clinical-grade features from gaze frames:
 * - Fixation detection (clustering + duration)
 * - Saccade detection (velocity-based)
 * - Regression detection (backward saccades)
 * - Reading metrics (WPM, stability)
 */

import type { GazeFrame } from "@/types/gazeFrame";

// ============================================================================
// DATA TYPES
// ============================================================================

export interface Fixation {
  id: string;
  frameIdStart: number;
  frameIdEnd: number;
  timestampStart: number;
  timestampEnd: number;
  durationMs: number;
  centerX: number;        // Normalized [0, 1]
  centerY: number;
  stability: number;      // 0-1, lower = more stable (std dev of points)
  pointCount: number;
  word?: string;
  wordIndex?: number;
  peakVelocityDuringFixation: number;
}

export interface Saccade {
  id: string;
  frameIdStart: number;
  frameIdEnd: number;
  timestampStart: number;
  timestampEnd: number;
  durationMs: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  amplitudeNormalized: number;  // Euclidean distance
  amplitudePx: number;          // In screen pixels (estimated)
  peakVelocity: number;
  direction: "forward" | "backward" | "vertical" | null;
  isRegression: boolean;
}

export interface Regression extends Saccade {
  fromWord?: string;
  toWord?: string;
}

export interface ExtractedMetrics {
  fixationCount: number;
  saccadeCount: number;
  regressionCount: number;
  regressionRate: number;        // % of saccades that are regressions
  averageFixationDuration: number;
  minFixationDuration: number;
  maxFixationDuration: number;
  averageSaccadeAmplitude: number;
  readingSpeed: number;          // Estimated WPM
  verticalStability: number;     // Std dev of Y during fixations (px)
  horizontalStability: number;   // Std dev of X during fixations (px)
  totalFixationTime: number;     // ms
  totalSaccadeTime: number;      // ms
  fixationPercentage: number;    // % of session time in fixations
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface FixationDetectionConfig {
  spatialThreshold: number;       // Normalized units [0, 1], ~0.05 = ~50px
  minDurationMs: number;          // Minimum fixation duration
  maxVelocityInFixation: number;  // px/ms threshold for within-fixation motion
  mergeGapMs: number;             // Merge fixations separated < this gap
}

export const DEFAULT_FIXATION_CONFIG: FixationDetectionConfig = {
  spatialThreshold: 0.05,         // 50px on 1000px screen
  minDurationMs: 80,              // 80ms minimum fixation
  maxVelocityInFixation: 0.05,    // Low velocity while fixating
  mergeGapMs: 50,                 // Merge micro-fixations
};

export interface SaccadeDetectionConfig {
  velocityThreshold: number;      // px/ms (pixels per millisecond)
  amplitudeThreshold: number;     // Minimum saccade amplitude (normalized)
  minDurationMs: number;          // Minimum saccade duration
  maxDurationMs: number;          // Maximum saccade duration (realistic: ~250ms)
}

export const DEFAULT_SACCADE_CONFIG: SaccadeDetectionConfig = {
  velocityThreshold: 0.3,         // 300px/s = 0.3px/ms
  amplitudeThreshold: 0.02,       // ~20px on 1000px screen
  minDurationMs: 10,
  maxDurationMs: 250,
};

// ============================================================================
// FIXATION DETECTION
// ============================================================================

/**
 * Helper: Find fixation cluster boundaries
 */
function findFixationBoundary(
  frames: GazeFrame[],
  startIndex: number,
  config: FixationDetectionConfig
): { endIndex: number; xSum: number; ySum: number; pointCount: number; maxVel: number } {
  let xSum = frames[startIndex].gazeX;
  let ySum = frames[startIndex].gazeY;
  let pointCount = 1;
  let j = startIndex + 1;
  let maxVel = 0;

  while (j < frames.length) {
    const centerX = xSum / pointCount;
    const centerY = ySum / pointCount;
    const currentFrame = frames[j];
    const dx = currentFrame.gazeX - centerX;
    const dy = currentFrame.gazeY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (
      distance < config.spatialThreshold &&
      currentFrame.velocity < config.maxVelocityInFixation
    ) {
      xSum += currentFrame.gazeX;
      ySum += currentFrame.gazeY;
      pointCount++;
      maxVel = Math.max(maxVel, currentFrame.velocity);
      j++;
    } else {
      break;
    }
  }

  return { endIndex: j, xSum, ySum, pointCount, maxVel };
}

/**
 * Helper: Calculate fixation stability score
 */
function calculateStability(
  frames: GazeFrame[],
  startIndex: number,
  endIndex: number,
  centerX: number,
  centerY: number,
  pointCount: number
): number {
  let variance = 0;
  for (let k = startIndex; k < endIndex; k++) {
    const dx = frames[k].gazeX - centerX;
    const dy = frames[k].gazeY - centerY;
    variance += dx * dx + dy * dy;
  }
  variance /= pointCount;
  return Math.sqrt(variance);
}

/**
 * Detect fixations using spatial clustering
 * Groups consecutive frames where gaze stays within threshold distance
 */
export function detectFixations(
  frames: GazeFrame[],
  config: FixationDetectionConfig = DEFAULT_FIXATION_CONFIG
): Fixation[] {
  if (frames.length === 0) return [];

  const fixations: Fixation[] = [];
  let fixationIndex = 0;
  let i = 0;

  while (i < frames.length) {
    const startFrame = frames[i];
    const boundary = findFixationBoundary(frames, i, config);
    const fixationDurationMs = frames[boundary.endIndex - 1].timestampMs - startFrame.timestampMs;

    if (fixationDurationMs >= config.minDurationMs) {
      const centerX = boundary.xSum / boundary.pointCount;
      const centerY = boundary.ySum / boundary.pointCount;
      const stabilityScore = calculateStability(
        frames,
        i,
        boundary.endIndex,
        centerX,
        centerY,
        boundary.pointCount
      );

      fixations.push({
        id: `fix_${fixationIndex++}`,
        frameIdStart: startFrame.frameId,
        frameIdEnd: frames[boundary.endIndex - 1].frameId,
        timestampStart: startFrame.timestampMs,
        timestampEnd: frames[boundary.endIndex - 1].timestampMs,
        durationMs: fixationDurationMs,
        centerX,
        centerY,
        stability: stabilityScore,
        pointCount: boundary.pointCount,
        peakVelocityDuringFixation: boundary.maxVel,
      });
    }

    i = boundary.endIndex > i + 1 ? boundary.endIndex : i + 1;
  }

  return mergeNearbyFixations(fixations, config.mergeGapMs);
}

/**
 * Merge fixations separated by small gaps (< mergeGapMs)
 * Handles micro-fixations and rebound corrections
 */
function mergeNearbyFixations(
  fixations: Fixation[],
  mergeGapMs: number
): Fixation[] {
  if (fixations.length < 2) return fixations;

  const merged: Fixation[] = [];
  let current = { ...fixations[0] };

  for (let i = 1; i < fixations.length; i++) {
    const next = fixations[i];
    const gap = next.timestampStart - current.timestampEnd;

    if (gap < mergeGapMs) {
      // Merge with current fixation
      const totalPoints = current.pointCount + next.pointCount;

      // Weighted center
      const newCenterX =
        (current.centerX * current.pointCount + next.centerX * next.pointCount) /
        totalPoints;
      const newCenterY =
        (current.centerY * current.pointCount + next.centerY * next.pointCount) /
        totalPoints;

      current = {
        ...current,
        timestampEnd: next.timestampEnd,
        frameIdEnd: next.frameIdEnd,
        durationMs: next.timestampEnd - current.timestampStart,
        centerX: newCenterX,
        centerY: newCenterY,
        pointCount: totalPoints,
        peakVelocityDuringFixation: Math.max(
          current.peakVelocityDuringFixation,
          next.peakVelocityDuringFixation
        ),
      };
    } else {
      // Gap too large, start new fixation
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

// ============================================================================
// SACCADE DETECTION
// ============================================================================

/**
 * Helper: Find peak velocity between two fixations
 */
function findPeakVelocityInInterval(
  frames: GazeFrame[],
  startTime: number,
  endTime: number
): number {
  let peakVelocity = 0;
  for (const frame of frames) {
    if (frame.timestampMs >= startTime && frame.timestampMs <= endTime) {
      peakVelocity = Math.max(peakVelocity, frame.velocity);
    }
  }
  return peakVelocity;
}

/**
 * Helper: Classify saccade direction
 */
function classifySaccadeDirection(
  dx: number,
  dy: number
): "forward" | "backward" | "vertical" | null {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "forward" : "backward";
  }
  return "vertical";
}

/**
 * Detect saccades from fixations
 * Saccade = transition between two fixations
 */
export function detectSaccadesFromFixations(
  fixations: Fixation[],
  frames: GazeFrame[],
  config: SaccadeDetectionConfig = DEFAULT_SACCADE_CONFIG,
  screenWidth: number = 1000
): Saccade[] {
  if (fixations.length < 2) return [];

  const saccades: Saccade[] = [];
  let saccadeIndex = 0;

  for (let i = 1; i < fixations.length; i++) {
    const prevFix = fixations[i - 1];
    const currFix = fixations[i];

    const dx = currFix.centerX - prevFix.centerX;
    const dy = currFix.centerY - prevFix.centerY;
    const amplitudeNormalized = Math.sqrt(dx * dx + dy * dy);
    const estimatedDurationMs = currFix.timestampStart - prevFix.timestampEnd;
    const peakVelocity = findPeakVelocityInInterval(
      frames,
      prevFix.timestampEnd,
      currFix.timestampStart
    );
    const direction = classifySaccadeDirection(dx, dy);

    if (
      amplitudeNormalized >= config.amplitudeThreshold &&
      peakVelocity >= config.velocityThreshold &&
      estimatedDurationMs >= config.minDurationMs &&
      estimatedDurationMs <= config.maxDurationMs
    ) {
      saccades.push({
        id: `sac_${saccadeIndex++}`,
        frameIdStart: prevFix.frameIdEnd,
        frameIdEnd: currFix.frameIdStart,
        timestampStart: prevFix.timestampEnd,
        timestampEnd: currFix.timestampStart,
        durationMs: estimatedDurationMs,
        startX: prevFix.centerX,
        startY: prevFix.centerY,
        endX: currFix.centerX,
        endY: currFix.centerY,
        amplitudeNormalized,
        amplitudePx: amplitudeNormalized * screenWidth,
        peakVelocity,
        direction,
        isRegression: direction === "backward",
      });
    }
  }

  return saccades;
}

// ============================================================================
// REGRESSION DETECTION
// ============================================================================

export function detectRegressions(saccades: Saccade[]): Regression[] {
  return saccades
    .filter((s) => s.isRegression)
    .map((s) => ({ ...s } as Regression));
}

// ============================================================================
// READING METRICS
// ============================================================================

/**
 * Compute reading speed in Words Per Minute
 * Estimate based on fixated words
 */
export function estimateReadingSpeed(
  fixations: Fixation[],
  sessionDurationMs: number,
  wordCount: number = 100
): number {
  if (sessionDurationMs === 0) return 0;

  // Assume average: 1 word per fixation
  const estimatedWordsRead = fixations.length;
  const sessionDurationMin = sessionDurationMs / (1000 * 60);

  return sessionDurationMin > 0 ? estimatedWordsRead / sessionDurationMin : 0;
}

/**
 * Calculate vertical stability (std dev of Y during fixations)
 * Returns pixel values for real screen
 */
export function calculateVerticalStability(
  fixations: Fixation[],
  screenHeight: number = 720
): number {
  if (fixations.length === 0) return 0;

  const yValues = fixations.map((f) => f.centerY);
  const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

  const variance =
    yValues.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / yValues.length;
  const stdDev = Math.sqrt(variance);

  // Convert from normalized [0, 1] to pixels
  return stdDev * screenHeight;
}

/**
 * Calculate horizontal stability
 */
export function calculateHorizontalStability(
  fixations: Fixation[],
  screenWidth: number = 1280
): number {
  if (fixations.length === 0) return 0;

  const xValues = fixations.map((f) => f.centerX);
  const meanX = xValues.reduce((a, b) => a + b, 0) / xValues.length;

  const variance =
    xValues.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xValues.length;
  const stdDev = Math.sqrt(variance);

  return stdDev * screenWidth;
}

// ============================================================================
// COMPLETE FEATURE EXTRACTION PIPELINE
// ============================================================================

export function extractReadingFeatures(
  frames: GazeFrame[],
  fixationConfig?: FixationDetectionConfig,
  saccadeConfig?: SaccadeDetectionConfig,
  screenWidth: number = 1280,
  screenHeight: number = 720
): {
  fixations: Fixation[];
  saccades: Saccade[];
  regressions: Regression[];
  metrics: ExtractedMetrics;
} {
  if (frames.length === 0) {
    return {
      fixations: [],
      saccades: [],
      regressions: [],
      metrics: {
        fixationCount: 0,
        saccadeCount: 0,
        regressionCount: 0,
        regressionRate: 0,
        averageFixationDuration: 0,
        minFixationDuration: 0,
        maxFixationDuration: 0,
        averageSaccadeAmplitude: 0,
        readingSpeed: 0,
        verticalStability: 0,
        horizontalStability: 0,
        totalFixationTime: 0,
        totalSaccadeTime: 0,
        fixationPercentage: 0,
      },
    };
  }

  // Extract fixations
  const fixations = detectFixations(frames, fixationConfig);

  // Extract saccades
  const saccades = detectSaccadesFromFixations(
    fixations,
    frames,
    saccadeConfig,
    screenWidth
  );

  // Extract regressions
  const regressions = detectRegressions(saccades);

  // Compute metrics
  const sessionDurationMs = frames[frames.length - 1].timestampMs - frames[0].timestampMs;

  const totalFixationTime = fixations.reduce((sum, f) => sum + f.durationMs, 0);
  const totalSaccadeTime = saccades.reduce((sum, s) => sum + s.durationMs, 0);

  const fixationDurations = fixations.map((f) => f.durationMs);
  const saccadeAmplitudes = saccades.map((s) => s.amplitudeNormalized);

  const metrics: ExtractedMetrics = {
    fixationCount: fixations.length,
    saccadeCount: saccades.length,
    regressionCount: regressions.length,
    regressionRate:
      saccades.length > 0 ? (regressions.length / saccades.length) * 100 : 0,
    averageFixationDuration:
      fixationDurations.length > 0
        ? fixationDurations.reduce((a, b) => a + b, 0) / fixationDurations.length
        : 0,
    minFixationDuration:
      fixationDurations.length > 0 ? Math.min(...fixationDurations) : 0,
    maxFixationDuration:
      fixationDurations.length > 0 ? Math.max(...fixationDurations) : 0,
    averageSaccadeAmplitude:
      saccadeAmplitudes.length > 0
        ? saccadeAmplitudes.reduce((a, b) => a + b, 0) / saccadeAmplitudes.length
        : 0,
    readingSpeed: estimateReadingSpeed(fixations, sessionDurationMs),
    verticalStability: calculateVerticalStability(fixations, screenHeight),
    horizontalStability: calculateHorizontalStability(fixations, screenWidth),
    totalFixationTime,
    totalSaccadeTime,
    fixationPercentage:
      sessionDurationMs > 0
        ? (totalFixationTime / sessionDurationMs) * 100
        : 0,
  };

  return {
    fixations,
    saccades,
    regressions,
    metrics,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported in their interface definitions above
