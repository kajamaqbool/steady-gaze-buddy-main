# Production STOMP/WebSocket Frontend Implementation

## Overview

This is a production-ready React frontend for a real-time dyslexia detection system. It implements the complete pipeline: **JWT login → STOMP connect → 60Hz gaze streaming → ML result display**.

## Architecture

### Layer 1: Authentication (`src/api/authService.ts`)
- **Purpose**: Handle JWT login and token refresh
- **Features**:
  - REST login endpoint: `POST /api/auth/login`
  - Token storage (memory-first, localStorage fallback)
  - Axios interceptor for automatic token refresh on 401
  - Secure token lifecycle management

### Layer 2: WebSocket/STOMP (`src/api/wsClient.ts`)
- **Purpose**: STOMP protocol client with SockJS fallback
- **Features**:
  - Connect to `/ws/gaze` with SockJS
  - JWT in STOMP CONNECT headers
  - Auto-resubscribe on reconnect
  - Heartbeat management (10s in/out)
  - Frame size limiting (128KB max)

### Layer 3: State Management (`src/store/gazeStore.ts`)
- **Purpose**: Zustand store for reactive state
- **Features**:
  - Session lifecycle (start/end)
  - Real-time metrics (FPS, latency, dropped frames)
  - ML result history (last 100 results)
  - Debug metrics
  - Automatic uptime tracking

### Layer 4: Session Manager (`src/api/sessionManager.ts`)
- **Purpose**: Session lifecycle operations
- **Features**:
  - `startSession(taskId, metadata)` → sends `/app/gaze.session.start`
  - `endSession()` → sends `/app/gaze.session.end`
  - Session summary retrieval

### Layer 5: Streaming Hooks
- **`useGazeStream.ts`**: 60Hz frame streaming with requestAnimationFrame throttling
- **`useFeaturePublisher.ts`**: Publish detected features (fixation, saccade, blink, smooth pursuit)
- **`useServerResponses.ts`**: Handle ACK, ML results, errors from server
- **`useWebSocketConnection.ts`**: Connection lifecycle + auto-reconnect

### Layer 6: UI Components
- **`ConnectionStatus.tsx`**: Visual connection state indicator
- **`SessionControls.tsx`**: Start/stop session UI
- **`LiveMetricsPanel.tsx`**: Real-time FPS, latency, frame count
- **`RiskIndicator.tsx`**: ML result display with risk score
- **`DebugPanel.tsx`**: System diagnostics (frames sent, dropped, latency)
- **`DyslexiaDetectionApp.tsx`**: Complete integration example

## Message Flow

### 1. Initialization
```
User clicks "Connect" 
  → authService.login(credentials)
  → token stored
  → useWebSocketConnection.connect()
    → stompClient.connect() with JWT header
    → subscribe to /user/queue/{ack,result,errors}
    → emit CONNECTED
```

### 2. Session Start
```
User clicks "Start Session"
  → SessionManager.startSession(taskId)
  → store.startSession()
  → stompClient.publish("/app/gaze.session.start", {sessionId, taskId, metadata})
  → useGazeStream.start()
    → requestAnimationFrame loop starts
```

### 3. Frame Streaming (60Hz)
```
Every 16.7ms (60 FPS):
  → createGazeFrame() — use your gaze tracking pipeline
  → stompClient.publish("/app/gaze.frame", {frameId, timestamp, gazeX, gazeY, ...})
  → store.incrementFrameCount()
  → server processes and sends ACK
```

### 4. Feature Publishing (On Detection)
```
When fixation detected:
  → useFeaturePublisher.publishFixation({duration, x, y})
  → stompClient.publish("/app/gaze.feature", {featureId, type, startX, startY, ...})
  → store.incrementFeatureCount()
```

### 5. Server Responses (Real-time)
```
ACK: /user/queue/ack
  → {frameId, status, framesReceived, framesDropped, timestamp}
  → store.recordAck() updates metrics

RESULT: /user/queue/result
  → {sessionId, riskLevel, riskScore, features, recommendations}
  → store.setLatestResult() triggers UI update

ERROR: /user/queue/errors
  → {errorCode, message, severity}
  → displayed as toast/banner
```

