# STOMP Implementation - Complete API Reference

## Service Layer APIs

### authService

```typescript
import { authService } from '@/api/authService';

// Login with credentials
async login(request: LoginRequest): Promise<AuthTokens>
  // Parameters:
  //   - username: string
  //   - password: string
  // Returns: { accessToken, refreshToken, expiresAt }
  // Example:
  const tokens = await authService.login({
    username: 'user@example.com',
    password: 'password123'
  });

// Get access token
getAccessToken(): string | null
  // Returns current access token or null
  const token = authService.getAccessToken();

// Check authentication status
isAuthenticated(): boolean
  // Returns true if token exists and not expired
  if (authService.isAuthenticated()) { /* ... */ }

// Refresh token
async refreshToken(): Promise<AuthTokens>
  // Refresh expired token using refresh token
  // Automatically called on 401 response
  const newTokens = await authService.refreshToken();

// Logout and clear tokens
logout(): void
  // Clears memory and localStorage tokens
  authService.logout();

// Token storage (internal)
getStoredTokens(): AuthTokens | null
setStoredTokens(tokens: AuthTokens): void
clearStoredTokens(): void
isTokenExpired(): boolean
```

### stompClient

```typescript
import { stompClient } from '@/api/wsClient';

// Connect to STOMP server
async connect(): Promise<void>
  // Establishes WebSocket connection with JWT
  // Automatically resubscribes to default queues
  await stompClient.connect();

// Disconnect from STOMP server
disconnect(): void
  // Gracefully closes connection
  stompClient.disconnect();

// Force reconnection
async forceReconnect(): Promise<void>
  // Disconnects and reconnects (resets backoff)
  await stompClient.forceReconnect();

// Check connection status
isConnected(): boolean
  // Returns true if connected and active
  if (stompClient.isConnected()) { /* stream frames */ }

// Get connection status
getStatus(): ConnectionStatus
  // Returns: DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING | ERROR
  const status = stompClient.getStatus();

// Subscribe to destination
subscribe(
  destination: string,
  callback: (message: Message) => void
): () => void
  // Returns unsubscribe function
  const unsub = stompClient.subscribe('/user/queue/result', (msg) => {
    const result = JSON.parse(msg.body);
    console.log('ML Result:', result);
  });
  // Later: unsub();

// Publish message
publish(
  destination: string,
  body: Record<string, any> | string,
  skipContentLengthHeader?: boolean
): void
  // Send message to destination
  stompClient.publish('/app/gaze.frame', {
    frameId: 'uuid',
    timestamp: Date.now(),
    // ...
  });

// Listen to connection status changes
onConnectionChange(callback: (status: ConnectionStatus) => void): () => void
  // Returns unsubscribe function
  const unsubscribe = stompClient.onConnectionChange((status) => {
    console.log('Connection:', status);
  });

// Get reconnect stats
getReconnectStats(): {
  attempts: number;
  delay: number;
  maxAttempts: number;
}
  // Diagnostic info about reconnection attempts
  const stats = stompClient.getReconnectStats();

// Get subscription count
getSubscriptionCount(): number
  // How many active subscriptions
  const count = stompClient.getSubscriptionCount();
```

### SessionManager

```typescript
import SessionManager from '@/api/sessionManager';

// Start a gaze tracking session
static async startSession(
  taskId: string,
  metadata?: Record<string, any>
): Promise<string>
  // Returns sessionId
  // Example:
  const sessionId = await SessionManager.startSession('reading-task-001', {
    userId: 'user123',
    age: 28,
    language: 'en',
  });

// End the current session
static async endSession(): Promise<void>
  // Sends session end to server
  // Clears session from store
  await SessionManager.endSession();

// Get current session ID
static getCurrentSessionId(): string | null
  // Returns active session ID or null
  const id = SessionManager.getCurrentSessionId();

// Check if session is active
static isSessionActive(): boolean
  // Returns true if session is running
  if (SessionManager.isSessionActive()) { /* ... */ }

// Get session summary
static getSessionSummary(): {
  sessionId: string;
  taskId: string;
  duration: number;
  frameCount: number;
  featureCount: number;
  framesPerSecond: number;
  acksReceived: number;
  framesDropped: number;
  averageLatency: number;
  rateLimited: boolean;
} | null
  // Snapshot of current session
  const summary = SessionManager.getSessionSummary();
  console.log(`Sent ${summary.frameCount} frames in ${summary.duration}ms`);
```

