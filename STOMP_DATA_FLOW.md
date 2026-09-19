# STOMP Implementation - Data Flow Diagrams

## Complete User Journey

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                               │
└──────────────────────────────────────────────────────────────────────┘

1. LOGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   User enters credentials
         ↓
   authService.login(username, password)
         ↓
   REST: POST /api/auth/login
         ↓
   Backend returns { accessToken, refreshToken, expiresIn }
         ↓
   Tokens stored in memory + localStorage
         ↓
   Axios interceptor configured
   ✅ Ready to connect WebSocket


2. CONNECT TO WEBSOCKET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   useWebSocketConnection({ autoConnect: true })
         ↓
   stompClient.connect()
         ↓
   Create SockJS transport to /ws/gaze
         ↓
   STOMP CONNECT frame with JWT header:
   ┌─────────────────────────────────┐
   │ Authorization: Bearer <token>   │
   └─────────────────────────────────┘
         ↓
   Backend validates JWT
         ↓
   STOMP CONNECTED response
         ↓
   Auto-subscribe to:
   - /user/queue/ack
   - /user/queue/result
   - /user/queue/errors
         ↓
   store.setConnectionStatus('CONNECTED')
   ✅ Ready to stream frames


3. START SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   User clicks "Start Session"
         ↓
   SessionManager.startSession(taskId, metadata)
         ↓
   Generate sessionId (UUID)
         ↓
   Publish to /app/gaze.session.start:
   ┌────────────────────────────────────────┐
   │ {                                       │
   │   "sessionId": "uuid-123",              │
   │   "taskId": "reading-task-001",         │
   │   "metadata": {                         │
   │     "userId": "user123",                │
   │     "timestamp": 1234567890             │
   │   }                                     │
   │ }                                       │
   └────────────────────────────────────────┘
         ↓
   Backend receives, creates session record
         ↓
   Sends ACK to /user/queue/ack
         ↓
   store.startSession() - initialize metrics
   ✅ Ready to stream gaze frames


4. STREAM GAZE FRAMES (60Hz)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   useGazeStream.start()
         ↓
   requestAnimationFrame loop begins
         ↓
   Every 16.7ms (60 FPS):
   
   ┌─ Check guards ─┐
   │ ✓ Connected?   │→ Skip if no
   │ ✓ Session?     │
   │ ✓ Rate limit?  │
   └────────────────┘
         ↓ (All pass)
   createGazeFrame() from your gaze tracker:
   ┌──────────────────────────────────────┐
   │ {                                    │
   │   "frameId": "frame-456",            │
   │   "timestamp": 1234567890,           │
   │   "gazeX": 0.5,     // normalized   │
   │   "gazeY": 0.3,                      │
   │   "confidence": 0.92,                │
   │   "pupilSize": 3.2,                  │
   │   "validFrame": true                 │
   │ }                                    │
   └──────────────────────────────────────┘
         ↓
   Publish to /app/gaze.frame:
   └→ WebSocket message sent
         ↓
   store.incrementFrameCount()
         ↓
   [60 frames per second flowing]
   ✅ Server receives and processes


5. PUBLISH DETECTED FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   When feature detected (fixation, saccade, etc):
   
   useFeaturePublisher.publishFixation({
     duration: 200,
     x: 0.5,
     y: 0.3
   })
         ↓
   Create FeaturePayloadDto:
   ┌──────────────────────────────────┐
   │ {                                │
   │   "featureId": "feat-789",       │
   │   "sessionId": "uuid-123",       │
   │   "timestamp": 1234567890,       │
   │   "type": "FIXATION",            │
   │   "duration": 200,               │
   │   "startX": 0.5,                 │
   │   "startY": 0.3,                 │
   │   "endX": 0.5,                   │
   │   "endY": 0.3,                   │
   │   "metadata": { ... }            │
   │ }                                │
   └──────────────────────────────────┘
         ↓
   Publish to /app/gaze.feature
         ↓
   store.incrementFeatureCount()
   ✅ Backend receives feature


