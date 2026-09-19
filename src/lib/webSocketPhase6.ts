/**
 * PHASE 6: WebSocket Streaming Module
 * 
 * Real-time bidirectional communication with backend:
 * - Connection management with auto-reconnect
 * - Buffering when offline
 * - Structured message protocol
 * - Feature batching (2-3 second windows)
 * 
 * Message Types:
 * - GAZE_FRAME: Individual frame (raw capture)
 * - FEATURE_BATCH: Aggregated features every 2-3 seconds
 * - SESSION_START: Initialization with metadata
 * - SESSION_END:  Finalization with summary
 * - PING/PONG: Heartbeat
 */

import type { GazeFrame } from "@/types/gazeFrame";
import type { Fixation, Saccade, ExtractedMetrics } from "@/lib/featureExtractionPhase3";
import type { SessionMetadata } from "@/lib/sessionMetadataPhase5";

// ============================================================================
// MESSAGE PROTOCOL
// ============================================================================

export enum MessageType {
  // Client → Server
  SESSION_START = "SESSION_START",
  GAZE_FRAME = "GAZE_FRAME",
  FEATURE_BATCH = "FEATURE_BATCH",
  SESSION_END = "SESSION_END",
  PING = "PING",

  // Server → Client
  SESSION_STARTED = "SESSION_STARTED",
  ACK = "ACK",
  ERROR = "ERROR",
  PONG = "PONG",
}

export interface WebSocketMessage<T = any> {
  type: MessageType;
  timestamp: number;
  sessionId: string;
  payload: T;
  sequenceNumber: number;  // For ordering
}

// Message payloads
export interface SessionStartPayload {
  metadata: SessionMetadata;
  calibration: {
    offsetX: number;
    offsetY: number;
  };
}

export interface GazeFramePayload {
  frame: GazeFrame;
}

export interface FeatureBatchPayload {
  frameIdStart: number;
  frameIdEnd: number;
  timestampStart: number;
  timestampEnd: number;
  durationMs: number;
  frameCount: number;

  fixations: Fixation[];
  saccades: Saccade[];
  regressionCount: number;

  metrics: {
    averageFixationDuration: number;
    regressionRate: number;
    readingSpeed: number;
    verticalStability: number;
  };
}

export interface SessionEndPayload {
  totalFrames: number;
  totalDurationMs: number;
  finalMetrics: ExtractedMetrics;
  status: "completed" | "error" | "cancelled";
}

// ============================================================================
// CONNECTION STATE
// ============================================================================

export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  FAILED = "FAILED",
}

interface PendingMessage {
  message: WebSocketMessage;
  retryCount: number;
  enqueuedAt: number;
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

export class GazeWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private readonly sessionId: string = "";
  private sequenceNumber: number = 0;

  // Reconnection
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly reconnectDelayMs: number = 1000;
  private readonly maxReconnectDelayMs: number = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Buffering
  private readonly messageBuffer: PendingMessage[] = [];
  private readonly maxBufferSize: number = 1000;
  private flushInterval: NodeJS.Timeout | null = null;

  // Heartbeat
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatTimeoutMs: number = 5000;
  private lastHeartbeatResponseAt: number = Date.now();

  // Callbacks
  private onStateChange: ((state: ConnectionState) => void) | null = null;
  private onMessage: ((msg: WebSocketMessage) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  constructor(wsUrl: string, sessionId: string) {
    this.url = wsUrl;
    this.sessionId = sessionId;
  }

  // ========== CONNECTION LIFECYCLE ==========

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED) {
      console.warn("Already connected");
      return;
    }

    this.setState(ConnectionState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("✅ WebSocket connected");
          this.reconnectAttempts = 0;
          this.setState(ConnectionState.CONNECTED);
          this.startHeartbeat();
          this.startFlushInterval();
          this.flushBuffer(); // Send buffered messages
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(msg);
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          this.setState(ConnectionState.FAILED);
          this.onError?.(new Error("WebSocket error"));
          reject(new Error("WebSocket error"));
        };

