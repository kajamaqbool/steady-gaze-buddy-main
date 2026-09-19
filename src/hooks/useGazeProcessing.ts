/**
 * Complete Gaze Processing Pipeline Hook
 * Orchestrates: smoothing, interpolation, detection, validation
 * Produces stable, clinically-validated gaze data
 */

import { useCallback, useRef, useState } from "react";
import type { GazeDataPoint } from "@/types/gaze";

// Import all pipeline modules
import { smoothAndInterpolateGaze, removeOutliers, clampExtremeJumps, type SmoothedFrame } from "@/lib/gazeSmoothing";
import { extractHeadPose, normalizeGazeToFaceSpace, smoothHeadPose, isHeadUnstable, type HeadPose } from "@/lib/headNormalization";
import { detectFixationsComplete, type Fixation } from "@/lib/fixationDetectionEnhanced";
import { detectSaccadesFromFixations, isSaccadePatternRealistic, type Saccade } from "@/lib/saccadeDetectionEnhanced";
import { assessSessionQuality, type SessionQuality, CLINICAL_THRESHOLDS } from "@/lib/sessionValidation";

export interface ProcessedGazeData {
  raw: GazeDataPoint[];
  smoothed: SmoothedFrame[];
  fixations: Fixation[];
  saccades: Saccade[];
  quality: SessionQuality;
  headPoses: HeadPose[];
}

export interface UseGazeProcessingOptions {
  smoothingWindow?: number;
  targetFps?: number;
  inputFps?: number;
  enableHeadNormalization?: boolean;
  totalWords?: number;
  debug?: boolean;
}

