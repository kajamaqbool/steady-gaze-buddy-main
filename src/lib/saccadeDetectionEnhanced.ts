/**
 * Enhanced Saccade Detection
 * - Velocity-based detection (fast eye movements)
 * - Transition-based detection (between fixations)
 * - Direction classification (forward/backward/vertical)
 */

import type { Fixation } from "./fixationDetectionEnhanced";

export interface Saccade {
  startTime: number;
  endTime: number;
  duration: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distance: number;
  velocity: number; // pixels per second
  direction: "forward" | "backward" | "vertical";
  isRegression: boolean;
}

export interface SaccadeDetectionConfig {
  minVelocity: number; // pixels per second
  minDistance: number; // pixels
  regressionThreshold: number; // horizontal distance threshold (px)
}

export const DEFAULT_SACCADE_CONFIG: SaccadeDetectionConfig = {
  minVelocity: 300, // 300 px/s is typical for saccades
  minDistance: 30, // at least 30px
  regressionThreshold: 50, // regression if moves backward more than 50px
};

/**
 * Detect saccades using velocity-based method
 * Analyzes raw gaze point velocity between frames
 */
export function detectSaccadesVelocityBased(
  gazePoints: Array<{
    timestamp: number;
    gazeX: number;
    gazeY: number;
    faceDetected: boolean;
  }>,
  config: SaccadeDetectionConfig = DEFAULT_SACCADE_CONFIG
): Saccade[] {
  if (gazePoints.length < 2) return [];

  const validPoints = gazePoints.filter((p) => p.faceDetected);
  if (validPoints.length < 3) return [];

  const saccades: Saccade[] = [];
  let inSaccade = false;
  let saccadeStart = 0;
  let saccadeStartX = validPoints[0].gazeX;
  let saccadeStartY = validPoints[0].gazeY;
  let saccadeStartTime = validPoints[0].timestamp;

  for (let i = 1; i < validPoints.length; i++) {
    const curr = validPoints[i];
    const prev = validPoints[i - 1];

    const dx = curr.gazeX - prev.gazeX;
    const dy = curr.gazeY - prev.gazeY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const timeDelta = (curr.timestamp - prev.timestamp) / 1000; // seconds
    const velocity = timeDelta > 0 ? distance / timeDelta : 0;

    const isHighVelocity =
      velocity > config.minVelocity && distance > config.minDistance;

    if (isHighVelocity && !inSaccade) {
      // Start of saccade
      inSaccade = true;
      saccadeStartX = prev.gazeX;
      saccadeStartY = prev.gazeY;
      saccadeStartTime = prev.timestamp;
    } else if (!isHighVelocity && inSaccade) {
      // End of saccade
      const saccade: Saccade = {
        startTime: saccadeStartTime,
        endTime: prev.timestamp,
        duration: prev.timestamp - saccadeStartTime,
        fromX: saccadeStartX,
        fromY: saccadeStartY,
        toX: prev.gazeX,
        toY: prev.gazeY,
        distance: Math.sqrt(
          (prev.gazeX - saccadeStartX) ** 2 + (prev.gazeY - saccadeStartY) ** 2
        ),
        velocity: 0, // Will be calculated below
        direction: classifySaccadeDirection(
          saccadeStartX,
          saccadeStartY,
          prev.gazeX,
          prev.gazeY,
          config.regressionThreshold
        ),
        isRegression:
          classifySaccadeDirection(
            saccadeStartX,
            saccadeStartY,
            prev.gazeX,
            prev.gazeY,
            config.regressionThreshold
          ) === "backward",
      };

      // Calculate average velocity
      const totalDistance = Math.sqrt(
        (prev.gazeX - saccadeStartX) ** 2 + (prev.gazeY - saccadeStartY) ** 2
      );
      const totalTime = (prev.timestamp - saccadeStartTime) / 1000;
      saccade.velocity = totalTime > 0 ? totalDistance / totalTime : 0;

      saccades.push(saccade);
      inSaccade = false;
    }
  }

  return saccades;
}

/**
 * Detect saccades using fixation transitions
 * Gaps between consecutive fixations
 */
