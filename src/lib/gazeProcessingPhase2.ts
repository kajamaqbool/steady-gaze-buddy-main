/**
 * PHASE 2: Gaze Processing Module
 * 
 * Processes raw gaze frames:
 * - Moving average smoothing (3-frame window)
 * - Linear interpolation to fill frame gaps
 * - Velocity-based outlier detection
 * - Preserves saccadic movements
 */

import type { GazeFrame } from "@/types/gazeFrame";

interface ProcessingConfig {
  smoothingWindowSize: number;    // 3-5 frames
  velocityOutlierThreshold: number; // 2.5 * stdDev
  maxVelocityPxPerMs: number;      // Clamp unrealistic velocities
  interpolateMissingFrames: boolean;
}

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  smoothingWindowSize: 3,
  velocityOutlierThreshold: 2.5,
  maxVelocityPxPerMs: 2.0,  // ~60px/ms at 30Hz (extreme saccade)
  interpolateMissingFrames: true,
};

// ============================================================================
// SMOOTHING: Moving Average Filter
// ============================================================================

/**
 * Apply moving average smoothing
 * Window centered on each frame (earlier + current + later)
 * Reduces jitter while maintaining saccade sharpness
 */
export function smoothGazePoints(
  frames: GazeFrame[],
  windowSize: number = 3
): GazeFrame[] {
  if (frames.length === 0) return [];
  if (frames.length < windowSize) return frames; // Can't smooth, not enough data

  const smoothed: GazeFrame[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < frames.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(frames.length, i + halfWindow + 1);
    const window = frames.slice(start, end);

    // Average gaze position
    const avgX = window.reduce((sum, f) => sum + f.gazeX, 0) / window.length;
    const avgY = window.reduce((sum, f) => sum + f.gazeY, 0) / window.length;

    // Average head position
    const avgHeadX = window.reduce((sum, f) => sum + f.headCenterX, 0) / window.length;
    const avgHeadY = window.reduce((sum, f) => sum + f.headCenterY, 0) / window.length;
    const avgHeadRotX = window.reduce((sum, f) => sum + f.headRotationX, 0) / window.length;
    const avgHeadRotY = window.reduce((sum, f) => sum + f.headRotationY, 0) / window.length;
    const avgHeadRotZ = window.reduce((sum, f) => sum + f.headRotationZ, 0) / window.length;

    // Compute new velocity based on smoothed position
    let velocityX = 0;
    let velocityY = 0;
    let velocity = 0;

    if (i > 0 && frames[i].dtMs > 0) {
      const prevFrame = smoothed[i - 1];
      velocityX = (avgX - prevFrame.gazeX) / frames[i].dtMs;
      velocityY = (avgY - prevFrame.gazeY) / frames[i].dtMs;
      velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    }

    // Average confidence
    const avgConfidence = window.reduce((sum, f) => sum + f.confidence, 0) / window.length;

    smoothed.push({
      ...frames[i],
      gazeX: avgX,
      gazeY: avgY,
      velocityX,
      velocityY,
      velocity,
      headCenterX: avgHeadX,
      headCenterY: avgHeadY,
      headRotationX: avgHeadRotX,
      headRotationY: avgHeadRotY,
      headRotationZ: avgHeadRotZ,
      confidence: avgConfidence,
    });
  }

  return smoothed;
}

// ============================================================================
// OUTLIER DETECTION: Velocity-Based
// ============================================================================

/**
 * Detect outliers using velocity thresholds
 * Identifies stuck pixels, tracking glitches
 */
export function detectOutliers(
  frames: GazeFrame[],
  outlierThreshold: number = 2.5,
  maxVelocity: number = 2.0
): number[] {
  if (frames.length < 2) return [];

  const outlierIndices: number[] = [];
  const velocities = frames.map((f) => f.velocity);

  // Compute statistics on velocity
  const meanVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance =
    velocities.reduce(
      (sum, v) => sum + (v - meanVelocity) ** 2,
      0
    ) / velocities.length;
  const stdDev = Math.sqrt(variance);
  const threshold = meanVelocity + outlierThreshold * stdDev;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Flag unrealistic velocities
    if (frame.velocity > Math.max(threshold, maxVelocity)) {
      outlierIndices.push(i);
    }

    // Flag stuck pixels (velocity = 0 for too long)
    if (i > 2) {
      const lastThree =  frames.slice(i - 2, i + 1);
      if (lastThree.every((f) => f.velocity < 0.001)) {
        outlierIndices.push(i);
      }
    }
  }

  return outlierIndices;
}

