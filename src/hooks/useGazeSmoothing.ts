/**
 * React hook: Gaze point smoothing and upsampling
 * Converts raw 5Hz gaze → 20Hz smooth trajectory
 */

import { useRef, useCallback } from "react";
import type {
  RawGazePoint,
  SmoothedGazePoint,
  GazeProcessingConfig,
} from "@/types/gazeProcessing";
import { DEFAULT_GAZE_CONFIG } from "@/types/gazeProcessing";
import {
  GazeKalmanFilter,
  upsampleGazeStream,
} from "@/lib/gazeProcessing";

interface UseGazeSmoothingOptions {
  config?: Partial<GazeProcessingConfig>;
  onSmoothed?: (points: SmoothedGazePoint[]) => void;
}

export function useGazeSmoothing(
  options: UseGazeSmoothingOptions = {}
) {
  const config = { ...DEFAULT_GAZE_CONFIG, ...(options.config || {}) };
  
  const filterRef = useRef<GazeKalmanFilter | null>(null);
  const lastPointRef = useRef<SmoothedGazePoint | null>(null);
  const pendingPointsRef = useRef<RawGazePoint[]>([]);

  /**
   * Smooth a single raw gaze point through Kalman filter
   */
  const smoothPoint = useCallback(
    (rawPoint: RawGazePoint): SmoothedGazePoint => {
      // Initialize filter on first point
      if (!filterRef.current) {
        filterRef.current = new GazeKalmanFilter(
          rawPoint.gazeX,
          rawPoint.gazeY,
          config
        );
      }

      // Compute time delta from last point
      const dt = lastPointRef.current
        ? rawPoint.timestamp - lastPointRef.current.timestamp
        : 33; // ~30ms default

      // Update filter
      filterRef.current.update(rawPoint.gazeX, rawPoint.gazeY, dt);

      // Get filtered state with velocity
      const filtered = filterRef.current.getState();
      filtered.timestamp = rawPoint.timestamp;
      filtered.confidence = Math.min(rawPoint.confidence, filtered.confidence);
      filtered.faceDetected = rawPoint.faceDetected;

      lastPointRef.current = filtered;
      return filtered;
    },
    [config]
  );

  /**
   * Process a batch of raw gaze points
   * Upsamples then smoothes
   */
  const processBatch = useCallback(
    (rawPoints: RawGazePoint[]): SmoothedGazePoint[] => {
      if (rawPoints.length === 0) return [];

      // Upsample to target FPS
      const upsampled = upsampleGazeStream(rawPoints, config.targetFPS);

      // Smooth each point through Kalman filter
      const smoothed = upsampled.map(rawPoint => smoothPoint(rawPoint));

      options.onSmoothed?.(smoothed);
      return smoothed;
    },
    [config.targetFPS, options, smoothPoint]
  );

  /**
   * Process single point (incremental)
   */
  const processPoint = useCallback(
    (rawPoint: RawGazePoint): SmoothedGazePoint | null => {
      // If we haven't gotten enough points yet, buffer them
      pendingPointsRef.current.push(rawPoint);

      // Need at least 2 points to interpolate
      if (pendingPointsRef.current.length < 2) {
        return null;
      }

      // Process batch of pending points
      const smoothed = processBatch(pendingPointsRef.current);
      pendingPointsRef.current = [];

      // Return last smoothed point
      return smoothed.length > 0 ? smoothed[smoothed.length - 1] : null;
    },
    [processBatch]
  );

  /**
   * Reset smoother
   */
  const reset = useCallback(() => {
    filterRef.current = null;
    lastPointRef.current = null;
    pendingPointsRef.current = [];
  }, []);

  return {
    smoothPoint,
    processBatch,
    processPoint,
    reset,
  };
}
