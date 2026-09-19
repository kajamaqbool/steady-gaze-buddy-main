/**
 * PHASE 1: Core Data Capture Types
 * Production-ready gaze frame definition for 30Hz sampling
 * Every frame includes velocity, head position, and absolute timestamps
 */

/** Represents a single gaze measurement frame at 30Hz */
export interface GazeFrame {
  // Timing (absolute, monotonic)
  timestampMs: number;      // Date.now() - UNIX milliseconds
  elapsedMs: number;        // Milliseconds since session start (for reference)
  frameId: number;          // Sequential frame counter (0, 1, 2, ...)

  // Gaze position (normalized to viewport [0, 1])
  gazeX: number;            // 0 = left edge, 1 = right edge, normalized
  gazeY: number;            // 0 = top edge, 1 = bottom edge, normalized

  // Velocity (in normalized space per millisecond)
  velocityX: number;        // dx/dt normalized units/ms
  velocityY: number;        // dy/dt normalized units/ms
  velocity: number;         // Euclidean magnitude (px_virtual/ms)

  // Head position (normalized, from FaceMesh landmarks)
  headCenterX: number;      // Face center X (normalized)
  headCenterY: number;      // Face center Y (normalized)
  headRotationX: number;    // Yaw in radians (-π to π)
  headRotationY: number;    // Pitch in radians (-π/2 to π/2)
  headRotationZ: number;    // Roll in radians (-π to π)

  // Quality metrics
  confidence: number;       // 0-1, dynamic based on FaceMesh quality
  faceDetected: boolean;    // Whether face landmarks were detected this frame
  irisVisible: boolean;     // Whether iris landmarks specifically visible

  // Reading context
  currentWord?: string;     // Mapped word at gaze location
  currentWordIndex?: number; // Index in story
  scrollOffset?: number;    // Scroll position if applicable

  // Sampling metadata
  samplingRateHz: number;   // Expected Hz for this frame (30)
  dtMs: number;             // Time since last frame (typically 33ms)
}

/** Batched raw gaze data for transmission */
export interface GazeFrameBatch {
  sessionId: string;
  startTimeMs: number;
  endTimeMs: number;
  frames: GazeFrame[];
  droppedFrameCount: number;
  averageDtMs: number;      // Average frame interval
}

/** Session-level metadata about gaze capture */
export interface GazeCaptureMetadata {
  sessionId: string;
  startTimeMs: number;
  startFrameId: number;
  
  // Device/environment
  screenWidth: number;      // CSS pixels
  screenHeight: number;
  devicePixelRatio: number;
  viewport: { width: number; height: number };
  
  // Calibration
  calibrationDistanceMm: number; // Distance from screen (for angle calc)
  calibrationAccuracyPx: number; // Accuracy of calibration
  
  // Sampling strategy
  targetSamplingRateHz: number;  // e.g., 30
  actualAverageSamplingRateHz: number;
  
  // Device info
  userAgent: string;
  platformInfo: string;      // Browser capabilities
}

// Type guards
export function isGazeFrame(obj: any): obj is GazeFrame {
  return (
    typeof obj === 'object' &&
    typeof obj.timestampMs === 'number' &&
    typeof obj.gazeX === 'number' &&
    typeof obj.gazeY === 'number'
  );
}

export function isGazeFrameBatch(obj: any): obj is GazeFrameBatch {
  return (
    typeof obj === 'object' &&
    Array.isArray(obj.frames) &&
    obj.frames.every(isGazeFrame)
  );
}