export function detectSaccadesFromFixations(
  fixations: Fixation[],
  config: SaccadeDetectionConfig = DEFAULT_SACCADE_CONFIG
): Saccade[] {
  if (fixations.length < 2) return [];

  const saccades: Saccade[] = [];

  for (let i = 1; i < fixations.length; i++) {
    const from = fixations[i - 1];
    const to = fixations[i];

    const dx = to.centerX - from.centerX;
    const dy = to.centerY - from.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Time between end of current fixation and start of next
    const timeDelta = (to.startTime - from.endTime) / 1000;
    const velocity = timeDelta > 0 ? distance / timeDelta : 0;

    if (distance > config.minDistance) {
      saccades.push({
        startTime: from.endTime,
        endTime: to.startTime,
        duration: to.startTime - from.endTime,
        fromX: from.centerX,
        fromY: from.centerY,
        toX: to.centerX,
        toY: to.centerY,
        distance,
        velocity,
        direction: classifySaccadeDirection(
          from.centerX,
          from.centerY,
          to.centerX,
          to.centerY,
          config.regressionThreshold
        ),
        isRegression: to.centerX < from.centerX,
      });
    }
  }

  return saccades;
}

/**
 * Classify saccade direction
 */
function classifySaccadeDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  regressionThreshold: number
): "forward" | "backward" | "vertical" {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Primarily vertical movement
  if (absDy > absDx * 1.5) {
    return "vertical";
  }

  // Horizontal movement - check direction
  if (dx < -regressionThreshold) {
    return "backward"; // Moving left (regression)
  } else if (dx > regressionThreshold) {
    return "forward"; // Moving right (forward)
  }

  // No significant horizontal movement
  return "vertical";
}

/**
 * Identify regressions (backward saccades)
 */
export function filterRegressions(saccades: Saccade[]): Saccade[] {
  return saccades.filter((s) => s.isRegression);
}

/**
 * Calculate regression rate (% of saccades that are regressions)
 */
export function getRegressionRate(saccades: Saccade[]): number {
  if (saccades.length === 0) return 0;
  const regressions = saccades.filter((s) => s.isRegression).length;
  return (regressions / saccades.length) * 100;
}

/**
 * Detect if saccade pattern is realistic for reading
 * Expected: 20-40 saccades per 60-second session
 * Expected: 30-50% should be regressions
 */
export function isSaccadePatternRealistic(saccades: Saccade[], durationSeconds: number): boolean {
  const expectedMin = (durationSeconds / 60) * 20; // 20 saccades per minute
  const expectedMax = (durationSeconds / 60) * 40; // max 40 per minute

  if (saccades.length < expectedMin) return false; // Too few saccades
  if (saccades.length > expectedMax * 2) return false; // Way too many

  const regressionRate = getRegressionRate(saccades);
  if (regressionRate < 10) return false; // No regressions at all
  if (regressionRate > 80) return false; // Almost all regressions (unrealistic)

  return true;
}

/**
 * Detect if saccade velocity is consistent (realistic)
 */
export function isSaccadeVelocityConsistent(saccades: Saccade[]): boolean {
  if (saccades.length < 2) return true;

  const velocities = saccades.map((s) => s.velocity);
  const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
  const stdDev = Math.sqrt(variance);

  // Velocity should be relatively consistent
  const coefficientOfVariation = stdDev / mean;
  return coefficientOfVariation < 0.8; // 80% variation is high but acceptable
}

/**
 * Detect main sequence (relationship between saccade distance and duration)
 * In normal reading: log(distance) correlates with log(duration)
 */
export function isMainSequenceValidated(saccades: Saccade[]): boolean {
  if (saccades.length < 5) return true; // Need enough data

  // For a proper main sequence check, would correlate distance vs duration
  // Simple version: check that larger saccades take longer
  const sortedByDistance = [...saccades].sort((a, b) => a.distance - b.distance);

  let correlationGood = true;
  for (let i = 0; i < sortedByDistance.length - 1; i++) {
    const curr = sortedByDistance[i];
    const next = sortedByDistance[i + 1];

    // Generally: bigger distance should have longer/similar duration
    if (curr.distance < next.distance && curr.duration > next.duration * 1.5) {
      correlationGood = false;
      break;
    }
  }

  return correlationGood;
}
