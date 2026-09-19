/**
 * Core gaze processing algorithms
 * - Kalman filtering
 * - Head normalization
 * - Saccade/fixation detection
 * - Word mapping
 */

import type {
  RawGazePoint,
  SmoothedGazePoint,
  KalmanState,
  WordBound,
  GazeProcessingConfig,
} from "@/types/gazeProcessing";

// ============================================================================
// KALMAN FILTER - Smooth noisy gaze with velocity estimation
// ============================================================================

export class GazeKalmanFilter {
  private state: KalmanState;
  private readonly config: GazeProcessingConfig;
  private dt: number; // Time since last update (seconds)

  constructor(initialX: number, initialY: number, config: GazeProcessingConfig) {
    this.config = config;
    this.dt = 0.033; // ~30ms default
    this.state = {
      x: initialX,
      y: initialY,
      vx: 0,
      vy: 0,
      px: 100, // Initial position uncertainty
      py: 100,
      pvx: 100, // Initial velocity uncertainty
      pvy: 100,
    };
  }

  /**
   * Predict next state
   */
  private predict(): void {
    // Physics: x_new = x + vx * dt
    this.state.x += this.state.vx * this.dt;
    this.state.y += this.state.vy * this.dt;

    // Uncertainty grows (process noise)
    const q = this.config.kalmanProcessNoise;
    this.state.px += this.state.pvx * this.dt + q;
    this.state.py += this.state.pvy * this.dt + q;
    this.state.pvx += q;
    this.state.pvy += q;
  }

  /**
   * Update with measurement
   */
  update(measuredX: number, measuredY: number, dt: number): void {
    this.dt = dt / 1000; // Convert ms to seconds

    this.predict();

    // Measurement uncertainty
    const r = this.config.kalmanMeasurementNoise;

    // Kalman gain
    const kx = this.state.px / (this.state.px + r);
    const ky = this.state.py / (this.state.py + r);

    // Update state
    const innovationX = measuredX - this.state.x;
    const innovationY = measuredY - this.state.y;
    this.state.x += kx * innovationX;
    this.state.y += ky * innovationY;

    // Update velocity (simplified)
    if (this.dt > 0) {
      this.state.vx = innovationX / this.dt * 0.5 + this.state.vx * 0.5;
      this.state.vy = innovationY / this.dt * 0.5 + this.state.vy * 0.5;
    }

    // Update uncertainty
    this.state.px *= 1 - kx;
    this.state.py *= 1 - ky;
  }

  getState(): SmoothedGazePoint {
    const velocity = Math.sqrt(this.state.vx ** 2 + this.state.vy ** 2);
    return {
      timestamp: 0, // Will be set by caller
      gazeX: this.state.x,
      gazeY: this.state.y,
      velocityX: this.state.vx,
      velocityY: this.state.vy,
      velocity,
      confidence: Math.max(0, 1 - (this.state.px + this.state.py) / 200),
      faceDetected: true,
    };
  }

  reset(x: number, y: number): void {
    this.state = {
      x,
      y,
      vx: 0,
      vy: 0,
      px: 100,
      py: 100,
      pvx: 100,
      pvy: 100,
    };
  }
}

// ============================================================================
// INTERPOLATION - Upsample gaze to higher FPS
// ============================================================================

/**
 * Linear interpolation between two gaze points
 */
export function interpolateGazePoints(
  p1: RawGazePoint,
  p2: RawGazePoint,
  targetFPS: number
): RawGazePoint[] {
  const timeDelta = p2.timestamp - p1.timestamp;
  if (timeDelta <= 0) return [];

  const frameInterval = 1000 / targetFPS; // ms between frames
  const numInterpolations = Math.floor(timeDelta / frameInterval) - 1;

  if (numInterpolations <= 0) return [];

  const interpolated: RawGazePoint[] = [];

  for (let i = 1; i <= numInterpolations; i++) {
    const t = (i * frameInterval) / timeDelta;
    if (t >= 1) break;

    interpolated.push({
      timestamp: p1.timestamp + i * frameInterval,
      gazeX: p1.gazeX + (p2.gazeX - p1.gazeX) * t,
      gazeY: p1.gazeY + (p2.gazeY - p1.gazeY) * t,
      confidence: Math.min(p1.confidence, p2.confidence) * 0.95, // Slightly lower confidence
      faceDetected: p1.faceDetected && p2.faceDetected,
    });
  }

  return interpolated;
}

/**
 * Upsample gaze stream by interpolating between received points
 */
export function upsampleGazeStream(
  points: RawGazePoint[],
  targetFPS: number
): RawGazePoint[] {
  if (points.length < 2) return points;

  const upsampled: RawGazePoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const interpolated = interpolateGazePoints(points[i - 1], points[i], targetFPS);
    upsampled.push(...interpolated);
    upsampled.push(points[i]);
  }

  return upsampled;
}

// ============================================================================
// HEAD NORMALIZATION - Remove head movement from gaze
// ============================================================================

/**
 * Extract face center from FaceMesh keypoints
 * Uses: nose tip (keypoint 1), eyes, and cheeks
 */