6. RECEIVE ACK RESPONSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Backend sends ACK to /user/queue/ack:
   ┌────────────────────────────────────┐
   │ {                                  │
   │   "frameId": "frame-456",          │
   │   "status": "RECEIVED",            │
   │   "framesReceived": 1000,          │
   │   "framesDropped": 2,              │
   │   "timestamp": 1234567890          │
   │ }                                  │
   └────────────────────────────────────┘
         ↓
   useServerResponses handler:
   onAck(ack) {
     store.recordAck(ack)
     // Updates:
     // - metrics.framesPerSecond
     // - metrics.latencyMs
     // - metrics.rateLimited (if status === 'RATE_LIMITED')
   }
         ↓
   If RATE_LIMITED:
   └→ Reduce send frequency client-side


7. RECEIVE ML RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Backend ML model processes frames, sends to /user/queue/result:
   ┌──────────────────────────────────────┐
   │ {                                    │
   │   "sessionId": "uuid-123",           │
   │   "timestamp": 1234567890,           │
   │   "riskLevel": "MODERATE",           │
   │   "riskScore": 65,                   │
   │   "classification": "Dyslexia Risk", │
   │   "confidence": 0.87,                │
   │   "features": {                      │
   │     "fixationStability": 0.72,       │
   │     "saccadePattern": 0.81,          │
   │     "readingSpeed": 0.55,            │
   │     "comprehensionIndex": 0.68       │
   │   },                                 │
   │   "recommendations": [               │
   │     "Increase font size",            │
   │     "Reduce line spacing",           │
   │     "Add visual guides"              │
   │   ]                                  │
   │ }                                    │
   └──────────────────────────────────────┘
         ↓
   useServerResponses handler:
   onResult(result) {
     store.setLatestResult(result)
     // Triggers UI update → RiskIndicator component
   }
         ↓
   UI Updates:
   ├→ Show risk level (LOW/MODERATE/HIGH)
   ├→ Display risk score (65%)
   ├→ Feature breakdown (graphs)
   └→ Show recommendations
   ✅ User sees live results


8. HANDLE ERRORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   If error occurs, backend sends to /user/queue/errors:
   ┌─────────────────────────────────┐
   │ {                               │
   │   "errorCode": "E_RATE_LIMITED",│
   │   "message": "Too many frames", │
   │   "severity": "WARNING",        │
   │   "timestamp": 1234567890       │
   │ }                               │
   └─────────────────────────────────┘
         ↓
   useServerResponses handler:
   onError(error) {
     store.incrementDebugMetric('errorsReceived')
     
     if (error.severity === 'FATAL') {
       // Stop session, show error modal
     } else if (error.severity === 'ERROR') {
       // Log, show warning toast
     } else {
       // Just log
     }
   }


