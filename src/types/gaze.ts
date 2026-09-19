export interface GazeDataPoint {
  timestamp: number;
  gazeX: number;
  gazeY: number;
  leftIrisX: number;
  leftIrisY: number;
  rightIrisX: number;
  rightIrisY: number;
  textScrollOffset: number;
  currentWord: string;
  faceDetected: boolean;
  confidence: number;
  gameId?: string;
  constructId?: string;
  itemId?: string;
  stageId?: "word-hunt" | "line-racer" | "syllable-pop" | "story-builder";
  phase?: "practice" | "assessment";
}

import type { AdventureSession } from "@/adventure/types";

export interface SpeechCaptureRecord {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  mimeType: string;
}

export interface SessionData {
  startTime: number;
  endTime: number;
  gazePoints: GazeDataPoint[];
  totalPointsTarget: number;
  duration: number;
  miniGames?: AdventureSession[];
  speechCaptures?: SpeechCaptureRecord[];
}
