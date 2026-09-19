import type { GazeDataPoint } from "@/types/gaze";

// --- Types ---

export interface Fixation {
  startTime: number;
  endTime: number;
  duration: number;
  centerX: number;
  centerY: number;
  word: string;
  pointCount: number;
}

export interface Saccade {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distance: number;
  direction: "forward" | "backward";
}

export interface ExtractedFeatures {
  avgFixationDuration: number;   // f1 (ms)
  regressionRate: number;        // f2 (%)
  saccadeCount: number;          // f3
  readingSpeed: number;          // f4 (WPM)
  verticalStability: number;     // f5 (px std-dev)
  maxFixationDuration: number;   // f6 (ms)
  skippedWordRate: number;       // f7 (%)
}

export type FeatureStatus = "normal" | "concern";

export interface FeatureAnalysisItem {
  value: number;
  status: FeatureStatus;
  normalRange: string;
  description: string;
  label: string;
  unit: string;
}

export type FeatureAnalysis = Record<keyof ExtractedFeatures, FeatureAnalysisItem>;

export interface FullAnalysis {
  sessionId: string;
  timestamp: string;
  duration: number;
  gazePointsCollected: number;
  faceDetectedPercent: number;
  avgConfidence: number;
  features: ExtractedFeatures;
  analysis: FeatureAnalysis;
  fixations: Fixation[];
  saccades: Saccade[];
  regressions: Saccade[];
}

// --- Constants ---

const SPATIAL_THRESHOLD = 0.03; // normalized (≈50px on a 1600px screen)
const TEMPORAL_THRESHOLD = 100; // ms

// --- Helpers ---

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(avg(arr.map((v) => (v - mean) ** 2)));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// --- Detection algorithms ---

export function detectFixations(gazeData: GazeDataPoint[]): Fixation[] {
  if (gazeData.length === 0) return [];

  const validPoints = gazeData.filter((p) => p.faceDetected);
  if (validPoints.length === 0) return [];

  const fixations: Fixation[] = [];

  let startTime = validPoints[0].timestamp;
  let points = [validPoints[0]];
  let cx = validPoints[0].gazeX;
  let cy = validPoints[0].gazeY;

  for (let i = 1; i < validPoints.length; i++) {
    const p = validPoints[i];
    const d = dist(p.gazeX, p.gazeY, cx, cy);

    if (d < SPATIAL_THRESHOLD) {
      points.push(p);
      cx = avg(points.map((pt) => pt.gazeX));
      cy = avg(points.map((pt) => pt.gazeY));
    } else {
      const duration = points[points.length - 1].timestamp - startTime;
      if (duration >= TEMPORAL_THRESHOLD) {
        fixations.push({
          startTime,
          endTime: points[points.length - 1].timestamp,
          duration,
          centerX: cx,
          centerY: cy,
          word: points[0].currentWord || "",
          pointCount: points.length,
        });
      }
      startTime = p.timestamp;
      points = [p];
      cx = p.gazeX;
      cy = p.gazeY;
    }
  }

  // Flush last fixation
  const lastDuration = points[points.length - 1].timestamp - startTime;
  if (lastDuration >= TEMPORAL_THRESHOLD) {
    fixations.push({
      startTime,
      endTime: points[points.length - 1].timestamp,
      duration: lastDuration,
      centerX: cx,
      centerY: cy,
      word: points[0].currentWord || "",
      pointCount: points.length,
    });
  }

  return fixations;
}

export function detectSaccades(fixations: Fixation[]): Saccade[] {
  const saccades: Saccade[] = [];
  for (let i = 1; i < fixations.length; i++) {
    const from = fixations[i - 1];
    const to = fixations[i];
    const d = dist(from.centerX, from.centerY, to.centerX, to.centerY);

    if (d > SPATIAL_THRESHOLD) {
      saccades.push({
        fromX: from.centerX,
        fromY: from.centerY,
        toX: to.centerX,
        toY: to.centerY,
        distance: d,
        direction: to.centerX < from.centerX ? "backward" : "forward",
      });
    }
  }
  return saccades;
}

export function detectRegressions(saccades: Saccade[]): Saccade[] {
  return saccades.filter((s) => s.direction === "backward");
}

// --- Feature extraction ---