/**
 * Remove outlier frames
 * Fills gaps with interpolation
 */
export function removeOutliers(
  frames: GazeFrame[],
  outlierIndices: number[]
): GazeFrame[] {
  if (outlierIndices.length === 0) return frames;

  const outlierSet = new Set(outlierIndices);
  return frames.filter((_, i) => !outlierSet.has(i));
}

// ============================================================================
// INTERPOLATION: Fill Missing Frames
// ============================================================================

/**
 * Linear interpolation between two frames
 * Generates intermediate frames to simulate higher sampling rate
 */
function interpolateFrames(frame1: GazeFrame, frame2: GazeFrame, count: number): GazeFrame[] {
  if (count <= 0) return [];

  const interpolated: GazeFrame[] = [];
  const timeDelta = frame2.timestampMs - frame1.timestampMs;

  for (let i = 1; i <= count; i++) {
    const alpha = i / (count + 1);

    const interpX = frame1.gazeX + (frame2.gazeX - frame1.gazeX) * alpha;
    const interpY = frame1.gazeY + (frame2.gazeY - frame1.gazeY) * alpha;

    const interpHeadX = frame1.headCenterX + (frame2.headCenterX - frame1.headCenterX) * alpha;
    const interpHeadY = frame1.headCenterY + (frame2.headCenterY - frame1.headCenterY) * alpha;

    const interpVelX = frame1.velocityX + (frame2.velocityX - frame1.velocityX) * alpha;
    const interpVelY = frame1.velocityY + (frame2.velocityY - frame1.velocityY) * alpha;
    const interpVel = Math.sqrt(interpVelX * interpVelX + interpVelY * interpVelY);

    const interpConfidence =
      Math.min(frame1.confidence, frame2.confidence) * 0.9; // Slightly lower confidence

    const interpTimestamp =
      frame1.timestampMs + (timeDelta / (count + 1)) * i;

    interpolated.push({
      ...frame1,
      timestampMs: interpTimestamp,
      elapsedMs: frame1.elapsedMs + (frame2.elapsedMs - frame1.elapsedMs) * alpha,
      frameId: frame1.frameId + i, // Assign sequential IDs
      gazeX: interpX,
      gazeY: interpY,
      velocityX: interpVelX,
      velocityY: interpVelY,
      velocity: interpVel,
      headCenterX: interpHeadX,
      headCenterY: interpHeadY,
      confidence: interpConfidence,
      faceDetected: frame1.faceDetected && frame2.faceDetected,
    });
  }

  return interpolated;
}

/**
 * Fill gaps in frame sequence
 * If frames are >50ms apart, interpolate intermediate frames
 */
export function fillFrameGaps(
  frames: GazeFrame[],
  targetDtMs: number = 33
): GazeFrame[] {
  if (frames.length < 2) return frames;

  const result: GazeFrame[] = [frames[0]];
  const gapThresholdMs = targetDtMs * 1.5; // 50ms gap

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const current = frames[i];
    const timeDelta = current.timestampMs - prev.timestampMs;

    if (timeDelta > gapThresholdMs) {
      // Gap detected, interpolate
      const frameCount = Math.round(timeDelta / targetDtMs) - 1;
      const interpolated = interpolateFrames(prev, current, Math.max(1, frameCount));
      result.push(...interpolated);
    }

    result.push(current);
  }

  return result;
}

// ============================================================================
// PROCESSING PIPELINE
// ============================================================================

/**
 * Complete gaze processing pipeline
 * 1. Smooth raw frames
 * 2. Detect and remove outliers
 * 3. Interpolate missing frames
 */
export function processGazeFrames(
  rawFrames: GazeFrame[],
  config: ProcessingConfig = DEFAULT_PROCESSING_CONFIG
): {
  processed: GazeFrame[];
  outlierCount: number;
  originalFrameCount: number;
} {
  if (rawFrames.length === 0) {
    return { processed: [], outlierCount: 0, originalFrameCount: 0 };
  }

  const originalCount = rawFrames.length;

  // Step 1: Smooth
  let frames = smoothGazePoints(rawFrames, config.smoothingWindowSize);

  // Step 2: Detect outliers
  const outliers = detectOutliers(
    frames,
    config.velocityOutlierThreshold,
    config.maxVelocityPxPerMs
  );
  const outlierCount = outliers.length;
  frames = removeOutliers(frames, outliers);

  // Step 3: Interpolate gaps
  if (config.interpolateMissingFrames) {
    frames = fillFrameGaps(frames);
  }

  return {
    processed: frames,
    outlierCount,
    originalFrameCount: originalCount,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ProcessingConfig };
