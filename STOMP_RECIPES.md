# STOMP Integration Guide - Backend Destinations & Examples

## Quick Start

### 1. Login → Connect → Stream (3 minutes)

```tsx
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useGazeStream } from '@/hooks/useGazeStream';
import SessionManager from '@/api/sessionManager';
import { authService } from '@/api/authService';

export function QuickStart() {
  const { connect, isConnected } = useWebSocketConnection();
  const { start } = useGazeStream();

  const handleInitiate = async () => {
    // Step 1: Login
    const tokens = await authService.login({
      username: 'test@example.com',
      password: 'password'
    });

    // Step 2: Connect WebSocket
    await connect();

    // Step 3: Start session and stream
    const sessionId = await SessionManager.startSession('reading-task-001', {
      userId: 'test-user',
      difficulty: 'medium'
    });

    // Step 4: Start gaze frame streaming
    await start();

    console.log('Streaming started:', sessionId);
  };

  return (
    <button onClick={handleInitiate} disabled={isConnected}>
      Initiate Detection
    </button>
  );
}
```

## Destination Recipes

### 1. Custom Frame Processing

If you need to process frames before sending:

```tsx
import { useCallback } from 'react';
import { stompClient } from '@/api/wsClient';
import { useGazeStore } from '@/store/gazeStore';

export function useCustomGazeStream() {
  const store = useGazeStore();

  const sendCustomFrame = useCallback((rawData: any) => {
    if (!stompClient.isConnected()) return;

    const sessionId = store.session?.sessionId;
    if (!sessionId) return;

    // Custom processing
    const processed = {
      frameId: crypto.randomUUID(),
      sessionId,
      timestamp: Date.now(),
      gazeX: rawData.x / window.innerWidth,
      gazeY: rawData.y / window.innerHeight,
      confidence: Math.max(0, rawData.confidence),
      validFrame: rawData.confidence > 0.7,
      // ... other fields
    };

    stompClient.publish('/app/gaze.frame', processed);
    store.incrementFrameCount();
  }, [store]);

  return { sendCustomFrame };
}
```

### 2. Batch Feature Publishing

Send features in batches for efficiency:

```tsx
import { useRef, useEffect } from 'react';
import { stompClient } from '@/api/wsClient';
import { useGazeStore } from '@/store/gazeStore';
import { FeaturePayloadDto } from '@/api/types';

export function useBatchFeaturePublisher() {
  const store = useGazeStore();
  const batchRef = useRef<FeaturePayloadDto[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  const flushBatch = () => {
    if (batchRef.current.length === 0) return;

    const sessionId = store.session?.sessionId;
    if (!sessionId) return;

    stompClient.publish('/app/gaze.features.batch', {
      sessionId,
      features: batchRef.current,
      timestamp: Date.now(),
    });

    batchRef.current = [];
  };

  const addFeature = (feature: Omit<FeaturePayloadDto, 'sessionId'>) => {
    batchRef.current.push(feature as FeaturePayloadDto);

    // Flush when batch reaches 10 or 500ms has passed
    if (batchRef.current.length >= 10) {
      clearTimeout(batchTimeoutRef.current);
      flushBatch();
    } else if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(() => {
        flushBatch();
        batchTimeoutRef.current = undefined;
      }, 500);
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(batchTimeoutRef.current);
      flushBatch();
    };
  }, []);

  return { addFeature };
}
```

### 3. Advanced Result Filtering

Process ML results with custom logic:

```tsx
import { useServerResponses } from '@/hooks/useServerResponses';
import { MLResultPayload } from '@/api/types';
import { useCallback } from 'react';

export function useAdvancedResultHandling() {
  const handleResult = useCallback((result: MLResultPayload) => {
    // Only alert on significant risk changes
    if (result.riskLevel === 'HIGH') {
      // Show urgent alert
      notifyUrgentRisk(result);
    } else if (result.riskLevel === 'MODERATE' && result.riskScore > 70) {
      // Show moderate alert
      notifyModerateRisk(result);
    }

    // Log for analytics
    analytics.trackDyslexiaResult({
      sessionId: result.sessionId,
      riskLevel: result.riskLevel,
      score: result.riskScore,
      features: result.features,
    });

    // Update local cache
    cacheService.saveResult(result);
  }, []);

  useServerResponses({
    onResult: handleResult,
  });
}
```