export function extractFaceCenter(
  faceMeshKeypoints: Array<{ x: number; y: number }>,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number } {
  if (!faceMeshKeypoints || faceMeshKeypoints.length < 10) {
    return { x: videoWidth / 2, y: videoHeight / 2 };
  }

  // Average nose tip and eye centers
  const noseTip = faceMeshKeypoints[1] || { x: videoWidth / 2, y: videoHeight / 2 };
  const leftEye = faceMeshKeypoints[33] || noseTip;
  const rightEye = faceMeshKeypoints[263] || noseTip;

  return {
    x: (noseTip.x + leftEye.x + rightEye.x) / 3,
    y: (noseTip.y + leftEye.y + rightEye.y) / 3,
  };
}

/**
 * Normalize gaze relative to face center
 * Reduces head movement impact
 */
export function normalizeGazeToFace(
  gazeX: number,
  gazeY: number,
  faceCenter: { x: number; y: number },
  referenceFaceCenter: { x: number; y: number }
): { x: number; y: number } {
  // Head has moved by this amount
  const headDeltaX = faceCenter.x - referenceFaceCenter.x;
  const headDeltaY = faceCenter.y - referenceFaceCenter.y;

  // Remove head movement from gaze
  return {
    x: gazeX - headDeltaX,
    y: gazeY - headDeltaY,
  };
}

// ============================================================================
// VELOCITY & SACCADE DETECTION
// ============================================================================

/**
 * Compute velocity between two points
 */
export function computeVelocity(
  p1: { x: number; y: number; timestamp: number },
  p2: { x: number; y: number; timestamp: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dt = Math.max(1, p2.timestamp - p1.timestamp); // ms
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance / dt; // px/ms
}

/**
 * Detect if a transition is a saccade
 * Saccade = large amplitude + high velocity
 */
export function isSaccade(
  p1: SmoothedGazePoint,
  p2: SmoothedGazePoint,
  config: GazeProcessingConfig
): boolean {
  const dx = p2.gazeX - p1.gazeX;
  const dy = p2.gazeY - p1.gazeY;
  const amplitude = Math.sqrt(dx * dx + dy * dy);

  const velocity = p2.velocity || computeVelocity(
    { x: p1.gazeX, y: p1.gazeY, timestamp: p1.timestamp },
    { x: p2.gazeX, y: p2.gazeY, timestamp: p2.timestamp }
  );

  return (
    amplitude >= config.saccadeAmplitudeThreshold &&
    velocity >= config.saccadeVelocityThreshold
  );
}

// ============================================================================
// WORD MAPPING
// ============================================================================

/**
 * Distance from gaze point to word bounding box
 */
export function distanceToWord(
  gazeX: number,
  gazeY: number,
  word: WordBound
): number {
  // Closest point on word box to gaze
  const closestX = Math.max(word.x, Math.min(gazeX, word.x + word.width));
  const closestY = Math.max(word.y, Math.min(gazeY, word.y + word.height));

  // Distance
  const dx = gazeX - closestX;
  const dy = gazeY - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find nearest word to gaze point
 */
export function mapGazeToWord(
  gazeX: number,
  gazeY: number,
  words: WordBound[],
  maxDistance: number
): WordBound | null {
  let nearest: WordBound | null = null;
  let minDist = maxDistance;

  for (const word of words) {
    const dist = distanceToWord(gazeX, gazeY, word);
    if (dist < minDist) {
      minDist = dist;
      nearest = word;
    }
  }

  return nearest;
}

/**
 * Check if gaze is inside word bounding box
 */
export function isGazeInsideWord(
  gazeX: number,
  gazeY: number,
  word: WordBound
): boolean {
  return (
    gazeX >= word.x &&
    gazeX <= word.x + word.width &&
    gazeY >= word.y &&
    gazeY <= word.y + word.height
  );
}

// ============================================================================
// STABILITY METRICS
// ============================================================================

/**
 * Compute stability of a group of points (0-1, lower is more stable)
 */
export function computePointsStability(
  points: Array<{ x: number; y: number }>
): number {
  if (points.length < 2) return 0;

  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };

  const distances = points.map(p => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const maxDist = Math.max(...distances);
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;

  // Normalize to 0-1 (0 = perfectly stable, 1 = very unstable)
  return Math.min(1, (maxDist - avgDist) / 100);
}

/**
 * Compute vertical deviation (max vertical movement)
 */
export function computeVerticalDeviation(
  points: Array<{ y: number }>
): number {
  if (points.length === 0) return 0;
  const yValues = points.map(p => p.y);
  return Math.max(...yValues) - Math.min(...yValues);
}

// ============================================================================
// REGRESSION DETECTION
// ============================================================================

/**
 * Check if saccade is a regression (backward movement in reading)
 */
export function isRegression(
  fromWordIndex: number,
  toWordIndex: number
): boolean {
  return toWordIndex < fromWordIndex;
}

/**
 * Calculate reading direction: forward, backward, or vertical
 */
export function getSaccadeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): "forward" | "backward" | "vertical" {
  const dx = endX - startX;
  const dy = endY - startY;

  const horizontalMagnitude = Math.abs(dx);
  const verticalMagnitude = Math.abs(dy);

  // Primarily vertical movement
  if (verticalMagnitude > horizontalMagnitude * 0.5) {
    return "vertical";
  }

  // Horizontal movement
  if (dx > 0) return "forward";
  return "backward";
}
