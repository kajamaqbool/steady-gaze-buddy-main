/**
 * Fixation detection algorithm
 * Clinical-grade fixation identification with micro-fixation merging
 */

import type {
  SmoothedGazePoint,
  Fixation,
  GazeProcessingConfig,
} from "@/types/gazeProcessing";
import { computePointsStability } from "@/lib/gazeProcessing";

export class FixationDetector {
  private readonly config: GazeProcessingConfig;
  private fixations: Fixation[] = [];
  private currentFixationPoints: Array<{
    x: number;
    y: number;
    timestamp: number;
  }> = [];
  private fixationStartTime = 0;
  private fixationIndex = 0;

  constructor(config: GazeProcessingConfig) {
    this.config = config;
  }

  /**
   * Process a gaze point and detect fixations
   * Returns: newly completed fixation (if any)
   */
  processPoint(
    point: SmoothedGazePoint,
    lastFixation?: Fixation
  ): Fixation | null {
    if (!this.currentFixationPoints.length) {
      // Start new potential fixation
      this.currentFixationPoints.push({
        x: point.gazeX,
        y: point.gazeY,
        timestamp: point.timestamp,
      });
      this.fixationStartTime = point.timestamp;
      return null;
    }

    const lastPoint = this.currentFixationPoints[
      this.currentFixationPoints.length - 1
    ];
    const distance = Math.sqrt(
      (point.gazeX - lastPoint.x) ** 2 + (point.gazeY - lastPoint.y) ** 2
    );

    const fixationRadius = this.getAdaptiveFixationRadius();

    // Point is within fixation radius
    if (distance < fixationRadius) {
      this.currentFixationPoints.push({
        x: point.gazeX,
        y: point.gazeY,
        timestamp: point.timestamp,
      });
      return null;
    }

    // Point exceeded fixation radius - possible end of fixation
    const fixationDuration = point.timestamp - this.fixationStartTime;

    // Too short - might be spike or noise
    if (fixationDuration < this.config.fixationMinDuration) {
      // Reset and treat saccade
      this.currentFixationPoints = [
        {
          x: point.gazeX,
          y: point.gazeY,
          timestamp: point.timestamp,
        },
      ];
      this.fixationStartTime = point.timestamp;
      return null;
    }

    // Valid fixation
    const fixation = this.createFixation();
    
    // Check for micro-fixation merging
    if (lastFixation && this.shouldMergeMicroFixation(fixation, lastFixation)) {
      // Merge with previous fixation
      this.fixations[this.fixations.length - 1] = {
        ...lastFixation,
        endTime: fixation.endTime,
        duration: fixation.endTime - lastFixation.startTime,
        sampleCount:
          lastFixation.sampleCount + this.currentFixationPoints.length,
      };
      this.currentFixationPoints = [
        {
          x: point.gazeX,
          y: point.gazeY,
          timestamp: point.timestamp,
        },
      ];
      this.fixationStartTime = point.timestamp;
      return null;
    }

    // Start new fixation
    this.fixations.push(fixation);
    this.currentFixationPoints = [
      {
        x: point.gazeX,
        y: point.gazeY,
        timestamp: point.timestamp,
      },
    ];
    this.fixationStartTime = point.timestamp;

    return fixation;
  }

  /**
   * Finalize any remaining fixation (end of session)
   */
  finalize(): Fixation | null {
    if (
      this.currentFixationPoints.length === 0 ||
      this.currentFixationPoints.length === 1
    ) {
      return null;
    }

    const duration = this.currentFixationPoints[
      this.currentFixationPoints.length - 1
    ].timestamp - this.fixationStartTime;

    if (duration >= this.config.fixationMinDuration) {
      return this.createFixation();
    }

    return null;
  }

  /**
   * Get all detected fixations
   */
  getFixations(): Fixation[] {
    return this.fixations;
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.fixations = [];
    this.currentFixationPoints = [];
    this.fixationStartTime = 0;
    this.fixationIndex = 0;
  }

  // ========== PRIVATE METHODS ==========

  private createFixation(): Fixation {
    const points = this.currentFixationPoints;
    const center = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };

    const startTime = points[0].timestamp;
    const endTime = points[points.length - 1].timestamp;
    const duration = endTime - startTime;

    // Stability = how close points are to center (0-1, lower = more stable)
    const stability = computePointsStability(points);

    return {
      id: `fix_${this.fixationIndex++}`,
      startTime,
      endTime,
      duration,
      gazeX: center.x,
      gazeY: center.y,
      stability,
      sampleCount: points.length,
    };
  }

  /**
   * Get adaptive fixation radius based on screen DPI
   * Higher DPI = smaller radius (more sensitive)
   */
  private getAdaptiveFixationRadius(): number {
    // Default implementation
    // In production, would use window.devicePixelRatio
    const dpi = window.devicePixelRatio || 1;
    
    // At 1x DPI: 40px
    // At 2x DPI: 35px (smaller)
    // At 3x DPI: 30px (even smaller)
    const scaledRadius = this.config.fixationRadius / Math.sqrt(dpi);
    
    return Math.max(20, Math.min(60, scaledRadius));
  }

  /**
   * Check if two fixations should be merged (micro-fixation)
   */
  private shouldMergeMicroFixation(
    f1: Fixation,
    f2: Fixation
  ): boolean {
    // If separation is too short AND positions are close
    const timeSinceLastFixation = f1.startTime - f2.endTime;
    const distanceBetweenFixations = Math.sqrt(
      (f1.gazeX - f2.gazeX) ** 2 + (f1.gazeY - f2.gazeY) ** 2
    );

    const shouldMerge =
      timeSinceLastFixation < this.config.microFixationMergeDuration &&
      distanceBetweenFixations < this.config.fixationRadius;

    if (shouldMerge) {
      console.log(
        `Merging micro-fixations: ${timeSinceLastFixation}ms apart, ${distanceBetweenFixations}px distance`
      );
    }

    return shouldMerge;
  }
}