### 4. Connection Lifecycle Management

Handle reconnections with session recovery:

```tsx
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import SessionManager from '@/api/sessionManager';
import { useGazeStore } from '@/store/gazeStore';
import { useCallback } from 'react';

export function useSessionRecovery() {
  const store = useGazeStore();
  const previousSessionRef = useRef<string | null>(null);

  const handleReconnect = useCallback(async () => {
    const currentSessionId = store.session?.sessionId;

    // If we had an active session before disconnect
    if (currentSessionId && !previousSessionRef.current) {
      previousSessionRef.current = currentSessionId;
      
      // On reconnect: decide whether to resume or restart
      const shouldResume = confirm(
        'Resume previous session or start new?'
      );

      if (shouldResume) {
        // Resume by simply reopening connection
        // (backend tracks this via JWT + sessionId)
        console.log('Resuming session:', currentSessionId);
      } else {
        // Start new session
        await SessionManager.endSession();
        await SessionManager.startSession('reading-task-001');
        previousSessionRef.current = null;
      }
    }
  }, [store.session?.sessionId]);

  useWebSocketConnection({
    autoConnect: true,
    onConnected: handleReconnect,
  });
}
```

### 5. Rate Limit Adaptive Streaming

Dynamically adjust send rate based on server feedback:

```tsx
import { useRef, useCallback, useEffect } from 'react';
import { useServerResponses } from '@/hooks/useServerResponses';
import { AckPayload } from '@/api/types';

export function useAdaptiveFrameRate() {
  const targetFpsRef = useRef(60);
  const dropRateRef = useRef(0);

  const handleAck = useCallback((ack: AckPayload) => {
    if (ack.status === 'RATE_LIMITED') {
      // Server is overloaded, reduce target FPS
      const currentFps = targetFpsRef.current;
      targetFpsRef.current = Math.max(15, currentFps * 0.8); // 80% of current
      console.log('Rate limited, reducing to', targetFpsRef.current, 'FPS');
    } else if (ack.framesDropped === 0 && ack.framesReceived > 100) {
      // Server handling well, can increase slightly
      const currentFps = targetFpsRef.current;
      targetFpsRef.current = Math.min(60, currentFps * 1.05); // 105% of current
    }

    dropRateRef.current = ack.framesDropped;
  }, []);

  useServerResponses({ onAck: handleAck });

  return {
    targetFps: targetFpsRef.current,
    dropRate: dropRateRef.current,
  };
}

// Usage with useGazeStream
export function AdaptiveApp() {
  const { targetFps } = useAdaptiveFrameRate();
  const { start } = useGazeStream({ targetFps });

  useEffect(() => {
    start();
  }, [targetFps, start]);
}
```

### 6. Error Recovery with Exponential Backoff

```tsx
import { useCallback, useRef } from 'react';
import { useServerResponses } from '@/hooks/useServerResponses';
import { ErrorPayload } from '@/api/types';

export function useErrorRecovery() {
  const attemptsRef = useRef(0);
  const backoffRef = useRef(1000);

  const handleError = useCallback((error: ErrorPayload) => {
    attemptsRef.current++;

    if (error.severity === 'FATAL') {
      // Stop streaming, show error
      console.error('Fatal error:', error.message);
      // Trigger UI to show error modal
      showFatalError(error);
    } else if (error.severity === 'ERROR') {
      // Attempt recovery with backoff
      const delay = Math.min(30000, 1000 * Math.pow(2, attemptsRef.current));
      
      setTimeout(async () => {
        try {
          console.log('Attempting recovery after', delay, 'ms');
          // Try to recover (e.g., restart session)
          // Implementation depends on error type
        } catch (err) {
          console.error('Recovery failed:', err);
        }
      }, delay);
    } else if (error.severity === 'WARNING') {
      // Just log and continue
      console.warn('Server warning:', error.message);
      attemptsRef.current = 0; // Reset
    }
  }, []);

  useServerResponses({ onError: handleError });

  return { errorAttempts: attemptsRef.current };
}
```

