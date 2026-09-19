/**
 * Gaze Smoothing & Interpolation
 * - Moving average smoothing (window = 3-5 frames)
 * - Linear interpolation to simulate 20-30 Hz from 5 Hz input
 * - Preserves saccadic movements while reducing jitter
 */

export interface SmoothedFrame {
  timestamp: number;
  gazeX: number;
  gazeY: number;
  confidence: number;
  faceDetected: boolean;
}

/**
 * Apply moving average smoothing to reduce jitter
 * Window size = 3-5 frames for optimal noise reduction
 */
export function smoothGazeMovingAverage(
  points: SmoothedFrame[],
  windowSize: number = 3
): SmoothedFrame[] {
  if (points.length < windowSize) return points;

  const smoothed: SmoothedFrame[] = [];

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.ceil(windowSize / 2));
    const window = points.slice(start, end);

    const avgX = window.reduce((sum, p) => sum + p.gazeX, 0) / window.length;
    const avgY = window.reduce((sum, p) => sum + p.gazeY, 0) / window.length;
    const avgConf = window.reduce((sum, p) => sum + p.confidence, 0) / window.length;

    smoothed.push({
      timestamp: points[i].timestamp,
      gazeX: avgX,
      gazeY: avgY,
      confidence: avgConf,
      faceDetected: points[i].faceDetected,
    });
  }

  return smoothed;
}

/**
 * Linear interpolation between gaze points
 * Simulates higher sampling rate (20-30 Hz) from lower input (5 Hz)
 * Generates N-1 intermediate points between consecutive frames
 */
export function interpolateGazePoints(
  points: SmoothedFrame[],
  targetFps: number = 20,
  inputFps: number = 5
): SmoothedFrame[] {
  if (points.length < 2) return points;

  // How many points to insert between each pair
  const pointsPerInterval = Math.round(targetFps / inputFps);
  const interpolated: SmoothedFrame[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];

    interpolated.push(current);

    // Linear interpolation between current and next
    for (let j = 1; j < pointsPerInterval; j++) {
      const alpha = j / pointsPerInterval;
      const interpX = current.gazeX + (next.gazeX - current.gazeX) * alpha;
      const interpY = current.gazeY + (next.gazeY - current.gazeY) * alpha;
      const interpConf = current.confidence + (next.confidence - current.confidence) * alpha;

      // Interpolated timestamp
      const interpTime = current.timestamp + (next.timestamp - current.timestamp) * alpha;

      interpolated.push({
        timestamp: interpTime,
        gazeX: interpX,
        gazeY: interpY,
        confidence: interpConf,
        faceDetected: current.faceDetected && next.faceDetected,
      });
    }
  }

  // Add last point
  if (points.length > 0) {
    interpolated.push(points[points.length - 1]);
  }

  return interpolated;
}

/**
 * Combined smoothing + interpolation pipeline
 * Returns stable gaze trajectory at higher effective sampling rate
 */
export function smoothAndInterpolateGaze(
  rawPoints: SmoothedFrame[],
  smoothingWindow: number = 3,
  targetFps: number = 20,
  inputFps: number = 5
): SmoothedFrame[] {
  // Step 1: Apply moving average smoothing
  const smoothed = smoothGazeMovingAverage(rawPoints, smoothingWindow);

  // Step 2: Interpolate to higher sampling rate
  const interpolated = interpolateGazePoints(smoothed, targetFps, inputFps);

  return interpolated;
}

/**
 * Detect outliers using z-score and remove extreme jumps
 * Protects against tracking glitches and sudden face shifts
 */
export function removeOutliers(
  points: SmoothedFrame[],
  zScoreThreshold: number = 3
): SmoothedFrame[] {
  if (points.length < 2) return points;

  // Calculate statistics on gaze X and Y
  const xs = points.map((p) => p.gazeX);
  const ys = points.map((p) => p.gazeY);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  const stdX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length);
  const stdY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / ys.length);

  // Filter points within z-score threshold
  const filtered = points.filter((p) => {
    const zX = stdX > 0 ? Math.abs((p.gazeX - meanX) / stdX) : 0;
    const zY = stdY > 0 ? Math.abs((p.gazeY - meanY) / stdY) : 0;
    return zX <= zScoreThreshold && zY <= zScoreThreshold;
  });

  // If filtering removed too many points, return original
  if (filtered.length < points.length * 0.5) {
    return points;
  }

  return filtered.length > 0 ? filtered : points;
}

/**
 * Clamp extreme jumps between consecutive frames
 * Max allowed velocity = pixelsPerFrame (e.g., 100px per frame)
 */
export function clampExtremeJumps(
  points: SmoothedFrame[],
  maxPixelsPerFrame: number = 100
): SmoothedFrame[] {
  if (points.length < 2) return points;

  const clamped: SmoothedFrame[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = clamped[clamped.length - 1];
    const curr = points[i];

    const dx = curr.gazeX - prev.gazeX;
    const dy = curr.gazeY - prev.gazeY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxPixelsPerFrame) {
      // Clamp to max velocity
      const scale = maxPixelsPerFrame / distance;
      clamped.push({
        ...curr,
        gazeX: prev.gazeX + dx * scale,
        gazeY: prev.gazeY + dy * scale,
      });
    } else {
      clamped.push(curr);
    }
  }

  return clamped;
}
