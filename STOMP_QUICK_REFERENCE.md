# STOMP Implementation - File Structure & Quick Reference

## 📁 Project Structure

```
src/
├── api/                          ← Backend communication layer
│   ├── types.ts                  ← DTO definitions (11 types)
│   ├── authService.ts            ← JWT login + axios interceptor
│   ├── wsClient.ts               ← STOMP client (SockJS + JWT)
│   └── sessionManager.ts         ← Session start/end
│
├── store/
│   └── gazeStore.ts              ← Zustand state (connection, metrics, results)
│
├── hooks/                        ← React hooks (all the logic)
│   ├── useWebSocketConnection.ts ← Connect/disconnect + auto-reconnect
│   ├── useGazeStream.ts          ← 60Hz frame streaming
│   ├── useFeaturePublisher.ts    ← Publish fixations, saccades, etc
│   └── useServerResponses.ts     ← Handle ACK, results, errors
│
├── components/                   ← React UI components
│   ├── ConnectionStatus.tsx      ← Connection indicator
│   ├── SessionControls.tsx       ← Start/stop buttons
│   ├── LiveMetricsPanel.tsx      ← Real-time FPS, latency
│   ├── RiskIndicator.tsx         ← ML result display
│   ├── DebugPanel.tsx            ← System diagnostics
│   └── DyslexiaDetectionApp.tsx  ← Complete integration example
│
└── [existing code...]
```

## 📚 Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| **STOMP_SUMMARY.md** | Executive summary + quick start | 5 min |
| **STOMP_IMPLEMENTATION.md** | Architecture + message flows | 15 min |
| **STOMP_SETUP.md** | Installation + configuration | 15 min |
| **STOMP_RECIPES.md** | Advanced patterns + examples | 20 min |
| **STOMP_API_REFERENCE.md** | Complete API documentation | 20 min |

## 🚀 Quick Start (Choose Your Path)

### Path A: "Show Me the Code" (5 minutes)
1. Open `src/components/DyslexiaDetectionApp.tsx` → See complete integration
2. Copy component to your page
3. Install dependencies: `npm install @stomp/stompjs sockjs-client axios uuid zustand`
4. Set environment variables (see STOMP_SETUP.md)
5. Done! ✅

### Path B: "Understand Everything First" (30 minutes)
1. Read STOMP_SUMMARY.md → Get overview
2. Read STOMP_IMPLEMENTATION.md → Understand architecture
3. Review src/api/wsClient.ts → See STOMP connection
4. Review src/hooks/useGazeStream.ts → See frame streaming
5. Review DyslexiaDetectionApp.tsx → See integration

### Path C: "I'll Customize Everything" (1 hour)
1. Read STOMP_API_REFERENCE.md → Learn all APIs
2. Read STOMP_RECIPES.md → See patterns
3. Create your own hooks/components
4. Integrate with your gaze tracking
5. Test with backend

## 🔌 Integration Checklist

### Step 1: Install Dependencies
```bash
npm install @stomp/stompjs sockjs-client axios uuid zustand
```

### Step 2: Configure Environment
Create `.env`:
```
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=http://localhost:8080/ws/gaze
```

### Step 3: Create Login Page
```tsx
import { authService } from '@/api/authService';

export function LoginPage() {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await authService.login({ 
        username: email, 
        password 
      });
      navigate('/detection');
    }}>
      {/* form fields */}
    </form>
  );
}
```

### Step 4: Add Detection Page
```tsx
import { DyslexiaDetectionApp } from '@/components/DyslexiaDetectionApp';

export function DetectionPage() {
  return <DyslexiaDetectionApp />;
}
```

### Step 5: Update App Routes
```tsx
import { LoginPage } from './pages/LoginPage';
import { DetectionPage } from './pages/DetectionPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/detection" element={<DetectionPage />} />
    </Routes>
  );
}
```

### Step 6: Test Connection
1. Start backend server
2. Run `npm run dev`
3. Login
4. See "Connected" status
5. Click "Start Session"
6. See frames streaming
7. Wait for ML results

