# ML Result Handling & UI Update Pipeline
## Complete 8-Phase Implementation Guide

**Status**: ✅ Production Ready  
**Last Updated**: 2026-05-04  
**Version**: 1.0.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
3. [Architecture Diagram](#architecture-diagram)
4. [API Reference](#api-reference)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide covers the **complete ML result handling pipeline** - receiving real-time dyslexia detection results from your backend via STOMP WebSocket and updating the UI smoothly without flickering or performance issues.

### What You'll Get

✅ STOMP subscriptions to all result queues  
✅ JSON parsing with full validation  
✅ State management with result history  
✅ Beautiful UI components with smooth animations  
✅ Comprehensive error handling  
✅ JWT security verification  
✅ Auto-reconnect and resubscription  

### Key Files

```
src/api/
├── resultProcessor.ts ........... Phase 1-2: Parse & validate results
├── resultHistoryManager.ts ...... Phase 3: Optimized history storage

src/hooks/
├── useSmoothResultUpdate.ts ..... Phase 5: Smooth animations
├── useResultResubscriber.ts ..... Phase 8: Reconnect & resubscribe

src/components/
├── RiskIndicator.tsx ............ Phase 4: Display risk level
├── MetricsPanel.tsx ............. Phase 4: Display detailed metrics
├── ErrorHandler.tsx ............. Phase 6: Show errors/warnings
├── MLResultPipelineExample.tsx .. Phase 1-8: Full integration
```

---

## 🚀 Phase-by-Phase Implementation

### PHASE 1: STOMP Subscription ✅

**Goal**: Subscribe to result queues after WebSocket connects

**Implementation**:

```typescript
// Automatic via useResultResubscriber hook
import { useResultResubscriber } from '@/hooks/useResultResubscriber';

export function MyComponent() {
  const { resubscribe, isSubscribed } = useResultResubscriber({
    onResubscribed: () => console.log('✅ Subscribed to results'),
    onError: (error) => console.error('❌ Subscription failed:', error),
  });

  return (
    <div>
      Status: {isSubscribed() ? '🟢 Listening' : '🔴 Not listening'}
    </div>
  );
}
```

**Key Destinations**:

```
/user/queue/result  ← ML results from backend
/user/queue/ack     ← Acknowledgments (frame received)
/user/queue/errors  ← Error messages
```

**What Happens**:

1. WebSocket connects with JWT in STOMP headers
2. On connection status = 'CONNECTED'
3. Hook automatically subscribes to all 3 queues
4. Backend can now send messages
5. On reconnect: auto-resubscribes

---

### PHASE 2: Result Handler & Parsing ✅

**Goal**: Parse, validate, and normalize ML results

**Implementation**:

```typescript
import { processResult } from '@/api/resultProcessor';

const rawJson = JSON.stringify(resultFromBackend);

const processed = processResult(rawJson, previousResult);

// processed = {
//   original: MLResultPayload,
//   normalized: MLResultPayload (with values clamped to valid ranges),
//   isValid: boolean,
//   errors: ValidationError[],
//   warnings: string[],
//   insights: ResultInsight[],
// }

if (!processed.isValid) {
  console.error('Validation failed:', processed.errors);
  return;
}

if (processed.warnings.length > 0) {
  console.warn('Anomalies detected:', processed.warnings);
}
```

**Validation Rules**:

```
✓ riskScore: 0-100
✓ riskLevel: 'LOW' | 'MODERATE' | 'HIGH'
✓ confidence: 0-1
✓ All feature metrics: 0-1
✓ Required fields: sessionId, timestamp, frameId, classification
```

**What It Does**:

1. Parses JSON string
2. Validates all required fields
3. Checks value ranges
4. Clamps values to valid ranges (normalization)
5. Extracts insights (improvement, concerns, recommendations)
6. Detects anomalies (extreme jumps, suspicious patterns)

---

### PHASE 3: State Management ✅

**Goal**: Store results efficiently without memory bloat

**Implementation**:

```typescript
import { useGazeStore } from '@/store/gazeStore';
import { getResultHistoryManager } from '@/api/resultHistoryManager';

// Access latest result
const store = useGazeStore();
const latest = store.latestResult; // Current ML result

// Access history
const manager = getResultHistoryManager();
const history = manager.getAll(); // All results (max 100)
const last10 = manager.getLast(10); // Last 10 results
const previous = manager.getPrevious(); // For comparison

// Get statistics
const stats = manager.getStats();
console.log(stats);
// {
//   totalResults: 45,
//   averageRiskScore: 35.2,
//   highestRiskScore: 78.5,
//   lowestRiskScore: 12.3,
//   riskTrend: 'improving',
//   averageConfidence: 0.92
// }

// Timeline for graphing
const timeline = manager.getTimeline(20); // Last 20 with timestamps

// Filter operations
const highRiskResults = manager.filterByRiskLevel('HIGH');
const recentResults = manager.filterByTimeRange(60000); // Last 1 minute
```

**Memory Management**:

- Stores only last 100 results (automatic trimming)
- No memory leaks (bounded history)
- Efficient filtering and statistics

---

### PHASE 4: UI Components ✅

**Goal**: Display results beautifully

**Components Available**:

#### RiskIndicator

```typescript
import { RiskIndicator } from '@/components/RiskIndicator';

// Shows:
// - Risk level (LOW/MODERATE/HIGH) with color coding
// - Risk score progress bar (0-100%)
// - Feature breakdown (4 metrics)
// - Confidence level
// - Recommendations
// - Last update timestamp

export function MyDashboard() {
  return <RiskIndicator />;
}
```

#### MetricsPanel

```typescript
import { MetricsPanel } from '@/components/MetricsPanel';

// Shows:
// - Fixation Stability with description
// - Saccade Pattern quality
// - Reading Speed index
// - Comprehension index
// - Summary stats (strongest/weakest metrics)
// - Detailed breakdowns

export function MyAnalytics() {
  return <MetricsPanel />;
}
```

#### ErrorHandler

```typescript
import { ErrorHandler, useErrorHandler } from '@/components/ErrorHandler';

export function MyApp() {
  const { errors, addError } = useErrorHandler();

  const handleBackendError = (errorPayload) => {
    addError({
      errorCode: errorPayload.errorCode,
      message: errorPayload.message,
      timestamp: Date.now(),
      severity: 'WARNING', // or 'ERROR' or 'FATAL'
    });
  };

  return (
    <>
      <ErrorHandler errors={errors} autoDismiss={true} />
      {/* Your components */}
    </>
  );
}
```

---

### PHASE 5: Smooth Updates ✅

**Goal**: No flickering, no jank, smooth transitions

**Implementation**:

```typescript
import { useSmoothResultUpdate, useAnimatedMetric } from '@/hooks/useSmoothResultUpdate';

export function SmoothRiskDisplay() {
  const store = useGazeStore();

  // Smooth overall result updates (debounced)
  const smoothResult = useSmoothResultUpdate(store.latestResult, {
    debounceMs: 100,           // Wait 100ms before updating
    transitionDurationMs: 300, // 300ms smooth transition
    onlyOnChange: true,        // Only update if values actually changed
  });

  // Smooth metric animations
  const { displayValue: animatedScore } = useAnimatedMetric(
    store.latestResult?.riskScore || 0,
    300 // 300ms animation
  );

  return (
    <div>
      <div className="text-4xl font-bold">
        {animatedScore.toFixed(1)}%
      </div>
      {smoothResult.hasChanged && (
        <p className="text-sm text-green-600">✓ Updated</p>
      )}
    </div>
  );
}
```

**Features**:

✅ Debouncing: Prevents re-render spam  
✅ Smooth animations: CSS transitions  
✅ Change detection: Only animate on real changes  
✅ No flickering: Buffered updates  
✅ Performance: 60fps animations  

---

### PHASE 6: Error Handling ✅

**Goal**: Display errors gracefully without stopping the session

**Implementation**:

```typescript
import { useServerResponses } from '@/hooks/useServerResponses';
import { ErrorHandler } from '@/components/ErrorHandler';

export function MySession() {
  const { errors, addError } = useErrorHandler();

  useServerResponses({
    onResult: (result) => {
      console.log('Result received:', result);
    },
    onError: (error) => {
      addError({
        errorCode: error.errorCode,
        message: error.message,
        timestamp: error.timestamp,
        severity: error.severity,
      });

      // Session CONTINUES even on error
      console.warn('Error received but session active');
    },
  });

  return (
    <>
      <ErrorHandler errors={errors} maxVisibleErrors={3} />
      {/* Session continues */}
    </>
  );
}
```

**Error Types**:

```
WARNING  → Yellow toast, auto-dismiss in 8s
ERROR    → Red toast, auto-dismiss in 8s
FATAL    → Red animated toast, requires ACK
```

---

### PHASE 7: JWT Security ✅

**Goal**: Verify JWT is sent in STOMP headers

**Verification**:

```typescript
// JWT is automatically added by wsClient.ts
// When connecting:

const connectHeaders = {
  Authorization: `Bearer ${tokens.accessToken}`,  // ✅ JWT HERE
  'login': '', // Some STOMP servers require this
};

// What the backend receives:
// CONNECT
// Authorization:Bearer eyJhbGc...
// ...
```

**Key Points**:

✅ JWT sent only in STOMP CONNECT headers (never in message body)  
✅ Token automatically refreshed on 401  
✅ Reconnect uses fresh token  
✅ No credentials in logs  
✅ HTTPS/WSS only in production  

---

### PHASE 8: Resilience ✅

**Goal**: Auto-reconnect and resubscribe on disconnect

**Implementation**:

```typescript
import { useResultResubscriber } from '@/hooks/useResultResubscriber';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';

export function ResilientConnection() {
  // Connection management with auto-reconnect
  const { status, connect, disconnect } = useWebSocketConnection({
    autoConnect: true, // Auto-connect on mount
    onConnected: () => console.log('🟢 Connected'),
    onDisconnected: () => console.log('🔴 Disconnected'),
  });

  // Resubscription on reconnect
  const { resubscribe, isSubscribed, getStats } = useResultResubscriber({
    onResubscribed: () => console.log('✅ Resubscribed'),
    enabled: true,
  });

  const stats = getStats();
  console.log(`Reconnects: ${stats.reconnectCount}`);
  console.log(`Subscribed: ${stats.isSubscribed}`);

  return <div>Status: {status}</div>;
}
```

**What Happens on Disconnect**:

1. WebSocket closes
2. Connection status → 'RECONNECTING'
3. Auto-retry after 3s (exponential backoff)
4. Token refreshed before reconnect
5. On connect: auto-resubscribe to all queues
6. Resume receiving messages

**Reconnect Strategy**:

```
Attempt 1: +500ms
Attempt 2: +1000ms
Attempt 3: +2000ms
...
Max 10 attempts
```

---

## 🏗️ Architecture Diagram

```
BACKEND (Spring Boot)
│
├─ STOMP Broker @ /ws/gaze
│  │
│  ├─ Receives JWT in CONNECT headers ✓
│  │
│  ├─ Receives frames @ /app/gaze.frame
│  │
│  └─ Sends results @ /user/queue/result
│
│
FRONTEND (React)
│
├─ [PHASE 7] WebSocket Connection
│  │ JWT: Bearer {token}
│  │ URL: wss://api.example.com/ws/gaze
│  │ Auto-reconnect: ✓
│
├─ [PHASE 1] STOMP Subscriptions
│  ├─ /user/queue/result ← ML Results
│  ├─ /user/queue/ack ← Confirmations
│  └─ /user/queue/errors ← Errors
│
├─ [PHASE 2] Result Processor
│  │ JSON Parse → MLResultPayload
│  │ Validate → Check ranges & types
│  │ Normalize → Clamp values
│  │ Extract → Insights & anomalies
│
├─ [PHASE 3] State Management
│  │ Store in Zustand
│  │ History in ResultHistoryManager
│  │ Bounded to 100 results
│
├─ [PHASE 5] Smooth Updates
│  │ Debounce 100ms
│  │ Animate 300ms
│  │ Only on change
│
├─ [PHASE 4] UI Components
│  │ RiskIndicator
│  │ MetricsPanel
│  │ ErrorHandler
│
├─ [PHASE 6] Error Handling
│  │ Toast notifications
│  │ Auto-dismiss
│  │ User continues session
│
└─ [PHASE 8] Resilience
   Auto-reconnect & resubscribe
```

---

## 📚 API Reference

### `resultProcessor.ts`

```typescript
// Parse raw JSON
parseResultJson(rawJson: string): MLResultPayload | null

// Validate result
validateResult(result: any): ResultValidationError[]

// Normalize values
normalizeResult(result: MLResultPayload): MLResultPayload

// Extract insights
extractInsights(
  result: MLResultPayload,
  previousResult?: MLResultPayload
): ResultInsight[]

// Detect anomalies
detectAnomalies(
  result: MLResultPayload,
  previousResults?: MLResultPayload[]
): string[]

// Full processing
processResult(
  rawJson: string,
  previousResult?: MLResultPayload,
  resultHistory?: MLResultPayload[]
): ProcessedResult
```

### `resultHistoryManager.ts`

```typescript
class ResultHistoryManager {
  addResult(result: MLResultPayload, processingTimeMs?: number): void
  getAll(): MLResultPayload[]
  getLast(n: number): MLResultPayload[]
  getLatest(): MLResultPayload | null
  getPrevious(): MLResultPayload | null
  getTimeline(count?: number): Array<{timestamp, riskScore, sessionId}>
  getStats(): HistoryStats
  filterByRiskLevel(level: string): MLResultPayload[]
  filterByTimeRange(fromMs: number, toMs?: number): MLResultPayload[]
  filterBySessionId(sessionId: string): MLResultPayload[]
  getExtremes(metric: string): {highest, lowest}
  getMovingAverage(windowSize?: number): number[]
  clear(): void
  export(): string
  import(json: string): boolean
}

// Singleton access
const manager = getResultHistoryManager();
```

### `useSmoothResultUpdate.ts`

```typescript
// Smooth result updates
useSmoothResultUpdate(
  latestResult: MLResultPayload | null,
  options?: {
    debounceMs?: number         // Default: 100
    transitionDurationMs?: number // Default: 300
    onlyOnChange?: boolean       // Default: true
  }
): SmoothResultState

// Animate individual metrics
useAnimatedMetric(
  value: number,
  duration?: number,
  decimals?: number
): {displayValue, isAnimating}

// Animated color transitions
useAnimatedColorForValue(
  value: number,
  thresholds?: {low, moderate, high}
): {color, transitionClass}

// Batch multiple updates
useBatchResultUpdates(
  results: MLResultPayload[],
  batchSizeMs?: number
): MLResultPayload[]
```

### `useResultResubscriber.ts`

```typescript
useResultResubscriber(options?: {
  onResultsRestored?: (count: number) => void
  onResubscribed?: () => void
  onError?: (error: Error) => void
  enabled?: boolean
}): {
  resubscribe: () => void
  isSubscribed: () => boolean
  getStats: () => {reconnectCount, isSubscribed, isConnected}
}
```

---

## 💡 Usage Examples

### Example 1: Basic Result Display

```typescript
import { RiskIndicator } from '@/components/RiskIndicator';
import { useResultResubscriber } from '@/hooks/useResultResubscriber';

export function BasicExample() {
  // Auto-resubscribe on reconnect
  useResultResubscriber({ enabled: true });

  return (
    <div>
      <h1>ML Results</h1>
      <RiskIndicator />
    </div>
  );
}
```

### Example 2: Custom Processing

```typescript
import { processResult } from '@/api/resultProcessor';
import { useGazeStore } from '@/store/gazeStore';
import { useEffect } from 'react';

export function CustomProcessing() {
  const store = useGazeStore();

  useEffect(() => {
    if (!store.latestResult) return;

    const processed = processResult(
      JSON.stringify(store.latestResult),
      store.latestResult // previous
    );

    if (processed.isValid) {
      // Use insights
      processed.insights.forEach(insight => {
        console.log(`[${insight.severity}] ${insight.message}`);
      });
    } else {
      // Handle errors
      console.error('Invalid result:', processed.errors);
    }
  }, [store.latestResult]);

  return <div>Processing complete</div>;
}
```

### Example 3: History Analysis

```typescript
import { getResultHistoryManager } from '@/api/resultHistoryManager';
import { useEffect, useState } from 'react';

export function HistoryAnalysis() {
  const [stats, setStats] = useState(null);
  const manager = getResultHistoryManager();

  useEffect(() => {
    const interval = setInterval(() => {
      const newStats = manager.getStats();
      setStats(newStats);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <p>Trend: {stats?.riskTrend}</p>
      <p>Average Risk: {stats?.averageRiskScore.toFixed(1)}%</p>
    </div>
  );
}
```

### Example 4: Complete Integration

See `MLResultPipelineExample.tsx` for a working example of all 8 phases together.

---

## ✅ Best Practices

### 1. **Error Handling**

```typescript
// ✅ Good: Catch and handle gracefully
const processed = processResult(json);
if (!processed.isValid) {
  console.warn('Validation failed but continuing:', processed.errors);
}

// ❌ Bad: Silent failure
const processed = processResult(json);
```

### 2. **State Updates**

```typescript
// ✅ Good: Use Zustand store
store.setLatestResult(result);

// ❌ Bad: useState in every component
const [result, setResult] = useState(null);
```

### 3. **Debouncing**

```typescript
// ✅ Good: Debounce rapid updates
useSmoothResultUpdate(result, { debounceMs: 100 });

// ❌ Bad: Update on every frame
store.setLatestResult(result); // Called 60 times/sec
```

### 4. **Memory Management**

```typescript
// ✅ Good: Use ResultHistoryManager (bounded to 100)
manager.addResult(result);

// ❌ Bad: Store all results in useState
const [all, setAll] = useState([]); // Unbounded growth
```

### 5. **Security**

```typescript
// ✅ Good: JWT in headers only
connectHeaders: { Authorization: `Bearer ${token}` }

// ❌ Bad: JWT in message body
publish('/app/gaze.frame', { token, frame })
```

---

## 🔍 Troubleshooting

### "Results not arriving"

```typescript
// 1. Check connection
const isConnected = stompClient.isConnected();
console.log('Connected:', isConnected);

// 2. Check subscriptions
const { isSubscribed, getStats } = useResultResubscriber();
console.log('Subscribed:', isSubscribed());
console.log('Stats:', getStats());

// 3. Check backend logs for errors
// The backend should show subscription confirmations
```

### "Validation keeps failing"

```typescript
// Check what's failing
const processed = processResult(json);
console.log('Errors:', processed.errors);
// {
//   field: 'riskScore',
//   message: 'Invalid riskScore: must be 0-100, got 105'
// }

// Backend is sending invalid values - fix backend!
```

### "Flickering on updates"

```typescript
// Use smooth updates
const smooth = useSmoothResultUpdate(result, {
  debounceMs: 100,
  transitionDurationMs: 300,
});

// Don't update state multiple times per second
if (smooth.hasChanged) {
  updateUI(smooth.current);
}
```

### "High memory usage"

```typescript
// Check history size
const manager = getResultHistoryManager();
console.log('History size:', manager.getSize()); // Should be ≤ 100

// If > 100, manually clear
manager.clear();
```

### "Reconnecting loops"

```typescript
// Check network
const stats = getStats();
console.log('Reconnects:', stats.reconnectCount);

// Check backend connectivity
curl https://your-backend/ws/gaze

// Check JWT expiration
console.log('Token valid:', authService.isAuthenticated());
```

---

## 📊 Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Result latency | < 100ms | > 200ms |
| UI update debounce | 100ms | - |
| Animation duration | 300ms | - |
| Subscription time | < 500ms | > 1000ms |
| Memory (history) | < 10MB | > 20MB |
| Reconnect attempts | < 5/min | > 10/min |

---

## 🚀 Deployment Checklist

- [ ] JWT tokens configured correctly
- [ ] Backend sending results to `/user/queue/result`
- [ ] All error types defined
- [ ] Monitoring/logging configured
- [ ] Rate limiting tested
- [ ] Reconnection tested (kill backend, restart)
- [ ] Memory usage monitored
- [ ] UI animations smooth (60fps)

---

**Version**: 1.0.0  
**Status**: Production Ready ✅  
**Last Updated**: 2026-05-04

For questions, see the full implementation at `MLResultPipelineExample.tsx`.