9. AUTO-RECONNECT ON DISCONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   If network drops or server closes connection:
   
   stompClient detects close
         ↓
   onConnectionChange → RECONNECTING
         ↓
   Wait 3 seconds (exponential backoff)
         ↓
   authService.refreshToken() if needed
         ↓
   stompClient.connect() with new JWT
         ↓
   Re-subscribe to /user/queue/*
         ↓
   Resume session from store
         ↓
   Resume frame streaming
   ✅ Seamless reconnection


10. END SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    User clicks "End Session"
         ↓
    useGazeStream.stop() → stop requestAnimationFrame
         ↓
    SessionManager.endSession()
         ↓
    Publish to /app/gaze.session.end:
    ┌───────────────────────────────────┐
    │ {                                 │
    │   "sessionId": "uuid-123",        │
    │   "frameCount": 3600,             │
    │   "featureCount": 245,            │
    │   "durationMs": 60000,            │
    │   "metrics": {                    │
    │     "avgFixationDuration": 180,   │
    │     "readingPace": 58.5           │
    │   }                               │
    │ }                                 │
    └───────────────────────────────────┘
         ↓
    Backend receives, finalizes session
         ↓
    store.endSession() → clear session from state
         ↓
    UI shows session summary
    ✅ Session complete
```

## Message Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        REACT FRONTEND                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DyslexiaDetectionApp.tsx                               │   │
│  │  ├─ useWebSocketConnection()  → Connect/Disconnect     │   │
│  │  ├─ useGazeStream()           → Publish frames @ 60Hz   │   │
│  │  ├─ useFeaturePublisher()     → Publish features        │   │
│  │  ├─ useServerResponses()      → Handle responses        │   │
│  │  └─ useGazeStore()            → State management        │   │
│  └─────────────────────────────────────────────────────────┘   │
│            ↓ (OUTGOING)         ↑ (INCOMING)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  STOMP Client (WebSocket)                               │   │
│  │  • SockJS transport                                     │   │
│  │  • JWT in CONNECT headers                              │   │
│  │  • Auto-reconnect on close                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│            ↓                    ↑                                │
└─────────────────────────────────────────────────────────────────┘
           |                      |
   [STOMP PROTOCOL]      [STOMP PROTOCOL]
           |                      |
           ↓                      ↑
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     JAVA SPRING BACKEND                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  STOMP Endpoints (@MessageMapping)                      │   │
│  │  • /app/gaze.frame       ← frame data                   │   │
│  │  • /app/gaze.feature     ← detected features            │   │
│  │  • /app/gaze.session.*   ← session management           │   │
│  └─────────────────────────────────────────────────────────┘   │
│            ↓                   ↑                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Message Processing                                     │   │
│  │  • Validate frames                                      │   │
│  │  • Store in database                                    │   │
│  │  • Send ACK to /user/queue/ack                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│            ↓                   ↑                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ML Pipeline (Async)                                    │   │
│  │  • Process gaze frames                                  │   │
│  │  • Run dyslexia model                                   │   │
│  │  • Generate risk assessment                             │   │
│  │  • Publish to /user/queue/result                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│            ↑                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Error Handler                                          │   │
│  │  • Catch exceptions                                     │   │
│  │  • Log errors                                           │   │
│  │  • Send to /user/queue/errors                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Frame Timing (60Hz)

```
Time →
├─ 0ms    ├─ 16.7ms  ├─ 33ms    ├─ 50ms    ├─ 66.7ms  ├─ 83.3ms  ├─ 100ms
│         │          │          │          │          │          │
Frame 1   Frame 2    Frame 3    Frame 4    Frame 5    Frame 6    Frame 7
│         │          │          │          │          │          │
└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
         Send          Send         Send       Send       Send

Every frame:
1. requestAnimationFrame called (~16.7ms)
2. Check: connected? session? not rate-limited?
3. Create GazeFrameDto
4. Publish to /app/gaze.frame
5. Increment frameCount

Result: ~60 frames/sec (if all conditions met)

If rate-limited:
├─ ACK arrives with status='RATE_LIMITED'
├─ store.metrics.rateLimited = true
├─ useGazeStream skips sending next 50% of frames
└─ Reduces to ~30 FPS until server recovers
```

## State Flow (Zustand Store)

```
useGazeStore
│
├─ connectionStatus: DISCONNECTED → CONNECTING → CONNECTED
│
├─ session: null → { sessionId, frameCount, featureCount, ... }
│
├─ metrics:
│  ├─ framesPerSecond: updated every 60 frames
│  ├─ latencyMs: from ACK timestamp
│  ├─ framesDropped: from ACK
│  └─ rateLimited: from ACK status
│
├─ latestResult: null → MLResultPayload (real-time ML result)
│  ├─ riskLevel: LOW | MODERATE | HIGH
│  ├─ riskScore: 0-100
│  └─ features: { fixationStability, saccadePattern, ... }
│
└─ debug:
   ├─ framesSent: incremented on each publish
   ├─ framesDropped: from ACK
   ├─ resultsReceived: incremented on each result
   ├─ errorsReceived: incremented on each error
   └─ reconnectCount: incremented on reconnect
```

---

**Visual Flow**: Complete user experience from login to results  
**Message Format**: All STOMP payloads shown  
**Timing**: 60Hz frame streaming with backoff handling  
**State**: Zustand store updates throughout pipeline