## 📖 API Quick Reference

### authService
```typescript
import { authService } from '@/api/authService';

// Login
const tokens = await authService.login({ username, password });

// Check auth
if (authService.isAuthenticated()) { /* show app */ }

// Logout
authService.logout();
```

### stompClient
```typescript
import { stompClient } from '@/api/wsClient';

// Connect
await stompClient.connect();

// Check connection
if (stompClient.isConnected()) { /* stream frames */ }

// Publish
stompClient.publish('/app/gaze.frame', frameData);

// Disconnect
stompClient.disconnect();
```

### SessionManager
```typescript
import SessionManager from '@/api/sessionManager';

// Start
const sessionId = await SessionManager.startSession('task-1', { userId: 'user1' });

// End
await SessionManager.endSession();

// Get summary
const summary = SessionManager.getSessionSummary();
```

### useGazeStream (60Hz)
```typescript
import { useGazeStream } from '@/hooks/useGazeStream';

const { isStreaming, frameCount, start, stop } = useGazeStream({
  enabled: sessionActive,
  targetFps: 60,
  onFrame: (frame) => console.log(frame),
});

// Start streaming
await start();

// Stop streaming
stop();
```

### useFeaturePublisher
```typescript
import { useFeaturePublisher } from '@/hooks/useFeaturePublisher';

const { publishFixation, publishSaccade, publishBlink } = useFeaturePublisher();

// Publish fixation
publishFixation({ duration: 200, x: 0.5, y: 0.3 });

// Publish saccade
publishSaccade({
  duration: 50,
  startX: 0.5, startY: 0.3,
  endX: 0.6, endY: 0.25,
});
```

### useServerResponses
```typescript
import { useServerResponses } from '@/hooks/useServerResponses';

useServerResponses({
  onAck: (ack) => console.log('ACK:', ack.framesReceived),
  onResult: (result) => console.log('Risk:', result.riskLevel),
  onError: (error) => console.error(error.message),
});
```

### useGazeStore (Zustand)
```typescript
import { useGazeStore } from '@/store/gazeStore';

const store = useGazeStore();

// Connection
store.connectionStatus;  // 'CONNECTED' | 'DISCONNECTED' | etc

// Session
store.session;           // { sessionId, frameCount, featureCount, ... }
store.isSessionActive(); // boolean

// Metrics
store.metrics;           // { framesPerSecond, latencyMs, ... }

// Results
store.latestResult;      // { riskLevel, riskScore, ... }

// Debug
store.debug;             // { framesSent, framesDropped, ... }
```

## 🎯 Common Tasks

### Task: Add Gaze Data Source
```typescript
// In useGazeStream.ts, modify createGazeFrame():
const createGazeFrame = () => {
  const data = myGazeTracker.getFrame();
  return {
    frameId: uuid(),
    timestamp: Date.now(),
    gazeX: data.x / window.innerWidth,
    gazeY: data.y / window.innerHeight,
    confidence: data.confidence,
    pupilSize: data.pupilSize,
    validFrame: data.quality > 0.7,
  };
};
```

### Task: Display ML Results
```typescript
// Use RiskIndicator component or create custom:
import { useGazeStore } from '@/store/gazeStore';

export function MyResults() {
  const result = useGazeStore(state => state.latestResult);
  
  if (!result) return <div>Waiting for results...</div>;
  
  return (
    <div>
      <p>Risk Level: {result.riskLevel}</p>
      <p>Score: {result.riskScore}%</p>
      <p>Confidence: {(result.confidence * 100).toFixed(0)}%</p>
    </div>
  );
}
```

### Task: Monitor Performance
```typescript
import { useGazeStore } from '@/store/gazeStore';

export function PerformanceMonitor() {
  const store = useGazeStore();
  
  return (
    <div>
      <p>FPS: {store.metrics.framesPerSecond.toFixed(1)}</p>
      <p>Latency: {store.metrics.latencyMs}ms</p>
      <p>Dropped: {store.debug.framesDropped}</p>
      <p>Connected: {store.connectionStatus}</p>
    </div>
  );
}
```

