/**
 * PHASE 5: Session Metadata Types and Management
 * 
 * Comprehensive session-level data structures:
 * - Device information
 * - Screen resolution and calibration
 * - Session timing
 * - Raw frame data bundling
 * 
 * Ready for backend transmission
 */

import type { GazeFrame } from "@/types/gazeFrame";
import type { Fixation, Saccade, Regression, ExtractedMetrics } from "@/lib/featureExtractionPhase3";

// ============================================================================
// DEVICE & ENVIRONMENT METADATA
// ============================================================================

export interface DeviceInfo {
  userAgent: string;
  platformInfo: string;
  isTouch: boolean;
  hasWebGL: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
}

export function captureDeviceInfo(): DeviceInfo {
  // Compute isTouch capability
  const isTouch = (() => {
    try {
      return (
        matchMedia("(pointer:coarse)").matches ||
        navigator.maxTouchPoints > 0
      );
    } catch {
      return false;
    }
  })();

  // Compute WebGL support
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      return false;
    }
  })();

  return {
    userAgent: navigator.userAgent,
    // eslint-disable-next-line deprecation/deprecation
    platformInfo: (navigator.platform as unknown as string) || "Unknown",
    isTouch,
    hasWebGL,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemoryGb: (navigator as any).deviceMemory ?? 0,
  };
}

// ============================================================================
// SCREEN & CALIBRATION
// ============================================================================

export interface ScreenInfo {
  widthPx: number;          // CSS pixels
  heightPx: number;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  colorDepth: number;
  pixelDepth: number;
}

export function captureScreenInfo(): ScreenInfo {
  return {
    widthPx: window.innerWidth,
    heightPx: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.visualViewport?.width ?? window.innerWidth,
    viewportHeight: window.visualViewport?.height ?? window.innerHeight,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
  };
}

export interface CalibrationData {
  pointsUsed: number;       // Number of calibration points
  offsetX: number;          // Normalized offset
  offsetY: number;
  accuracy: number;         // Estimated accuracy (pixels)
  timestampMs: number;      // When calibration was completed
}

// ============================================================================
// SESSION METADATA
// ============================================================================

export interface SessionMetadata {
  // Session identity
  sessionId: string;        // Unique identifier
  sessionName?: string;     // Human-readable name
  purpose?: string;         // e.g., "reading_test_dyslexia_screening"
  
  // Timing
  startTimeMs: number;      // Date.now()
  endTimeMs: number;
  durationSec: number;
  
  // Frames
  frameCount: number;
  droppedFrameCount: number;
  averageSamplingRateHz: number;
  
  // Device & Environment
  device: DeviceInfo;
  screen: ScreenInfo;
  
  // Calibration
  calibration: CalibrationData;
  
  // Task context (optional)
  taskType?: "reading" | "visual_tracking" | "calibration" | "test";
  textContent?: string;     // Content read (optional)
  textWordCount?: number;   // Total words in content
}

// ============================================================================
// SESSION DATA PACKET (For Backend Transmission)
// ============================================================================

export interface GazeSessionData {
  // Metadata
  metadata: SessionMetadata;
  
  // Raw gaze frames
  gazeFrames: GazeFrame[];
  
  // Extracted features
  features: {
    fixations: Fixation[];
    saccades: Saccade[];
    regressions: Regression[];
    metrics: ExtractedMetrics;
  };
  
  // Quality assessment
  quality: {
    isValid: boolean;
    qualityScore: number;    // 0-100
    issues: string[];        // Identified problems
  };
}

// ============================================================================
// SESSION BUILDER / MANAGER
// ============================================================================