## Backend Integration Checklist

### Spring Boot + Spring WebSocket Example

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/user", "/topic");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/gaze")
            .setAllowedOrigins("*")
            .withSockJS();
    }
}

@Component
public class GazeMessageHandler {
    @MessageMapping("/gaze.frame")
    public void handleFrame(GazeFrameDto frame, Principal principal, 
                           SimpMessagingTemplate template) {
        // Process frame
        String sessionId = extractSessionId(frame);
        validateFrame(frame);
        
        // Send ACK
        template.convertAndSendToUser(
            principal.getName(),
            "/queue/ack",
            new AckPayload(/* ... */)
        );

        // Process ML (async)
        mlService.processFrame(frame).thenAccept(result -> {
            template.convertAndSendToUser(
                principal.getName(),
                "/queue/result",
                result
            );
        });
    }
}
```

## Testing Examples

### Mock Server for Local Testing

```typescript
import { stompClient } from '@/api/wsClient';

export function setupMockServer() {
  // Intercept publish calls
  const originalPublish = stompClient.publish.bind(stompClient);

  stompClient.publish = jest.fn((destination, body) => {
    // Simulate server responses
    if (destination === '/app/gaze.frame') {
      setTimeout(() => {
        stompClient.subscribe('/user/queue/ack', msg => {
          msg.body = JSON.stringify({
            frameId: body.frameId,
            status: 'RECEIVED',
            framesReceived: Math.random() > 0.1 ? 1 : 0,
            framesDropped: 0,
            timestamp: Date.now(),
          });
        });
      }, 50);
    }
  });

  return () => {
    stompClient.publish = originalPublish;
  };
}
```

### Component Test with Mock

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DyslexiaDetectionApp } from '@/components/DyslexiaDetectionApp';
import { setupMockServer } from '@/test/mocks/stompServer';

describe('DyslexiaDetectionApp', () => {
  beforeEach(() => {
    setupMockServer();
  });

  it('should display ML results after streaming', async () => {
    render(<DyslexiaDetectionApp />);

    // Start session
    userEvent.click(screen.getByText(/Start Session/));

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/Risk Assessment/)).toBeInTheDocument();
    });
  });
});
```

## Performance Profiling

### Monitor Streaming Performance

```tsx
import { useGazeStore } from '@/store/gazeStore';
import { useEffect, useState } from 'react';

export function PerformanceMonitor() {
  const store = useGazeStore();
  const [stats, setStats] = useState({
    avgFps: 0,
    peakLatency: 0,
    droppedFramePercentage: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const session = store.session;
      if (!session) return;

      const avgFps = store.metrics.framesPerSecond;
      const droppedPercent =
        (store.debug.framesDropped / session.frameCount) * 100;

      setStats({
        avgFps: avgFps,
        peakLatency: Math.max(stats.peakLatency, store.metrics.latencyMs),
        droppedFramePercentage: droppedPercent,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [store]);

  return (
    <div>
      <p>Avg FPS: {stats.avgFps.toFixed(1)}</p>
      <p>Peak Latency: {stats.peakLatency.toFixed(0)}ms</p>
      <p>Dropped: {stats.droppedFramePercentage.toFixed(2)}%</p>
    </div>
  );
}
```

---

**Pro Tips:**
- Always handle connection errors gracefully
- Implement exponential backoff for retries
- Monitor latency to detect server issues early
- Batch features when possible for efficiency
- Keep payloads minimal for network efficiency
