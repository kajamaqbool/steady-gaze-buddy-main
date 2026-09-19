/**
 * Enhanced clinically-grade gaze tracking hook
 * Uses the new comprehensive pipeline from useGazeProcessing
 */

import { useGazeProcessing } from "./useGazeProcessing";
import type { SessionQuality } from "@/lib/sessionValidation";

interface UseEnhancedGazeTrackingOptions {
  enabled: boolean;
  totalWords?: number;
  enableHeadNormalization?: boolean;
  debug?: boolean;
  onQualityUpdate?: (quality: SessionQuality) => void;
}

/**
 * Main hook for enhanced gaze tracking
 * Delegates to new useGazeProcessing pipeline
 */
export function useEnhancedGazeTracking(options: UseEnhancedGazeTrackingOptions) {
  const pipeline = useGazeProcessing({
    enableHeadNormalization: options.enableHeadNormalization ?? true,
    totalWords: options.totalWords ?? 100,
    debug: options.debug ?? false,
  });

  return {
    processRawGazePoint: pipeline.processRawGazePoint,
    finalizeSession: pipeline.finalizeSession,
    resetSession: pipeline.resetSession,
    getSessionStatus: pipeline.getSessionStatus,
    
    processedData: pipeline.processedData,
    error: pipeline.processingError,
    quality: pipeline.processedData?.quality || null,
    isSessionValid: pipeline.processedData?.quality.isValid || false,
  };
}