### 6. Session End
```
User clicks "End Session"
  → useGazeStream.stop()
  → SessionManager.endSession()
  → stompClient.publish("/app/gaze.session.end", {sessionId, frameCount, durationMs, metrics})
  → store.endSession()
```

## Destination Reference

### Publishing Destinations

**`/app/gaze.session.start`** (SessionStartPayload)
```json
{
  "sessionId": "uuid",
  "taskId": "reading-task-001",
  "metadata": {
    "userId": "user123",
    "age": 28,
    "language": "en",
    "timestamp": 1234567890
  }
}
```

**`/app/gaze.frame`** (GazeFrameDto + sessionId)
```json
{
  "frameId": "uuid",
  "sessionId": "uuid",
  "timestamp": 1234567890,
  "gazeX": 0.5,
  "gazeY": 0.3,
  "confidence": 0.92,
  "pupilSize": 3.2,
  "validFrame": true,
  "headRotationX": 0.1,
  "headRotationY": -0.05,
  "headRotationZ": 0.02,
  "velocityX": 0.001,
  "velocityY": -0.0005
}
```

**`/app/gaze.feature`** (FeaturePayloadDto + sessionId)
```json
{
  "featureId": "uuid",
  "sessionId": "uuid",
  "timestamp": 1234567890,
  "type": "FIXATION",
  "duration": 150,
  "startX": 0.5,
  "startY": 0.3,
  "endX": 0.5,
  "endY": 0.3,
  "metadata": { "wordIndex": 5 }
}
```

**`/app/gaze.session.end`** (SessionEndPayload)
```json
{
  "sessionId": "uuid",
  "frameCount": 3600,
  "featureCount": 245,
  "durationMs": 60000,
  "metrics": {
    "avgFixationDuration": 180,
    "avgSaccadeVelocity": 450,
    "readingPace": 58.5
  }
}
```

### Receiving Destinations

**`/user/queue/ack`** (AckPayload)
- Status: RECEIVED | RATE_LIMITED | DROPPED | ERROR
- Use to detect backpressure

**`/user/queue/result`** (MLResultPayload)
- Risk level: LOW | MODERATE | HIGH
- Includes feature breakdown and recommendations

**`/user/queue/errors`** (ErrorPayload)
- Severity: WARNING | ERROR | FATAL
- For non-blocking notifications

## Usage Example

### Complete App Integration

```tsx
import { DyslexiaDetectionApp } from '@/components/DyslexiaDetectionApp';

export default function App() {
  return <DyslexiaDetectionApp />;
}
```

### Manual Integration

```tsx
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useGazeStream } from '@/hooks/useGazeStream';
import { useServerResponses } from '@/hooks/useServerResponses';
import SessionManager from '@/api/sessionManager';
import { useGazeStore } from '@/store/gazeStore';

export function MyDyslexiaDetector() {
  const { status, connect } = useWebSocketConnection({ autoConnect: true });
  const store = useGazeStore();

  useServerResponses({
    onResult: (result) => console.log('Risk level:', result.riskLevel),
  });

  const { isStreaming, start, stop } = useGazeStream({
    enabled: !!store.session,
  });

  const handleStart = async () => {
    await SessionManager.startSession('my-task', { userId: 'user1' });
    await start();
  };

  const handleEnd = async () => {
    stop();
    await SessionManager.endSession();
  };

  return (
    <div>
      <button onClick={() => connect()}>Connect</button>
      <button onClick={handleStart}>Start</button>
      <button onClick={handleEnd}>Stop</button>
      <p>Risk: {store.latestResult?.riskLevel}</p>
      <p>FPS: {store.metrics.framesPerSecond.toFixed(1)}</p>
    </div>
  );
}
```

## Performance Optimization

### 1. Frame Rate Management
- Uses `requestAnimationFrame` for smooth 60Hz throttling
- Skips frames if WebSocket not connected
- Skips frames if session not active
- Skips frames if rate limited (detected via ACK)