## React Hooks

### useWebSocketConnection

```typescript
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';

interface UseWebSocketConnectionOptions {
  autoConnect?: boolean;        // Default: false
  onConnected?: () => void;     // Callback on connection
  onDisconnected?: () => void;  // Callback on disconnect
  onError?: (error: Error) => void;  // Error callback
}

const {
  status,        // ConnectionStatus
  isConnected,   // boolean
  connect,       // () => Promise<void>
  disconnect,    // () => void
  reconnect,     // () => Promise<void>
} = useWebSocketConnection({
  autoConnect: true,
  onConnected: () => console.log('Connected!'),
  onError: (err) => console.error(err),
});
```

### useGazeStream

```typescript
import { useGazeStream } from '@/hooks/useGazeStream';

interface UseGazeStreamOptions {
  enabled?: boolean;            // Enable/disable streaming
  targetFps?: number;           // Default: 60
  onFrame?: (frame: GazeFrameDto) => void;
  onError?: (error: Error) => void;
}

const {
  isStreaming,   // boolean
  frameCount,    // number
  start,         // () => Promise<void>
  stop,          // () => void
} = useGazeStream({
  enabled: sessionActive,
  targetFps: 60,
  onFrame: (frame) => console.log('Frame:', frame),
  onError: (err) => console.error(err),
});
```

### useFeaturePublisher

```typescript
import { useFeaturePublisher } from '@/hooks/useFeaturePublisher';

interface UseFeaturePublisherOptions {
  onPublish?: (feature: FeaturePayloadDto) => void;
  onError?: (error: Error) => void;
}

const {
  publishFeature,        // (type, data) => void
  publishFixation,       // (options) => void
  publishSaccade,        // (options) => void
  publishBlink,          // (options) => void
  publishSmoothPursuit,  // (options) => void
} = useFeaturePublisher({
  onPublish: (feature) => console.log('Published:', feature),
  onError: (err) => console.error(err),
});

// Usage:
publishFixation({
  duration: 200,         // milliseconds
  x: 0.5,                // normalized 0-1
  y: 0.3,
  metadata: { wordIndex: 5 },
});

publishSaccade({
  duration: 50,
  startX: 0.5,
  startY: 0.3,
  endX: 0.6,
  endY: 0.25,
  peakVelocity: 500,     // degrees/second
});

publishBlink({
  duration: 100,
  x: 0.5,
  y: 0.5,
});
```

### useServerResponses

```typescript
import { useServerResponses } from '@/hooks/useServerResponses';

interface UseServerResponsesOptions {
  onAck?: (ack: AckPayload) => void;
  onResult?: (result: MLResultPayload) => void;
  onError?: (error: ErrorPayload) => void;
  enabled?: boolean;              // Default: true
}

useServerResponses({
  onAck: (ack) => {
    console.log(`ACK: ${ack.framesReceived} frames, ${ack.framesDropped} dropped`);
    if (ack.status === 'RATE_LIMITED') {
      console.warn('Server rate limited!');
    }
  },
  onResult: (result) => {
    console.log(`Risk Level: ${result.riskLevel} (${result.riskScore}%)`);
  },
  onError: (error) => {
    console.error(`Server Error: ${error.message} (${error.severity})`);
  },
});

// Returns: { isListening: boolean }
```

## Zustand Store

### useGazeStore

```typescript
import { useGazeStore } from '@/store/gazeStore';

// Connection state
connectionStatus: ConnectionStatus;           // DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING | ERROR
setConnectionStatus: (status: ConnectionStatus) => void;

// Session state
session: SessionState | null;                 // Current session
startSession: (taskId: string, metadata?: {}) => void;
endSession: () => SessionState | null;        // Returns ended session
isSessionActive: () => boolean;
incrementFrameCount: () => void;
incrementFeatureCount: () => void;

// Stream metrics
metrics: StreamMetrics;                       // Real-time metrics
updateMetrics: (partial: Partial<StreamMetrics>) => void;
recordAck: (ack: AckPayload) => void;
calculateFramesPerSecond: () => void;

// ML Results
latestResult: MLResultPayload | null;         // Most recent result
resultHistory: MLResultPayload[];             // Last 100 results
setLatestResult: (result: MLResultPayload) => void;
clearResultHistory: () => void;

// Debug metrics
debug: DebugMetrics;
incrementDebugMetric: (metric: keyof DebugMetrics, value?: number) => void;
resetDebugMetrics: () => void;

// Cleanup
reset: () => void;

// Usage:
const store = useGazeStore();
console.log('Connected:', store.connectionStatus === 'CONNECTED');
console.log('Session:', store.session?.sessionId);
console.log('Frames sent:', store.debug.framesSent);
console.log('Risk level:', store.latestResult?.riskLevel);
```

