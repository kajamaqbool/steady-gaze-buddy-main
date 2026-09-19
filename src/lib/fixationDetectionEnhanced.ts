/**
 * Enhanced Fixation Detection
 * - Cluster gaze points that stay within radius
 * - Merge micro-fixations (<80ms)
 * - Ignore jitter clusters
 */

export interface Fixation {
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  centerX: number; // averaged position
  centerY: number;
  pointCount: number;
  word: string;
  saccadeToNextDistance: number;
  isMergedFixation: boolean;
}

export interface FixationDetectionConfig {
  spatialThreshold: number; // pixels (30-50px)
  temporalThreshold: number; // milliseconds (80-100ms min duration)
  microFixationDuration: number; // ms threshold for merging (80ms)
  microFixationDistance: number; // px threshold for merging (40px)
}

export const DEFAULT_FIXATION_CONFIG: FixationDetectionConfig = {
  spatialThreshold: 40, // 40px radius
  temporalThreshold: 100, // 100ms minimum
  microFixationDuration: 80,
  microFixationDistance: 40,
};

/**
 * Detect fixations using spatial clustering
 * Groups gaze points that stay within spatialThreshold pixels
 */
export function detectFixations(
  gazePoints: Array<{
    timestamp: number;
    gazeX: number;
    gazeY: number;
    faceDetected: boolean;
    word?: string;
  }>,
  config: FixationDetectionConfig = DEFAULT_FIXATION_CONFIG
): Fixation[] {
  if (gazePoints.length === 0) return [];

  // Filter only points where face is detected
  const validPoints = gazePoints.filter((p) => p.faceDetected);
  if (validPoints.length === 0) return [];

  const fixations: Fixation[] = [];
  let clusterStart = 0;
  let clusterPoints = [validPoints[0]];
  let clusterCenterX = validPoints[0].gazeX;
  let clusterCenterY = validPoints[0].gazeY;

  for (let i = 1; i < validPoints.length; i++) {
    const point = validPoints[i];
    const distance = Math.sqrt(
      (point.gazeX - clusterCenterX) ** 2 + (point.gazeY - clusterCenterY) ** 2
    );

    if (distance <= config.spatialThreshold) {
      // Point is within cluster
      clusterPoints.push(point);
      // Update cluster center (running average)
      clusterCenterX = (clusterCenterX + point.gazeX) / 2;
      clusterCenterY = (clusterCenterY + point.gazeY) / 2;
    } else {
      // Point is outside cluster - finalize current cluster
      const duration = validPoints[i - 1].timestamp - validPoints[clusterStart].timestamp;

      if (duration >= config.temporalThreshold) {
        fixations.push({
          startTime: validPoints[clusterStart].timestamp,
          endTime: validPoints[i - 1].timestamp,
          duration,
          centerX: clusterCenterX,
          centerY: clusterCenterY,
          pointCount: clusterPoints.length,
          word: clusterPoints[0].word || "",
          saccadeToNextDistance: 0, // Will be calculated later
          isMergedFixation: false,
        });
      }

      // Start new cluster
      clusterStart = i;
      clusterPoints = [point];
      clusterCenterX = point.gazeX;
      clusterCenterY = point.gazeY;
    }
  }

  // Flush last cluster
  const lastDuration =
    validPoints[validPoints.length - 1].timestamp - validPoints[clusterStart].timestamp;
  if (lastDuration >= config.temporalThreshold) {
    fixations.push({
      startTime: validPoints[clusterStart].timestamp,
      endTime: validPoints[validPoints.length - 1].timestamp,
      duration: lastDuration,
      centerX: clusterCenterX,
      centerY: clusterCenterY,
      pointCount: clusterPoints.length,
      word: clusterPoints[0].word || "",
      saccadeToNextDistance: 0,
      isMergedFixation: false,
    });
  }

  return fixations;
}

/**
 * Merge micro-fixations (very brief fixations close together)
 * Reduces noise from tracking instability
 */
export function mergeMicroFixations(
  fixations: Fixation[],
  config: FixationDetectionConfig = DEFAULT_FIXATION_CONFIG
): Fixation[] {
  if (fixations.length < 2) return fixations;

  const merged: Fixation[] = [];
  let current = fixations[0];

  for (let i = 1; i < fixations.length; i++) {
    const next = fixations[i];
    const distance = Math.sqrt(
      (next.centerX - current.centerX) ** 2 + (next.centerY - current.centerY) ** 2
    );
    const timeGap = next.startTime - current.endTime;

    // Check if should merge: short gap + close distance + either is brief
    const shouldMerge =
      timeGap < 50 && // Less than 50ms gap
      distance < config.microFixationDistance &&
      (current.duration < config.microFixationDuration ||
        next.duration < config.microFixationDuration);

    if (shouldMerge) {
      // Merge into current
      current = {
        startTime: current.startTime,
        endTime: next.endTime,
        duration: next.endTime - current.startTime,
        centerX: (current.centerX + next.centerX) / 2,
        centerY: (current.centerY + next.centerY) / 2,
        pointCount: current.pointCount + next.pointCount,
        word: current.word || next.word,
        saccadeToNextDistance: 0,
        isMergedFixation: true,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Calculate distance to next fixation (for saccade analysis)
 */
export function calculateSaccadeDistances(fixations: Fixation[]): Fixation[] {
  for (let i = 0; i < fixations.length - 1; i++) {
    const current = fixations[i];
    const next = fixations[i + 1];
    const dx = next.centerX - current.centerX;
    const dy = next.centerY - current.centerY;
    current.saccadeToNextDistance = Math.sqrt(dx * dx + dy * dy);
  }

  return fixations;
}

/**
 * Detect jitter (high-frequency noise) in a fixation
 * Returns standard deviation of points within fixation
 */
export function measureFixationJitter(
  fixationPoints: Array<{ gazeX: number; gazeY: number }>
): number {
  if (fixationPoints.length < 2) return 0;

  const xs = fixationPoints.map((p) => p.gazeX);
  const ys = fixationPoints.map((p) => p.gazeY);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  const varX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length;
  const varY = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / ys.length;

  const stdX = Math.sqrt(varX);
  const stdY = Math.sqrt(varY);

  return Math.sqrt(stdX * stdX + stdY * stdY);
}

/**
 * Filter out high-jitter fixations (tracking noise)
 */
export function filterHighJitterFixations(
  fixations: Fixation[],
  fixationPoints: Map<number, Array<{ gazeX: number; gazeY: number }>>,
  jitterThreshold: number = 5
): Fixation[] {
  return fixations.filter((fix, idx) => {
    const points = fixationPoints.get(idx) || [];
    const jitter = measureFixationJitter(points);
    return jitter <= jitterThreshold;
  });
}

/**
 * Complete fixation detection pipeline
 */
export function detectFixationsComplete(
  gazePoints: Array<{
    timestamp: number;
    gazeX: number;
    gazeY: number;
    faceDetected: boolean;
    word?: string;
  }>,
  config: FixationDetectionConfig = DEFAULT_FIXATION_CONFIG
): Fixation[] {
  // Step 1: Detect fixation clusters
  let fixations = detectFixations(gazePoints, config);

  // Step 2: Merge micro-fixations
  fixations = mergeMicroFixations(fixations, config);

  // Step 3: Calculate saccade distances
  fixations = calculateSaccadeDistances(fixations);

  return fixations;
}