export class GazeSessionBuilder {
  private readonly sessionId: string;
  private sessionName?: string;
  private purpose?: string;
  private readonly startTimeMs: number;
  private endTimeMs: number = 0;
  private readonly gazeFrames: GazeFrame[] = [];
  private taskType: "reading" | "visual_tracking" | "calibration" | "test" = "reading";
  private textContent?: string;
  private calibration: CalibrationData = {
    pointsUsed: 0,
    offsetX: 0,
    offsetY: 0,
    accuracy: 0,
    timestampMs: 0,
  };

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.startTimeMs = Date.now();
  }

  /**
   * Set session metadata
   */
  setSessionInfo(name: string, purpose?: string, taskType?: typeof this.taskType): this {
    this.sessionName = name;
    this.purpose = purpose;
    if (taskType) this.taskType = taskType;
    return this;
  }

  /**
   * Add gaze frames from capture
   */
  addGazeFrames(frames: GazeFrame[]): this {
    this.gazeFrames.push(...frames);
    return this;
  }

  /**
   * Set calibration info
   */
  setCalibration(calibration: Partial<CalibrationData>): this {
    this.calibration = { ...this.calibration, ...calibration };
    return this;
  }

  /**
   * Set reading task content
   */
  setTaskContent(text: string): this {
    this.textContent = text;
    return this;
  }

  /**
   * Finalize and build session
   */
  build(): GazeSessionData {
    this.endTimeMs = Date.now();

    const durationSec = (this.endTimeMs - this.startTimeMs) / 1000;
    const droppedFrames = Math.max(0, Math.round(durationSec * 30) - this.gazeFrames.length);

    const metadata: SessionMetadata = {
      sessionId: this.sessionId,
      sessionName: this.sessionName,
      purpose: this.purpose,
      startTimeMs: this.startTimeMs,
      endTimeMs: this.endTimeMs,
      durationSec,
      frameCount: this.gazeFrames.length,
      droppedFrameCount: droppedFrames,
      averageSamplingRateHz:
        durationSec > 0 ? this.gazeFrames.length / durationSec : 0,
      device: captureDeviceInfo(),
      screen: captureScreenInfo(),
      calibration: this.calibration,
      taskType: this.taskType,
      textContent: this.textContent ? this.textContent.substring(0, 500) : undefined,
      textWordCount: this.textContent
        ? this.textContent.split(/\s+/).length
        : undefined,
    };

    return {
      metadata,
      gazeFrames: this.gazeFrames,
      features: {
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
      },
      quality: {
        isValid: this.gazeFrames.length > 100,
        qualityScore: this.estimateQualityScore(),
        issues: this.identifyQualityIssues(),
      },
    };
  }

  /**
   * Estimate quality score based on frame count and metrics
   */
  private estimateQualityScore(): number {
    if (this.gazeFrames.length === 0) return 0;

    let score = 100;

    // Check face detection rate
    const faceDetectedCount = this.gazeFrames.filter((f) => f.faceDetected).length;
    const faceDetectionRate = faceDetectedCount / this.gazeFrames.length;

    if (faceDetectionRate < 0.7) {
      score -= (1 -faceDetectionRate) * 50;
    }

    // Check confidence
    const avgConfidence = this.gazeFrames.reduce((sum, f) => sum + f.confidence, 0) / this.gazeFrames.length;

    if (avgConfidence < 0.7) {
      score -= (1 - avgConfidence / 0.7) * 30;
    }

    // Check velocity extremes
    const velocities = this.gazeFrames.map((f) => f.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);

    if (maxVelocity > 2.0 && avgVelocity > 0.5) {
      // High noise
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Identify specific quality issues
   */
  private identifyQualityIssues(): string[] {
    const issues: string[] = [];

    if (this.gazeFrames.length < 100) {
      issues.push("Low frame count (<100)");
    }

    const faceDetectionRate = this.gazeFrames.filter((f) => f.faceDetected).length / this.gazeFrames.length;

    if (faceDetectionRate < 0.7) {
      issues.push(`Low face detection rate (${(faceDetectionRate * 100).toFixed(0)}%)`);
    }

    const avgConfidence = this.gazeFrames.reduce((sum, f) => sum + f.confidence, 0) / this.gazeFrames.length;

    if (avgConfidence < 0.7) {
      issues.push(`Low average confidence (${(avgConfidence * 100).toFixed(0)}%)`);
    }

    const velocities = this.gazeFrames.map((f) => f.velocity);
    const maxVelocity = Math.max(...velocities);

    if (maxVelocity > 2.0) {
      issues.push("High velocity peaks (potential noise)");
    }

    return issues;
  }
}

// ============================================================================
// SESSION STORAGE (Local/IndexedDB)
// ============================================================================

/**
 * Store session data for offline access or batch processing
 */
export class SessionStorage {
  private readonly storageKey = "gaze_sessions";

  /**
   * Save session to localStorage (caution: size limited)
   */
  saveToLocalStorage(session: GazeSessionData): boolean {
    try {
      const sessions = this.loadAllFromLocalStorage();
      sessions.push(session);

      const data = JSON.stringify(sessions);
      localStorage.setItem(this.storageKey, data);
      return true;
    } catch (err) {
      console.error("Failed to save session:", err);
      return false;
    }
  }

  /**
   * Load all sessions from localStorage
   */
  loadAllFromLocalStorage(): GazeSessionData[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Load specific session
   */
  loadSessionFromLocalStorage(sessionId: string): GazeSessionData | null {
    const sessions = this.loadAllFromLocalStorage();
    return sessions.find((s) => s.metadata.sessionId === sessionId) || null;
  }

  /**
   * Clear all sessions
   */
  clearLocalStorage(): void {
    localStorage.removeItem(this.storageKey);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported in their interface definitions above
