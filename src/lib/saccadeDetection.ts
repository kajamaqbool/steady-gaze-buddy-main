/**
 * Saccade detection algorithm
 * Identifies rapid eye movements between fixations
 */

import type {
  SmoothedGazePoint,
  Saccade,
  GazeProcessingConfig,
  Fixation,
} from "@/types/gazeProcessing";
import { getSaccadeDirection } from "@/lib/gazeProcessing";

export class SaccadeDetector {
  private readonly config: GazeProcessingConfig;
  private saccades: Saccade[] = [];
  private currentSaccadePoints: Array<{
    x: number;
    y: number;
    timestamp: number;
    velocity: number;
  }> = [];
  private saccadeIndex = 0;
  private inSaccade = false;

  constructor(config: GazeProcessingConfig) {
    this.config = config;
  }

  /**
   * Process a gaze point and detect saccades
   */
  processPoints(
    previousPoint: SmoothedGazePoint,
    currentPoint: SmoothedGazePoint
  ): Saccade | null {
    // Check if this is a high-velocity event (potential saccade start)
    const isHighVelocity =
      currentPoint.velocity >= this.config.saccadeVelocityThreshold;

    if (!this.inSaccade && isHighVelocity) {
      // Start new saccade
      this.inSaccade = true;
      this.currentSaccadePoints = [
        {
          x: previousPoint.gazeX,
          y: previousPoint.gazeY,
          timestamp: previousPoint.timestamp,
          velocity: previousPoint.velocity,
        },
        {
          x: currentPoint.gazeX,
          y: currentPoint.gazeY,
          timestamp: currentPoint.timestamp,
          velocity: currentPoint.velocity,
        },
      ];
      return null;
    }

    if (this.inSaccade) {
      this.currentSaccadePoints.push({
        x: currentPoint.gazeX,
        y: currentPoint.gazeY,
        timestamp: currentPoint.timestamp,
        velocity: currentPoint.velocity,
      });

      // Check if saccade ended (velocity dropped)
      if (currentPoint.velocity < this.config.saccadeVelocityThreshold * 0.5) {
        this.inSaccade = false;
        const saccade = this.createSaccade();

        if (saccade && this.isValidSaccade(saccade)) {
          this.saccades.push(saccade);
          this.currentSaccadePoints = [];
          return saccade;
        }

        this.currentSaccadePoints = [];
        return null;
      }
    }

    return null;
  }

  /**
   * Alternative: Create saccades from fixation transitions
   * Can be more reliable for low-FPS data
   */
  detectFromFixations(fixations: Fixation[]): Saccade[] {
    const saccades: Saccade[] = [];

    for (let i = 1; i < fixations.length; i++) {
      const from = fixations[i - 1];
      const to = fixations[i];

      const amplitude = Math.sqrt(
        (to.gazeX - from.gazeX) ** 2 + (to.gazeY - from.gazeY) ** 2
      );
      
      const saccadeDuration = to.startTime - from.endTime;
      
      // If gap is small, assume saccade
      if (saccadeDuration < 100 && amplitude > this.config.saccadeAmplitudeThreshold) {
        const peakVelocity = amplitude / Math.max(1, saccadeDuration);

        saccades.push({
          id: `sac_${this.saccadeIndex++}`,
          startTime: from.endTime,
          endTime: to.startTime,
          duration: saccadeDuration,
          startGazeX: from.gazeX,
          startGazeY: from.gazeY,
          endGazeX: to.gazeX,
          endGazeY: to.gazeY,
          amplitude,
          peakVelocity,
          direction: getSaccadeDirection(
            from.gazeX,
            from.gazeY,
            to.gazeX,
            to.gazeY
          ),
        });
      }
    }

    this.saccades = saccades;
    return saccades;
  }

  /**
   * Get all detected saccades
   */
  getSaccades(): Saccade[] {
    return this.saccades;
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.saccades = [];
    this.currentSaccadePoints = [];
    this.inSaccade = false;
    this.saccadeIndex = 0;
  }

  // ========== PRIVATE METHODS ==========

  private createSaccade(): Saccade | null {
    if (this.currentSaccadePoints.length < 2) {
      return null;
    }

    const points = this.currentSaccadePoints;
    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    const amplitude = Math.sqrt(
      (endPoint.x - startPoint.x) ** 2 +
        (endPoint.y - startPoint.y) ** 2
    );

    const duration = endPoint.timestamp - startPoint.timestamp;
    
    // Peak velocity from all points in saccade
    const peakVelocity = Math.max(...points.map(p => p.velocity));

    return {
      id: `sac_${this.saccadeIndex++}`,
      startTime: startPoint.timestamp,
      endTime: endPoint.timestamp,
      duration,
      startGazeX: startPoint.x,
      startGazeY: startPoint.y,
      endGazeX: endPoint.x,
      endGazeY: endPoint.y,
      amplitude,
      peakVelocity,
      direction: getSaccadeDirection(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
      ),
    };
  }

  /**
   * Validate saccade meets clinical criteria
   */
  private isValidSaccade(saccade: Saccade): boolean {
    const tooShort = saccade.duration < this.config.minSaccadeDuration;
    const tooSmall = saccade.amplitude < this.config.saccadeAmplitudeThreshold;
    const tooSlow = saccade.peakVelocity < this.config.saccadeVelocityThreshold;

    if (tooShort || tooSmall || tooSlow) {
      console.debug(
        `Invalid saccade: duration=${saccade.duration}ms (${tooShort}), amplitude=${saccade.amplitude}px (${tooSmall}), velocity=${saccade.peakVelocity}px/ms (${tooSlow})`
      );
      return false;
    }

    return true;
  }
}