        this.ws.onclose = () => {
          console.log("WebSocket closed");
          this.setState(ConnectionState.DISCONNECTED);
          this.stopHeartbeat();
          this.scheduleReconnect();
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.state === ConnectionState.CONNECTING) {
            reject(new Error("Connection timeout"));
            this.ws?.close();
          }
        }, 10000);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        reject(error);
      }
    });
  }

  /**
   * Disconnect gracefully
   */
  disconnect(): void {
    this.setState(ConnectionState.DISCONNECTED);
    this.stopHeartbeat();
    this.stopFlushInterval();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (
      this.state === ConnectionState.FAILED ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      console.error("❌ Max reconnection attempts reached");
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    const delayMs = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );

    console.log(
      `🔄 Reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.error("Reconnection failed:", err);
      });
    }, delayMs);
  }

  // ========== MESSAGE SENDING ==========

  /**
   * Send message (or buffer if disconnected)
   */
  private send(message: WebSocketMessage): void {
    if (this.state === ConnectionState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("Failed to send message:", err);
        this.bufferMessage(message);
      }
    } else {
      // Buffer for later
      this.bufferMessage(message);
    }
  }

  /**
   * Buffer message for transmission when online
   */
  private bufferMessage(message: WebSocketMessage): void {
    if (this.messageBuffer.length >= this.maxBufferSize) {
      // Remove oldest message
      this.messageBuffer.shift();
    }

    this.messageBuffer.push({
      message,
      retryCount: 0,
      enqueuedAt: Date.now(),
    });

    console.log(`📦 Message buffered (${this.messageBuffer.length}/${this.maxBufferSize})`);
  }

  /**
   * Flush all buffered messages
   */
  private flushBuffer(): void {
    if (this.state !== ConnectionState.CONNECTED) return;

    const toRemove: number[] = [];

    for (let i = 0; i < this.messageBuffer.length; i++) {
      const pending = this.messageBuffer[i];

      try {
        if (this.ws) {
          this.ws.send(JSON.stringify(pending.message));
          toRemove.push(i);
        }
      } catch (err) {
        console.error("Failed to flush buffered message:", err);
        pending.retryCount++;

        if (pending.retryCount > 3) {
          toRemove.push(i); // Give up after 3 retries
        }
      }
    }

    // Remove successfully sent messages
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.messageBuffer.splice(toRemove[i], 1);
    }

    if (toRemove.length > 0) {
      console.log(`✅ Flushed ${toRemove.length} buffered messages`);
    }
  }

  /**
   * Start periodic buffer flushing
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop buffer flushing
   */
  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // ========== PUBLIC API ==========

  /**
   * Send session start message
   */
  sendSessionStart(metadata: SessionMetadata, calibration: {offsetX: number, offsetY: number}): void {
    const message: WebSocketMessage<SessionStartPayload> = {
      type: MessageType.SESSION_START,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: { metadata, calibration },
      sequenceNumber: this.sequenceNumber++,
    };

    this.send(message);
    console.log("📤 Session started message sent");
  }

  /**
   * Send individual gaze frame
   */
  sendGazeFrame(frame: GazeFrame): void {
    const message: WebSocketMessage<GazeFramePayload> = {
      type: MessageType.GAZE_FRAME,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: { frame },
      sequenceNumber: this.sequenceNumber++,
    };

    this.send(message);
  }

  /**
   * Send batched features (every 2-3 seconds)
   */
  sendFeatureBatch(batch: FeatureBatchPayload): void {
    const message: WebSocketMessage<FeatureBatchPayload> = {
      type: MessageType.FEATURE_BATCH,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: batch,
      sequenceNumber: this.sequenceNumber++,
    };

    this.send(message);
    console.log(`📊 Feature batch sent (${batch.frameCount} frames)`);
  }

  /**
   * Send session end message
   */
  sendSessionEnd(endPayload: SessionEndPayload): void {
    const message: WebSocketMessage<SessionEndPayload> = {
      type: MessageType.SESSION_END,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: endPayload,
      sequenceNumber: this.sequenceNumber++,
    };

    this.send(message);
    console.log("📤 Session ended message sent");
  }

  /**
   * Send ping (heartbeat)
   */
  private sendPing(): void {
    const message: WebSocketMessage = {
      type: MessageType.PING,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: {},
      sequenceNumber: this.sequenceNumber++,
    };

    if (this.state === ConnectionState.CONNECTED) {
      try {
        this.ws?.send(JSON.stringify(message));
      } catch {}
    }
  }

  // ========== HEARTBEAT ==========

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.lastHeartbeatResponseAt = Date.now();

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastResponse = Date.now() - this.lastHeartbeatResponseAt;

      if (timeSinceLastResponse > this.heartbeatTimeoutMs) {
        console.warn("❌ Heartbeat timeout, disconnecting");
        this.ws?.close();
      } else {
        this.sendPing();
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ========== MESSAGE HANDLING ==========

  private handleMessage(msg: WebSocketMessage): void {
    if (msg.type === MessageType.PONG) {
      this.lastHeartbeatResponseAt = Date.now();
      return;
    }

    this.onMessage?.(msg);
  }

  // ========== STATE MANAGEMENT ==========

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      console.log(`🔄 Connection state: ${newState}`);
      this.onStateChange?.(newState);
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  getBufferedMessageCount(): number {
    return this.messageBuffer.length;
  }

  // ========== CALLBACKS ==========

  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onStateChange = callback;
  }

  onServerMessage(callback: (msg: WebSocketMessage) => void): void {
    this.onMessage = callback;
  }

  onCommunicationError(callback: (error: Error) => void): void {
    this.onError = callback;
  }
}

// ============================================================================
// REACT HOOK FOR WEBSOCKET
// ============================================================================

import { useRef, useEffect, useState, useCallback } from "react";

export function useWebSocketGaze(
  wsUrl: string,
  sessionId: string,
  autoConnect: boolean = true
) {
  const clientRef = useRef<GazeWebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [bufferedMessages, setBufferedMessages] = useState(0);

  // Initialize client
  useEffect(() => {
    clientRef.current = new GazeWebSocketClient(wsUrl, sessionId);

    clientRef.current.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    clientRef.current.onCommunicationError((err) => {
      console.error("WebSocket error:", err);
    });

    if (autoConnect) {
      clientRef.current.connect().catch((err) => {
        console.error("Failed to connect:", err);
      });
    }

    return () => {
      clientRef.current?.disconnect();
    };
  }, [wsUrl, sessionId, autoConnect]);

  // Update buffered message count
  useEffect(() => {
    const interval = setInterval(() => {
      if (clientRef.current) {
        setBufferedMessages(clientRef.current.getBufferedMessageCount());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // API
  const connect = useCallback(async () => {
    await clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendSessionStart = useCallback(
    (metadata: SessionMetadata, calibration: { offsetX: number; offsetY: number }) => {
      clientRef.current?.sendSessionStart(metadata, calibration);
    },
    []
  );

  const sendGazeFrame = useCallback((frame: GazeFrame) => {
    clientRef.current?.sendGazeFrame(frame);
  }, []);

  const sendFeatureBatch = useCallback((batch: FeatureBatchPayload) => {
    clientRef.current?.sendFeatureBatch(batch);
  }, []);

  const sendSessionEnd = useCallback((endPayload: SessionEndPayload) => {
    clientRef.current?.sendSessionEnd(endPayload);
  }, []);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
    connectionState,
    bufferedMessages,
    connect,
    disconnect,
    sendSessionStart,
    sendGazeFrame,
    sendFeatureBatch,
    sendSessionEnd,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Message types are already exported as interfaces above
