/**
 * PHASE 6: useFeaturePublisher Hook
 * Publish detected features (fixation, saccade, etc) to backend
 */

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { stompClient } from '../api/wsClient';
import { useGazeStore } from '../store/gazeStore';
import { FeaturePayloadDto, FeatureType } from '../api/types';

export interface UseFeaturePublisherOptions {
  onPublish?: (feature: FeaturePayloadDto) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for publishing detected gaze features to backend
 * Used when fixations, saccades, or other features are detected
 */
export function useFeaturePublisher({
  onPublish,
  onError,
}: UseFeaturePublisherOptions = {}) {
  const store = useGazeStore();

  /**
   * Publish a single feature
   */
  const publishFeature = useCallback(
    (
      type: FeatureType,
      data: {
        duration: number;
        startX: number;
        startY: number;
        endX?: number;
        endY?: number;
        magnitude?: number;
        peakVelocity?: number;
        metadata?: Record<string, any>;
      }
    ): void => {
      // Guard: connection
      if (!stompClient.isConnected()) {
        console.warn('[useFeaturePublisher] Not connected');
        return;
      }

      // Guard: session
      const sessionId = store.session?.sessionId;
      if (!sessionId) {
        console.warn('[useFeaturePublisher] No active session');
        return;
      }

      const feature: FeaturePayloadDto = {
        featureId: uuidv4(),
        timestamp: Date.now(),
        type,
        duration: data.duration,
        startX: data.startX,
        startY: data.startY,
        endX: data.endX ?? data.startX,
        endY: data.endY ?? data.startY,
        magnitude: data.magnitude,
        peakVelocity: data.peakVelocity,
        metadata: data.metadata,
      };

      try {
        stompClient.publish('/app/gaze.feature', {
          ...feature,
          sessionId,
        });

        store.incrementFeatureCount();
        onPublish?.(feature);

        console.log('[useFeaturePublisher] Published:', type);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        console.error('[useFeaturePublisher] Error:', err);
      }
    },
    [store, onPublish, onError]
  );

  /**
   * Publish a fixation (longer stable gaze)
   */
  const publishFixation = useCallback(
    (options: {
      duration: number;
      x: number;
      y: number;
      metadata?: Record<string, any>;
    }) => {
      publishFeature('FIXATION', {
        duration: options.duration,
        startX: options.x,
        startY: options.y,
        endX: options.x,
        endY: options.y,
        metadata: options.metadata,
      });
    },
    [publishFeature]
  );

  /**
   * Publish a saccade (rapid eye movement)
   */
  const publishSaccade = useCallback(
    (options: {
      duration: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      peakVelocity?: number;
      metadata?: Record<string, any>;
    }) => {
      const deltaX = options.endX - options.startX;
      const deltaY = options.endY - options.startY;
      const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      publishFeature('SACCADE', {
        duration: options.duration,
        startX: options.startX,
        startY: options.startY,
        endX: options.endX,
        endY: options.endY,
        magnitude,
        peakVelocity: options.peakVelocity ?? magnitude / options.duration,
        metadata: options.metadata,
      });
    },
    [publishFeature]
  );

  /**
   * Publish a blink
   */
  const publishBlink = useCallback(
    (options: {
      duration: number;
      x?: number;
      y?: number;
      metadata?: Record<string, any>;
    }) => {
      publishFeature('BLINK', {
        duration: options.duration,
        startX: options.x ?? 0.5,
        startY: options.y ?? 0.5,
        metadata: options.metadata,
      });
    },
    [publishFeature]
  );

  /**
   * Publish a smooth pursuit (tracking moving object)
   */
  const publishSmoothPursuit = useCallback(
    (options: {
      duration: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      avgVelocity?: number;
      metadata?: Record<string, any>;
    }) => {
      publishFeature('SMOOTH_PURSUIT', {
        duration: options.duration,
        startX: options.startX,
        startY: options.startY,
        endX: options.endX,
        endY: options.endY,
        peakVelocity: options.avgVelocity,
        metadata: options.metadata,
      });
    },
    [publishFeature]
  );

  return {
    publishFeature,
    publishFixation,
    publishSaccade,
    publishBlink,
    publishSmoothPursuit,
  };
}

export default useFeaturePublisher;
