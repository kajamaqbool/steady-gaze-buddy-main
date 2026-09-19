/**
 * PHASE 1-11: API Type Definitions
 * Production-ready DTO types for STOMP messaging
 */

// ============ AUTH TYPES ============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  role: string;
  expiresAt: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O';
}

export interface RegisterResponse {
  userId: number;
  username: string;
  email: string;
  role: string;
  message: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  role: string;
  expiresAt: number;
}

// ============ GAZE FRAME TYPES ============

export interface GazeFrameDto {
  frameId: string;
  timestamp: number;
  gazeX: number;
  gazeY: number;
  confidence: number;
  pupilSize?: number;
  validFrame: boolean;
  headRotationX?: number;
  headRotationY?: number;
  headRotationZ?: number;
  velocityX?: number;
  velocityY?: number;
}

// ============ FEATURE TYPES ============

export type FeatureType = 'FIXATION' | 'SACCADE' | 'BLINK' | 'SMOOTH_PURSUIT';

export interface FeaturePayloadDto {
  featureId: string;
  timestamp: number;
  type: FeatureType;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  magnitude?: number;
  peakVelocity?: number;
  metadata?: Record<string, any>;
}

// ============ SESSION TYPES ============

export interface SessionStartPayload {
  sessionId: string;
  taskId: string;
  metadata: {
    userId: string;
    age?: number;
    language?: string;
    difficulty?: string;
    [key: string]: any;
  };
}

export interface SessionEndPayload {
  sessionId: string;
  frameCount: number;
  featureCount: number;
  durationMs: number;
  metrics: {
    avgFixationDuration?: number;
    avgSaccadeVelocity?: number;
    blinkRate?: number;
    readingPace?: number;
    [key: string]: any;
  };
}

// ============ SERVER RESPONSE TYPES ============

export type AckStatus = 'RECEIVED' | 'RATE_LIMITED' | 'DROPPED' | 'ERROR';

export interface AckPayload {
  frameId?: string;
  status: AckStatus;
  framesReceived: number;
  framesDropped: number;
  timestamp: number;
  message?: string;
}

export interface MLResultPayload {
  sessionId: string;
  timestamp: number;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH';
  riskScore: number; // 0-1
  classification: 'LOW' | 'MODERATE' | 'HIGH';
  confidence: number;
  breakdown?: {
    ruleScore: number;
    rfScore: number;
  };
  metadata?: {
    sampleCount: number;
    duration: number;
  };
  features?: {
    fixationStability: number;
    saccadePattern: number;
    readingSpeed: number;
    comprehensionIndex: number;
  };
  recommendations?: string[];
}

export interface ErrorPayload {
  errorCode: string;
  message: string;
  timestamp: number;
  sessionId?: string;
  severity: 'WARNING' | 'ERROR' | 'FATAL';
}

// ============ INTERNAL STATE TYPES ============

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface SessionState {
  sessionId: string;
  taskId: string;
  startTime: number;
  frameCount: number;
  featureCount: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface StreamMetrics {
  framesPerSecond: number;
  acksReceived: number;
  framesDropped: number;
  lastAckTime: number;
  latencyMs: number;
  rateLimited: boolean;
}

export interface DebugMetrics {
  framesSent: number;
  framesDropped: number;
  featuresSent: number;
  acksReceived: number;
  resultsReceived: number;
  errorsReceived: number;
  reconnectCount: number;
  lastReconnectTime: number;
  uptime: number;
}