### 2. State Update Batching
- Increments frame count in store only when published
- Calculates FPS every 60 frames (not every frame)
- ML results accumulated in history (max 100)

### 3. Payload Optimization
- Numbers only (no strings)
- Minimal metadata
- 128KB frame size limit

### 4. Memory Management
- History limited to last 100 results
- Unsubscribe on unmount
- Clear timers on disconnect
- No memory leaks with useEffect cleanup

## Resilience Features

### Auto-Reconnect
- Triggered on WebSocket close
- Exponential backoff (3s delay)
- Automatic resubscription to queues
- Token refresh on reconnect if needed

### Rate Limiting Handling
- ACK status monitored
- On RATE_LIMITED, reduce send frequency
- Visual warning in LiveMetricsPanel
- Server can throttle client-side

### Error Recovery
- Errors logged but don't crash app
- Failed session.start() reverts store state
- Disconnects gracefully
- Token refresh automatic on 401

## Security Considerations

### ✅ Secure Practices
- JWT only in STOMP CONNECT headers (never in message body)
- Token refresh before reconnect
- Tokens cleared on logout
- HttpOnly cookies for refresh token (if used)

### ⚠️ Configuration
- Change `API_BASE_URL` and `WS_URL` to your backend
- Use HTTPS in production (wss://)
- Implement proper CORS on backend
- Validate tokens server-side

### 🔒 Best Practices
```typescript
// DO: Use environment variables
const WS_URL = process.env.REACT_APP_WS_URL;

// DON'T: Hardcode URLs
const WS_URL = 'ws://localhost:8080/ws/gaze';

// DO: Clear tokens on logout
authService.logout(); // clears store + localStorage
stompClient.disconnect();

// DON'T: Send JWT in message body
stompClient.publish('/app/gaze.frame', { token, data }); // ❌
```

## Environment Setup

### Required Dependencies
```json
{
  "@stomp/stompjs": "^7.0.0",
  "sockjs-client": "^1.6.0",
  "axios": "^1.6.0",
  "uuid": "^9.0.0",
  "zustand": "^4.4.0"
}
```

### Environment Variables
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=http://localhost:8080/ws/gaze
```

## Testing

### Unit Test Example
```typescript
describe('useGazeStream', () => {
  it('should send frames at 60Hz when connected', async () => {
    const { result } = renderHook(() => useGazeStream({ enabled: true }));
    await waitFor(() => expect(result.current.frameCount).toBeGreaterThan(10));
  });
});
```

### Integration Test
```typescript
describe('DyslexiaDetectionApp', () => {
  it('should complete full flow: connect → start → stream → results', async () => {
    render(<DyslexiaDetectionApp />);
    
    // Wait for connection
    await screen.findByText(/Connected/);
    
    // Start session
    userEvent.click(screen.getByText(/Start Session/));
    
    // Verify streaming
    await waitFor(() => expect(screen.getByText(/FPS:/)).toBeInTheDocument());
  });
});
```

## Troubleshooting

### WebSocket not connecting
- [ ] Backend server running at correct URL?
- [ ] CORS headers configured on backend?
- [ ] JWT token valid and not expired?
- [ ] Check browser console for error details

### Frames not streaming
- [ ] Session started? (check store.session)
- [ ] WebSocket connected? (check connection status)
- [ ] Gaze tracking providing data? (check createGazeFrame)
- [ ] Rate limit triggered? (check ACK status)

### ML results not appearing
- [ ] Backend processing and sending results?
- [ ] Message parsing correct? (check JSON structure)
- [ ] Subscription active? (check /user/queue/result)

### High latency
- [ ] Network connection stable?
- [ ] Large payloads? (check ACK framesDropped)
- [ ] Server processing slow? (check ACK timestamp)

## Notes on Backend Integration

- Backend must implement STOMP broker (e.g., Spring WebSocket + STOMP)
- User authentication context available via JWT
- Implement rate limiting at /app/gaze.frame destination
- ACK response critical for client-side metrics
- ML model integration processes gaze frames and publishes results
- Consider batching results to reduce message frequency

---

**Last Updated**: 2026-05-04  
**Version**: 1.0.0 - Production Ready
