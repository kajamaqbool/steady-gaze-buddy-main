/**
 * PHASE 4 + 7: Zustand State Store
 * Session lifecycle + stream metrics + ML results
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionState,
  StreamMetrics,
  DebugMetrics,
  MLResultPayload,
  AckPayload,
  ConnectionStatus,
} from '../api/types';

interface GazeStore {
  // Connection state
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Session state
  session: SessionState | null;
  startSession: (taskId: string, metadata?: Record<string, any>) => void;
  endSession: () => SessionState | null;
  isSessionActive: () => boolean;
  incrementFrameCount: () => void;
  incrementFeatureCount: () => void;

  // Stream metrics
  metrics: StreamMetrics;
  updateMetrics: (partial: Partial<StreamMetrics>) => void;
  recordAck: (ack: AckPayload) => void;
  calculateFramesPerSecond: () => void;

  // ML Results
  latestResult: MLResultPayload | null;
  resultHistory: MLResultPayload[];
  setLatestResult: (result: MLResultPayload) => void;
  clearResultHistory: () => void;

  // Debug metrics
  debug: DebugMetrics;
  incrementDebugMetric: (metric: keyof DebugMetrics, value?: number) => void;
  resetDebugMetrics: () => void;

  // Cleanup
  reset: () => void;
}

const createInitialSession = (taskId: string, metadata?: Record<string, any>): SessionState => ({
  sessionId: uuidv4(),
  taskId,
  startTime: Date.now(),
  frameCount: 0,
  featureCount: 0,
  isActive: true,
  metadata: metadata || {},
});

const createInitialMetrics = (): StreamMetrics => ({
  framesPerSecond: 0,
  acksReceived: 0,
  framesDropped: 0,
  lastAckTime: 0,
  latencyMs: 0,
  rateLimited: false,
});

const createInitialDebugMetrics = (): DebugMetrics => ({
  framesSent: 0,
  framesDropped: 0,
  featuresSent: 0,
  acksReceived: 0,
  resultsReceived: 0,
  errorsReceived: 0,
  reconnectCount: 0,
  lastReconnectTime: 0,
  uptime: 0,
});

export const useGazeStore = create<GazeStore>((set, get) => {
  // Setup uptime counter
  const startTime = Date.now();
  const uptimeInterval = setInterval(() => {
    set(state => ({
      debug: {
        ...state.debug,
        uptime: Date.now() - startTime,
      },
    }));
  }, 1000);

  return {
    // Connection state
    connectionStatus: 'DISCONNECTED',
    setConnectionStatus: (status: ConnectionStatus) =>
      set({ connectionStatus: status }),

    // Session state
    session: null,
    startSession: (taskId: string, metadata?: Record<string, any>) => {
      const newSession = createInitialSession(taskId, metadata);
      set({
        session: newSession,
        metrics: createInitialMetrics(),
        debug: createInitialDebugMetrics(),
      });
    },

    endSession: () => {
      const current = get().session;
      if (current) {
        set({ session: null });
      }
      return current || null;
    },

    isSessionActive: () => {
      const session = get().session;
      return session?.isActive ?? false;
    },

    incrementFrameCount: () =>
      set(state => {
        if (state.session) {
          return {
            session: { ...state.session, frameCount: state.session.frameCount + 1 },
            debug: { ...state.debug, framesSent: state.debug.framesSent + 1 },
          };
        }
        return state;
      }),

    incrementFeatureCount: () =>
      set(state => {
        if (state.session) {
          return {
            session: { ...state.session, featureCount: state.session.featureCount + 1 },
            debug: { ...state.debug, featuresSent: state.debug.featuresSent + 1 },
          };
        }
        return state;
      }),

    // Metrics
    metrics: createInitialMetrics(),

    updateMetrics: (partial: Partial<StreamMetrics>) =>
      set(state => ({
        metrics: { ...state.metrics, ...partial },
      })),

    recordAck: (ack: AckPayload) => {
      const latency = Date.now() - ack.timestamp;
      set(state => ({
        metrics: {
          ...state.metrics,
          acksReceived: state.metrics.acksReceived + 1,
          framesDropped: ack.framesDropped,
          latencyMs: latency,
          rateLimited: ack.status === 'RATE_LIMITED',
          lastAckTime: Date.now(),
        },
        debug: {
          ...state.debug,
          acksReceived: state.debug.acksReceived + 1,
          framesDropped: ack.framesDropped,
        },
      }));
    },

    calculateFramesPerSecond: () => {
      set(state => {
        if (!state.session) return state;
        const elapsedSeconds = (Date.now() - state.session.startTime) / 1000;
        const fps = elapsedSeconds > 0 ? state.session.frameCount / elapsedSeconds : 0;
        return {
          metrics: { ...state.metrics, framesPerSecond: fps },
        };
      });
    },

    // ML Results
    latestResult: null,
    resultHistory: [],

    setLatestResult: (result: MLResultPayload) =>
      set(state => {
        const history = [result, ...state.resultHistory].slice(0, 100); // Keep last 100
        return {
          latestResult: result,
          resultHistory: history,
          debug: { ...state.debug, resultsReceived: state.debug.resultsReceived + 1 },
        };
      }),

    clearResultHistory: () =>
      set({
        latestResult: null,
        resultHistory: [],
      }),

    // Debug metrics
    debug: createInitialDebugMetrics(),

    incrementDebugMetric: (metric: keyof DebugMetrics, value = 1) =>
      set(state => ({
        debug: {
          ...state.debug,
          [metric]: (state.debug[metric] as number) + value,
        },
      })),

    resetDebugMetrics: () =>
      set({ debug: createInitialDebugMetrics() }),

    // Cleanup
    reset: () => {
      clearInterval(uptimeInterval);
      set({
        connectionStatus: 'DISCONNECTED',
        session: null,
        metrics: createInitialMetrics(),
        latestResult: null,
        resultHistory: [],
        debug: createInitialDebugMetrics(),
      });
    },
  };
});