## Type Definitions

### DTOs (Data Transfer Objects)

```typescript
// Request payloads
SessionStartPayload {
  sessionId: string;
  taskId: string;
  metadata: { userId, age?, language?, difficulty?, ... };
}

GazeFrameDto {
  frameId: string;
  timestamp: number;
  gazeX: number;              // 0-1 normalized
  gazeY: number;
  confidence: number;         // 0-1
  pupilSize?: number;
  validFrame: boolean;
  headRotationX?: number;
  headRotationY?: number;
  headRotationZ?: number;
  velocityX?: number;
  velocityY?: number;
}

FeaturePayloadDto {
  featureId: string;
  timestamp: number;
  type: 'FIXATION' | 'SACCADE' | 'BLINK' | 'SMOOTH_PURSUIT';
  duration: number;
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  magnitude?: number;
  peakVelocity?: number;
  metadata?: Record<string, any>;
}

SessionEndPayload {
  sessionId: string;
  frameCount: number;
  featureCount: number;
  durationMs: number;
  metrics: {
    avgFixationDuration?: number;
    avgSaccadeVelocity?: number;
    blinkRate?: number;
    readingPace?: number;
  };
}

// Response payloads
AckPayload {
  frameId?: string;
  status: 'RECEIVED' | 'RATE_LIMITED' | 'DROPPED' | 'ERROR';
  framesReceived: number;
  framesDropped: number;
  timestamp: number;
  message?: string;
}

MLResultPayload {
  sessionId: string;
  timestamp: number;
  frameId: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  riskScore: number;           // 0-100
  classification: string;
  confidence: number;          // 0-1
  features: {
    fixationStability: number;
    saccadePattern: number;
    readingSpeed: number;
    comprehensionIndex: number;
  };
  recommendations?: string[];
}

ErrorPayload {
  errorCode: string;
  message: string;
  timestamp: number;
  sessionId?: string;
  severity: 'WARNING' | 'ERROR' | 'FATAL';
}
```

### Store Types

```typescript
SessionState {
  sessionId: string;
  taskId: string;
  startTime: number;
  frameCount: number;
  featureCount: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

StreamMetrics {
  framesPerSecond: number;
  acksReceived: number;
  framesDropped: number;
  lastAckTime: number;
  latencyMs: number;
  rateLimited: boolean;
}

DebugMetrics {
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
```

## Common Patterns

### Pattern 1: Complete Session Flow

```typescript
async function runCompleteSession() {
  // Connect
  await stompClient.connect();
  
  // Start session
  const sessionId = await SessionManager.startSession('task-1', {
    userId: 'user123'
  });
  
  // Stream
  const stream = useGazeStream({ enabled: true });
  await stream.start();
  
  // Listen for results
  useServerResponses({
    onResult: (result) => console.log(result)
  });
  
  // After some time...
  stream.stop();
  await SessionManager.endSession();
  stompClient.disconnect();
}
```

### Pattern 2: Error Handling

```typescript
const { connect, status } = useWebSocketConnection({
  onError: (error) => {
    console.error('Connection failed:', error);
    // Show error UI
  }
});

useServerResponses({
  onError: (error) => {
    if (error.severity === 'FATAL') {
      // Stop session
      // Show error dialog
    } else if (error.severity === 'ERROR') {
      // Log and continue
    }
  }
});
```

### Pattern 3: Metrics Monitoring

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const summary = SessionManager.getSessionSummary();
    if (summary) {
      console.log({
        fps: summary.framesPerSecond.toFixed(1),
        latency: summary.averageLatency.toFixed(0),
        dropped: summary.framesDropped,
        rateLimited: summary.rateLimited,
      });
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

---

**API Version**: 1.0.0  
**Stability**: Production Ready  
**Last Updated**: 2026-05-04