export function useGazeProcessing(options: UseGazeProcessingOptions = {}) {
  const {
    smoothingWindow = 3,
    targetFps = 20,
    inputFps = 5,
    enableHeadNormalization = true,
    totalWords = 100,
    debug = false,
  } = options;

  // State
  const [processedData, setProcessedData] = useState<ProcessedGazeData | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Refs for tracking
  const rawPointsRef = useRef<GazeDataPoint[]>([]);
  const headPosesRef = useRef<HeadPose[]>([]);

  /**
   * Process raw gaze point with all pipeline stages
   */
  const processRawGazePoint = useCallback(
    (
      gazePoint: GazeDataPoint,
      faceMeshKeypoints?: any[]
    ): SmoothedFrame | null => {
      try {
        if (!gazePoint.faceDetected) {
          setProcessingError("Face not detected");
          return null;
        }

        // 1. Store raw point
        rawPointsRef.current.push(gazePoint);

        // 2. Extract and smooth head pose if keypoints available
        let normalizedX = gazePoint.gazeX;
        let normalizedY = gazePoint.gazeY;

        if (enableHeadNormalization && faceMeshKeypoints) {
          const headPose = extractHeadPose(faceMeshKeypoints);
          headPosesRef.current.push(headPose);

          // Smooth head motion
          const smoothedPose = smoothHeadPose(headPosesRef.current);

          // Normalize gaze to face space
          const normalized = normalizeGazeToFaceSpace(gazePoint.gazeX, gazePoint.gazeY, smoothedPose);
          normalizedX = normalized.x;
          normalizedY = normalized.y;

          if (debug && isHeadUnstable(headPosesRef.current)) {
            console.warn("⚠️ Head is unstable - gaze quality may be affected");
          }
        }

        const smoothedFrame: SmoothedFrame = {
          timestamp: gazePoint.timestamp,
          gazeX: normalizedX,
          gazeY: normalizedY,
          confidence: gazePoint.confidence,
          faceDetected: true,
        };

        setProcessingError(null);
        return smoothedFrame;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error processing gaze";
        setProcessingError(message);
        if (debug) console.error("Gaze processing error:", message);
        return null;
      }
    },
    [enableHeadNormalization, debug]
  );

  /**
   * Perform all smoothing and preprocessing steps
   */
  const performPreprocessing = useCallback(
    (convertedFrames: SmoothedFrame[]): SmoothedFrame[] => {
      let smoothed = smoothAndInterpolateGaze(
        convertedFrames,
        3, // smoothing window
        targetFps,
        inputFps
      );

      if (debug) {
        console.log(`✓ After smoothing + interpolation: ${smoothed.length} points`);
      }

      smoothed = removeOutliers(smoothed);
      smoothed = clampExtremeJumps(smoothed);

      if (debug) {
        console.log(`✓ After outlier removal & clamping: ${smoothed.length} points`);
      }

      return smoothed;
    },
    [targetFps, inputFps, debug]
  );

  /**
   * Perform fixation and saccade detection
   */
  const performDetection = useCallback(
    (
      rawPoints: GazeDataPoint[],
      smoothed: SmoothedFrame[]
    ): { fixations: Fixation[]; saccades: Saccade[] } => {
      const fixations = detectFixationsComplete(
        rawPoints.map((p) => ({
          timestamp: p.timestamp,
          gazeX: p.gazeX,
          gazeY: p.gazeY,
          faceDetected: p.faceDetected,
          word: p.currentWord,
        }))
      );

      if (debug) {
        console.log(`✓ Detected ${fixations.length} fixations`);
      }

      const saccades = detectSaccadesFromFixations(fixations);

      if (debug) {
        console.log(`✓ Detected ${saccades.length} saccades`);
      }

      return { fixations, saccades };
    },
    [debug]
  );

  /**
   * Perform validation
   */
  const performValidation = useCallback(
    (
      fixations: Fixation[],
      saccades: Saccade[],
      durationSecs: number
    ): SessionQuality => {
      const quality = assessSessionQuality(
        rawPointsRef.current,
        fixations,
        saccades,
        totalWords,
        CLINICAL_THRESHOLDS
      );

      if (debug) {
        console.log(
          `✓ Quality assessment: ${quality.overallScore}/100 - ${quality.isValid ? "VALID" : "INVALID"}`
        );
        if (quality.failureReasons.length > 0) {
          console.warn("Session issues:", quality.failureReasons);
        }
      }

      const patternRealistic = isSaccadePatternRealistic(saccades, durationSecs);

      if (debug && !patternRealistic) {
        console.warn("⚠️ Saccade pattern unrealistic - may indicate poor tracking");
      }

      return quality;
    },
    [totalWords, debug]
  );

  /**
   * Finalize session and run full validation
   */
  const finalizeSession = useCallback((): ProcessedGazeData | null => {
    try {
      if (rawPointsRef.current.length === 0) {
        throw new Error("No gaze data collected");
      }

      if (debug) {
        console.log(`📊 Finalizing session with ${rawPointsRef.current.length} raw points`);
      }

      // Convert to SmoothedFrame format
      const convertedFrames: SmoothedFrame[] = rawPointsRef.current.map((p) => ({
        timestamp: p.timestamp,
        gazeX: p.gazeX,
        gazeY: p.gazeY,
        confidence: p.confidence,
        faceDetected: p.faceDetected,
      }));

      // Step 1: Preprocessing
      const smoothed = performPreprocessing(convertedFrames);

      // Step 2: Detection
      const { fixations, saccades } = performDetection(rawPointsRef.current, smoothed);

      // Step 3: Validation
      const sessionDuration = (rawPointsRef.current[rawPointsRef.current.length - 1].timestamp - rawPointsRef.current[0].timestamp) / 1000;
      const quality = performValidation(fixations, saccades, sessionDuration);

      // Return complete result
      const result: ProcessedGazeData = {
        raw: rawPointsRef.current,
        smoothed,
        fixations,
        saccades,
        quality,
        headPoses: headPosesRef.current,
      };

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session finalization failed";
      setProcessingError(message);
      if (debug) console.error("Session finalization error:", message);
      return null;
    }
  }, [performPreprocessing, performDetection, performValidation, debug]);

  /**
   * Reset all tracking state for new session
   */
  const resetSession = useCallback(() => {
    rawPointsRef.current = [];
    headPosesRef.current = [];
    setProcessedData(null);
    setProcessingError(null);
  }, []);

  /**
   * Get current session status
   */
  const getSessionStatus = useCallback(() => {
    const pointCount = rawPointsRef.current.length;
    const duration = pointCount > 1 
      ? (rawPointsRef.current[pointCount - 1].timestamp - rawPointsRef.current[0].timestamp) / 1000
      : 0;

    return {
      pointCount,
      duration,
      headPoseCount: headPosesRef.current.length,
      hasError: processingError !== null,
      errorMessage: processingError,
    };
  }, [processingError]);

  return {
    processRawGazePoint,
    finalizeSession,
    resetSession,
    getSessionStatus,
    processedData,
    processingError,
  };
}

/**
 * Debug visualization data provider
 * Returns data suitable for visualizing gaze trail, fixations, etc.
 */
export function useGazeDebugVisualization(processedData: ProcessedGazeData | null) {
  return {
    // Gaze trail (smoothed trajectory)
    gazeTrail: processedData?.smoothed || [],

    // Fixation centers and sizes
    fixations: processedData?.fixations.map((f) => ({
      x: f.centerX,
      y: f.centerY,
      radius: Math.sqrt(f.duration) * 2, // Size proportional to duration
      duration: f.duration,
      word: f.word,
    })) || [],

    // Saccade paths
    saccades: processedData?.saccades || [],

    // Head position over time
    headPositions: processedData?.headPoses.map((p) => ({
      x: p.headCenterX,
      y: p.headCenterY,
      pitch: p.pitch,
      yaw: p.yaw,
    })) || [],

    // Session quality status
    qualityScore: processedData?.quality.overallScore || 0,
    isValidSession: processedData?.quality.isValid || false,
  };
}
