/**
 * Clinical-grade gaze processing types
 * For dyslexia detection via eye tracking
 */

export interface RawGazePoint {
  timestamp: number;
  gazeX: number;
  gazeY: number;
  confidence: number;
  faceDetected: boolean;
}

export interface SmoothedGazePoint extends RawGazePoint {
  velocityX: number;
  velocityY: number;
  velocity: number; // Euclidean
}

export interface WorldGazePoint extends SmoothedGazePoint {
  headX: number;
  headY: number;
  faceRelativeGazeX: number;
  faceRelativeGazeY: number;
}

export interface Fixation {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  gazeX: number; // Center of fixation
  gazeY: number;
  wordId?: string;
  wordText?: string;
  stability: number; // 0-1, lower is more stable
  sampleCount: number;
}

export interface Saccade {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  startGazeX: number;
  startGazeY: number;
  endGazeX: number;
  endGazeY: number;
  amplitude: number; // pixels
  peakVelocity: number; // px/ms
  direction: "forward" | "backward" | "vertical"; // Reading direction classification
}

export interface Regression {
  saccadeId: string;
  fromWord: string;
  toWord: string;
  distance: number;
}

export interface WordBound {
  id: string;
  text: string;
  x: number; // pixel
  y: number;
  width: number;
  height: number;
  textIndex: number; // Position in story
}

export interface SessionQuality {
  trackingConfidence: number; // 0-1, avg confidence
  faceStability: number; // 0-1, how stable face position is
  gazeJitter: number; // px, movement while fixated
  verticalDeviation: number; // px, max vertical movement
  skippedWordRate: number; // 0-1, % words with no fixation
  saccadeCount: number;
  fixationCount: number;
  averageFixationDuration: number; // ms
  isValid: boolean;
  invalidReasons: string[];
}

export interface KalmanState {
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number;
  px: number; // pos uncertainty
  py: number;
  pvx: number; // velocity uncertainty
  pvy: number;
}

export interface GazeProcessingConfig {
  // Upsampling
  targetFPS: number; // 15-30
  
  // Smoothing
  kalmanProcessNoise: number; // 0.001-0.01
  kalmanMeasurementNoise: number; // 0.1-1.0
  movingAverageWindow: number; // 3-5
  
  // Saccade detection
  saccadeVelocityThreshold: number; // px/ms, ~0.5-1.0
  saccadeAmplitudeThreshold: number; // px, ~20-50
  minSaccadeDuration: number; // ms, ~10-20
  
  // Fixation detection
  fixationRadius: number; // px, ~30-50 (dynamic based on DPI)
  fixationMinDuration: number; // ms, ~50
  microFixationMergeDuration: number; // ms, ~80
  
  // Head normalization
  enableHeadNormalization: boolean;
  
  // Validation
  maxVerticalDeviation: number; // px, ~100
  maxSkippedWordRate: number; // 0-1, ~0.4
  minSaccadeCount: number; // ~10
  requiredTrackingConfidence: number; // 0-1, ~0.7
}

export const DEFAULT_GAZE_CONFIG: GazeProcessingConfig = {
  targetFPS: 20,
  kalmanProcessNoise: 0.005,
  kalmanMeasurementNoise: 0.3,
  movingAverageWindow: 3,
  saccadeVelocityThreshold: 0.7,
  saccadeAmplitudeThreshold: 25,
  minSaccadeDuration: 10,
  fixationRadius: 40,
  fixationMinDuration: 50,
  microFixationMergeDuration: 80,
  enableHeadNormalization: true,
  maxVerticalDeviation: 100,
  maxSkippedWordRate: 0.4,
  minSaccadeCount: 10,
  requiredTrackingConfidence: 0.7,
};