### Task: Handle Reconnection
```typescript
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';

export function App() {
  useWebSocketConnection({
    autoConnect: true,
    onConnected: () => console.log('Connected!'),
    onDisconnected: () => console.log('Disconnected'),
    onError: (err) => console.error(err),
  });
}
```

## 🧪 Testing

### Test Frame Streaming
```typescript
import { render, waitFor } from '@testing-library/react';
import { DyslexiaDetectionApp } from '@/components/DyslexiaDetectionApp';

test('streams frames at 60Hz', async () => {
  render(<DyslexiaDetectionApp />);
  
  // Simulate login + connection
  // Start session
  // Wait for frames
  
  await waitFor(() => {
    const store = useGazeStore.getState();
    expect(store.debug.framesSent).toBeGreaterThan(10);
  });
});
```

## 🔍 Debugging

### Check Connection Status
```typescript
import { stompClient } from '@/api/wsClient';

console.log('Connected?', stompClient.isConnected());
console.log('Status:', stompClient.getStatus());
console.log('Subscriptions:', stompClient.getSubscriptionCount());
```

### Check Session State
```typescript
import { useGazeStore } from '@/store/gazeStore';

const state = useGazeStore.getState();
console.log('Session:', state.session);
console.log('Frames sent:', state.debug.framesSent);
console.log('Results received:', state.debug.resultsReceived);
```

### Enable Debug Logging
```bash
# In .env
REACT_APP_DEBUG=true
```

## ❌ Troubleshooting

### "WebSocket not connecting"
- [ ] Backend running at correct URL?
- [ ] CORS enabled on backend?
- [ ] Token valid?
- [ ] Check browser console for errors

### "No frames being sent"
- [ ] Gaze stream started? (`stream.start()`)
- [ ] Session created? (`SessionManager.startSession()`)
- [ ] Connected? (`stompClient.isConnected()`)
- [ ] Check `createGazeFrame()` returns valid data

### "No ML results appearing"
- [ ] Backend processing frames?
- [ ] Results publishing to `/user/queue/result`?
- [ ] Check message format matches `MLResultPayload`

### "High latency"
- [ ] Network connection stable?
- [ ] Frame payload too large? (check `GazeFrameDto`)
- [ ] Server overloaded? (check `ack.status === 'RATE_LIMITED'`)

## 📞 Support

### Read These First
1. **Quick problem?** → STOMP_SETUP.md → Troubleshooting
2. **Want to customize?** → STOMP_RECIPES.md → Patterns
3. **Need API docs?** → STOMP_API_REFERENCE.md → All APIs
4. **Architecture question?** → STOMP_IMPLEMENTATION.md → Flows

### Code Examples
See `src/components/DyslexiaDetectionApp.tsx` for:
- Complete integration
- All hooks in use
- Error handling
- UI patterns

## ✅ Implementation Status

| Phase | Status | Files |
|-------|--------|-------|
| 1. Setup | ✅ Complete | types.ts, tsconfig |
| 2. Auth | ✅ Complete | authService.ts |
| 3. STOMP | ✅ Complete | wsClient.ts |
| 4. Session | ✅ Complete | sessionManager.ts, gazeStore.ts |
| 5. Streaming | ✅ Complete | useGazeStream.ts |
| 6. Features | ✅ Complete | useFeaturePublisher.ts |
| 7. Responses | ✅ Complete | useServerResponses.ts |
| 8. UI | ✅ Complete | 6 components |
| 9. Resilience | ✅ Complete | useWebSocketConnection.ts |
| 10. Security | ✅ Complete | authService.ts, wsClient.ts |
| 11. Performance | ✅ Complete | All optimizations |

---

**Status**: Production Ready ✅  
**Files Created**: 15 code files + 5 documentation files  
**Total Code**: ~1500 lines  
**Total Docs**: ~3500 lines  
**Coverage**: 11 phases of STOMP pipeline  
**Ready to Deploy**: Yes ✅

Start with Path A, B, or C above. You're good to go! 🚀
