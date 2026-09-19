/**
 * PHASE 5: useSmoothResultUpdate Hook
 * Smooth UI updates without flickering or jank
 * 
 * - Debounces rapid updates
 * - Smooth transitions for value changes
 * - Prevents re-renders on every frame
 * - Only updates on meaningful changes
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { MLResultPayload } from '../api/types';

export interface SmoothResultOptions {
  debounceMs?: number;
  transitionDurationMs?: number;
  onlyOnChange?: boolean; // Only update if result actually changed
}

export interface SmoothResultState {
  current: MLResultPayload | null;
  previous: MLResultPayload | null;
  isUpdating: boolean;
  hasChanged: boolean;
}

/**
 * Hook for smooth result updates
 */
export function useSmoothResultUpdate(
  latestResult: MLResultPayload | null,
  options: SmoothResultOptions = {}
): SmoothResultState {
  const {
    debounceMs = 100, // Debounce rapid updates
    transitionDurationMs = 300, // Smooth transition
    onlyOnChange = true,
  } = options;

  const [state, setState] = useState<SmoothResultState>({
    current: latestResult,
    previous: null,
    isUpdating: false,
    hasChanged: false,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const previousResultRef = useRef<MLResultPayload | null>(null);
  const isUpdatingRef = useRef(false);

  /**
   * Check if result actually changed (not just timestamp)
   */
  const hasResultChanged = useCallback((
    newResult: MLResultPayload | null,
    oldResult: MLResultPayload | null
  ): boolean => {
    if (!newResult && !oldResult) return false;
    if (!newResult || !oldResult) return true;

    // Compare important fields only (ignore timestamp which always changes)
    return (
      newResult.riskLevel !== oldResult.riskLevel ||
      newResult.riskScore !== oldResult.riskScore ||
      newResult.classification !== oldResult.classification ||
      newResult.features.fixationStability !== oldResult.features.fixationStability ||
      newResult.features.saccadePattern !== oldResult.features.saccadePattern ||
      newResult.features.readingSpeed !== oldResult.features.readingSpeed ||
      newResult.features.comprehensionIndex !== oldResult.features.comprehensionIndex ||
      newResult.confidence !== oldResult.confidence
    );
  }, []);

  /**
   * Update state with debouncing
   */
  useEffect(() => {
    // Skip if only checking for changes and nothing changed
    if (onlyOnChange && !hasResultChanged(latestResult, state.current)) {
      return;
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the update
    isUpdatingRef.current = true;
    debounceTimerRef.current = setTimeout(() => {
      setState(prevState => {
        const changed = hasResultChanged(latestResult, prevState.current);

        return {
          current: latestResult,
          previous: prevState.current,
          isUpdating: false,
          hasChanged: changed,
        };
      });

      isUpdatingRef.current = false;
    }, debounceMs);

    // Notify immediately that update is pending
    if (isUpdatingRef.current) {
      setState(prevState => ({
        ...prevState,
        isUpdating: true,
      }));
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [latestResult, debounceMs, onlyOnChange, hasResultChanged, state.current]);

  return state;
}

/**
 * Hook for animated metric transitions
 */
export function useAnimatedMetric(
  value: number,
  duration: number = 300,
  decimals: number = 1
): { displayValue: number; isAnimating: boolean } {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const startValueRef = useRef(value);
  const startTimeRef = useRef<number>();
  const frameIdRef = useRef<number>();

  useEffect(() => {
    if (displayValue === value) return;

    startValueRef.current = displayValue;
    startTimeRef.current = performance.now();
    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - (startTimeRef.current || currentTime);
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-quad)
      const easeProgress = 1 - Math.pow(1 - progress, 2);

      const newValue = startValueRef.current + (value - startValueRef.current) * easeProgress;
      setDisplayValue(parseFloat(newValue.toFixed(decimals)));

      if (progress < 1) {
        frameIdRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        setIsAnimating(false);
      }
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [value, duration, decimals]);

  return { displayValue, isAnimating };
}

/**
 * Hook for animated color transitions based on value
 */
export function useAnimatedColorForValue(
  value: number,
  thresholds: { low: number; moderate: number; high: number } = { low: 33, moderate: 67, high: 100 }
): {
  color: 'green' | 'yellow' | 'red';
  transitionClass: string;
} {
  const [color, setColor] = useState<'green' | 'yellow' | 'red'>('green');

  useEffect(() => {
    if (value <= thresholds.low) {
      setColor('green');
    } else if (value <= thresholds.moderate) {
      setColor('yellow');
    } else {
      setColor('red');
    }
  }, [value, thresholds]);

  const colorMap = {
    green: 'bg-green-500 transition-colors duration-500',
    yellow: 'bg-yellow-500 transition-colors duration-500',
    red: 'bg-red-500 transition-colors duration-500',
  };

  return {
    color,
    transitionClass: colorMap[color],
  };
}

/**
 * Hook for batch result updates to prevent re-render spam
 */
export function useBatchResultUpdates(
  results: MLResultPayload[],
  batchSizeMs: number = 200
): MLResultPayload[] {
  const [batchedResults, setBatchedResults] = useState<MLResultPayload[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();
  const queueRef = useRef<MLResultPayload[]>([]);

  useEffect(() => {
    queueRef.current = results;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      // Take only the latest result from queue
      if (queueRef.current.length > 0) {
        setBatchedResults([queueRef.current[queueRef.current.length - 1]]);
      }
    }, batchSizeMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [results, batchSizeMs]);

  return batchedResults;
}

export default useSmoothResultUpdate;
