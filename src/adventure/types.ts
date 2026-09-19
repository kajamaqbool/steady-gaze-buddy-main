export type AdventurePhase = "practice" | "assessment";
export type AdventureStageId = "word-hunt" | "line-racer" | "syllable-pop" | "story-builder";

export interface AdventureStageConfig {
  id: AdventureStageId;
  label: string;
  enabled: boolean;
}

export interface AdventureConfig {
  id: string;
  title: string;
  constructId: string;
  durationSeconds: number;
  activityType: "reading";
  instruction: string;
  prompt: string;
  items: string[];
  stages: AdventureStageConfig[];
}

export interface AdventureEvent {
  type:
    | "adventure.started"
    | "adventure.instructions_shown"
    | "adventure.stage_started"
    | "adventure.item_presented"
    | "adventure.response"
    | "adventure.item_completed"
    | "adventure.stage_completed"
    | "adventure.interaction"
    | "adventure.paused"
    | "adventure.resumed"
    | "adventure.completed"
    | "adventure.interrupted";
  sessionId?: string;
  gameId: string;
  stageId?: AdventureStageId;
  constructId: string;
  itemId?: string;
  phase: AdventurePhase;
  timestamp: number;
  value?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AdventureSession {
  gameId: string;
  constructId: string;
  startedAt: number;
  completedAt?: number;
  events: AdventureEvent[];
  responses: Array<{ itemId: string; value: string; timestamp: number; phase: AdventurePhase }>;
  signals: {
    gazePointCount: number;
    faceDetectedCount: number;
  };
}