export function extractFeatures(
  gazeData: GazeDataPoint[],
  durationSec: number = 60,
  storyWordCount: number = 107
): ExtractedFeatures {
  const fixations = detectFixations(gazeData);
  const saccades = detectSaccades(fixations);
  const regressions = detectRegressions(saccades);

  const durations = fixations.map((f) => f.duration);

  // Unique words fixated
  const fixatedWords = new Set(fixations.map((f) => f.word).filter(Boolean));
  const wordsSkipped = Math.max(0, storyWordCount - fixatedWords.size);

  return {
    avgFixationDuration: avg(durations),
    regressionRate: fixations.length > 0 ? (regressions.length / fixations.length) * 100 : 0,
    saccadeCount: saccades.length,
    readingSpeed: (fixatedWords.size / durationSec) * 60,
    verticalStability: stdDev(gazeData.filter((p) => p.faceDetected).map((p) => p.gazeY)) * 1000, // scale for readability
    maxFixationDuration: durations.length > 0 ? Math.max(...durations) : 0,
    skippedWordRate: storyWordCount > 0 ? (wordsSkipped / storyWordCount) * 100 : 0,
  };
}

// --- Validation ---

export function analyzeFeatures(features: ExtractedFeatures): FeatureAnalysis {
  const meta: Record<
    keyof ExtractedFeatures,
    { label: string; unit: string; normalRange: string; description: string; dyslexiaCheck: (v: number) => boolean }
  > = {
    avgFixationDuration: {
      label: "Avg Fixation Duration",
      unit: "ms",
      normalRange: "200–250 ms",
      description: "How long eyes rest on each word",
      dyslexiaCheck: (v) => v > 300,
    },
    regressionRate: {
      label: "Regression Rate",
      unit: "%",
      normalRange: "10–15%",
      description: "How often eyes move backward",
      dyslexiaCheck: (v) => v > 20,
    },
    saccadeCount: {
      label: "Saccade Count",
      unit: "",
      normalRange: "30–40",
      description: "Number of rapid eye jumps",
      dyslexiaCheck: (v) => v > 50,
    },
    readingSpeed: {
      label: "Reading Speed",
      unit: "WPM",
      normalRange: "200–300 WPM",
      description: "Estimated words per minute",
      dyslexiaCheck: (v) => v < 150,
    },
    verticalStability: {
      label: "Vertical Stability",
      unit: "px",
      normalRange: "< 15 px",
      description: "How stable eyes stay on the line",
      dyslexiaCheck: (v) => v > 30,
    },
    maxFixationDuration: {
      label: "Max Fixation Duration",
      unit: "ms",
      normalRange: "< 320 ms",
      description: "Longest single fixation",
      dyslexiaCheck: (v) => v > 450,
    },
    skippedWordRate: {
      label: "Skipped Word Rate",
      unit: "%",
      normalRange: "< 5%",
      description: "Percentage of words not fixated on",
      dyslexiaCheck: (v) => v > 15,
    },
  };

  const analysis = {} as FeatureAnalysis;
  for (const key of Object.keys(meta) as (keyof ExtractedFeatures)[]) {
    const m = meta[key];
    analysis[key] = {
      value: features[key],
      status: m.dyslexiaCheck(features[key]) ? "concern" : "normal",
      normalRange: m.normalRange,
      description: m.description,
      label: m.label,
      unit: m.unit,
    };
  }
  return analysis;
}

// --- Full pipeline ---

export function runFullAnalysis(
  gazeData: GazeDataPoint[],
  durationSec: number = 60,
  storyWordCount: number = 107
): FullAnalysis {
  const features = extractFeatures(gazeData, durationSec, storyWordCount);
  const analysis = analyzeFeatures(features);
  const fixations = detectFixations(gazeData);
  const saccades = detectSaccades(fixations);
  const regressions = detectRegressions(saccades);

  const facePoints = gazeData.filter((p) => p.faceDetected);

  return {
    sessionId: uuid(),
    timestamp: new Date().toISOString(),
    duration: durationSec,
    gazePointsCollected: gazeData.length,
    faceDetectedPercent: gazeData.length > 0 ? (facePoints.length / gazeData.length) * 100 : 0,
    avgConfidence: avg(facePoints.map((p) => p.confidence)),
    features,
    analysis,
    fixations,
    saccades,
    regressions,
  };
}
