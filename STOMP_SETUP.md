# STOMP Implementation - Setup & Configuration

## Installation

### 1. Install Dependencies

```bash
npm install @stomp/stompjs sockjs-client axios uuid zustand
# or with yarn
yarn add @stomp/stompjs sockjs-client axios uuid zustand
```

### 2. Environment Configuration

Create `.env` file in project root:

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=http://localhost:8080/ws/gaze

# Optional: Debug mode
REACT_APP_DEBUG=true
REACT_APP_LOG_LEVEL=debug
```

For production:

```bash
# Production URLs (HTTPS/WSS)
REACT_APP_API_URL=https://api.dyslexia-detection.com
REACT_APP_WS_URL=wss://api.dyslexia-detection.com/ws/gaze

# Auth endpoints
REACT_APP_AUTH_LOGIN_URL=/api/auth/login
REACT_APP_AUTH_REFRESH_URL=/api/auth/refresh

# Feature flags
REACT_APP_ENABLE_AUTO_RECONNECT=true
REACT_APP_ENABLE_RATE_LIMITING=true
```

## File Structure

```
src/
├── api/                          # Backend communication
│   ├── types.ts                  # DTO type definitions
│   ├── authService.ts            # JWT authentication
│   ├── wsClient.ts               # STOMP WebSocket client
│   └── sessionManager.ts         # Session lifecycle
├── store/
│   └── gazeStore.ts              # Zustand state management
├── hooks/                        # React hooks
│   ├── useWebSocketConnection.ts # Connection lifecycle
│   ├── useGazeStream.ts          # 60Hz frame streaming
│   ├── useFeaturePublisher.ts    # Feature detection publishing
│   └── useServerResponses.ts     # ACK/result/error handling
├── components/
│   ├── ConnectionStatus.tsx      # Connection indicator
│   ├── SessionControls.tsx       # Start/stop UI
│   ├── LiveMetricsPanel.tsx      # Real-time metrics
│   ├── RiskIndicator.tsx         # ML result display
│   ├── DebugPanel.tsx            # System diagnostics
│   └── DyslexiaDetectionApp.tsx  # Integration example
└── pages/
    └── DetectionPage.tsx         # Main page
```

## Configuration Options

### Authentication

```typescript
// src/api/authService.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Configure token storage preference
// Memory (default) → secure, fast, lost on refresh
// localStorage → persists across refresh, vulnerable to XSS
// HttpOnly cookie → most secure, managed by backend (recommended)
```

### WebSocket Connection

```typescript
// src/api/wsClient.ts
class StompWebSocketClient {
  private maxReconnectAttempts = 10;         // Max retry attempts
  private reconnectDelay = 3000;              // Initial delay (3s)
  private heartbeatIncoming = 10000;          // Server → client heartbeat
  private heartbeatOutgoing = 10000;          // Client → server heartbeat
}
```

### Gaze Streaming

```typescript
// src/hooks/useGazeStream.ts
const DEFAULT_TARGET_FPS = 60;                // Frame rate
const FRAME_TIME_MS = 1000 / DEFAULT_TARGET_FPS;  // 16.7ms between frames

// Override in usage:
useGazeStream({ 
  enabled: true,
  targetFps: 30,  // Reduce for low-bandwidth scenarios
  onFrame: (frame) => console.log(frame),
  onError: (error) => console.error(error),
});
```

### State Management

```typescript
// src/store/gazeStore.ts
const resultHistoryMaxSize = 100;  // Keep last N results
const uptimeUpdateInterval = 1000;  // Update uptime every 1s
```

## Security Configuration

### Secure Token Management

```typescript
// ✅ SECURE: Memory storage with localStorage fallback
export const getStoredTokens = (): AuthTokens | null => {
  if (tokenCache) return tokenCache;  // Fast path
  
  const stored = localStorage.getItem('auth_tokens');
  return stored ? JSON.parse(stored) : null;
};

// Clear on logout
authService.logout();  // Clears memory + localStorage
stompClient.disconnect();
```

### HTTPS/WSS in Production

```typescript
// Use wss:// for encrypted WebSocket
const WS_URL = process.env.REACT_APP_WS_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'wss://api.example.com/ws/gaze'
    : 'ws://localhost:8080/ws/gaze');
```

### CORS Configuration

```typescript
// Backend should configure CORS
// Example: Spring Boot
@Configuration
public class CorsConfig {
  @Bean
  public WebMvcConfigurer corsConfigurer() {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
          .allowedOrigins("https://dyslexia-app.com")
          .allowedMethods("GET", "POST", "PUT", "DELETE")
          .allowCredentials(true)
          .maxAge(3600);
      }
    };
  }
}
```

## Backend Integration Requirements

### STOMP Broker Setup

```java
// Spring WebSocket Configuration
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  
  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    // Enable simple broker for /user and /topic destinations
    config.enableSimpleBroker("/user", "/topic");
    
    // Set prefix for messages that app will handle
    config.setApplicationDestinationPrefixes("/app");
    
    // Set prefix for user-specific queues
    config.setUserDestinationPrefix("/user");
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry
      .addEndpoint("/ws/gaze")
      .setAllowedOrigins("*")  // Configure for production
      .withSockJS();
  }
}
```

### Authentication Handler

```java
@Component
public class WebSocketAuthenticator implements ChannelInterceptor {
  
  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
    
    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      String token = accessor.getFirstNativeHeader("Authorization");
      
      // Validate JWT token
      if (isValidToken(token)) {
        accessor.setUser(new JwtUserPrincipal(token));
      } else {
        throw new SecurityException("Invalid token");
      }
    }
    
    return message;
  }
}
```

### Message Handling

```java
@RestController
@MessageMapping("/gaze")
public class GazeController {
  
  @MessageMapping("/frame")
  @SendToUser("/queue/ack")
  public AckPayload handleGazeFrame(
    @Payload GazeFrameDto frame,
    Principal principal
  ) {
    String sessionId = frame.getSessionId();
    
    // Validate frame
    if (!isValidFrame(frame)) {
      return new AckPayload(frame.getFrameId(), "DROPPED", /* ... */);
    }
    
    // Process frame (store, ML inference, etc.)
    frameService.processFrame(frame, principal.getName());
    
    // Send ACK
    return new AckPayload(frame.getFrameId(), "RECEIVED", /* ... */);
  }
  
  @MessageMapping("/session.start")
  @SendToUser("/queue/ack")
  public void startSession(
    @Payload SessionStartPayload payload,
    Principal principal
  ) {
    sessionService.createSession(payload, principal.getName());
  }
  
  @MessageMapping("/feature")
  @SendToUser("/queue/ack")
  public void handleFeature(
    @Payload FeaturePayloadDto feature,
    Principal principal
  ) {
    featureService.recordFeature(feature, principal.getName());
  }
  
  @MessageMapping("/session.end")
  @SendToUser("/queue/ack")
  public void endSession(
    @Payload SessionEndPayload payload,
    Principal principal
  ) {
    sessionService.finishSession(payload, principal.getName());
  }
}
```

### ML Result Publishing

```java
@Service
public class MLResultService {
  
  @Autowired
  private SimpMessagingTemplate messagingTemplate;
  
  public void publishResult(MLResultPayload result, String userId) {
    // Send result to user's queue
    messagingTemplate.convertAndSendToUser(
      userId,
      "/queue/result",
      result
    );
  }
  
  public void publishError(ErrorPayload error, String userId) {
    messagingTemplate.convertAndSendToUser(
      userId,
      "/queue/errors",
      error
    );
  }
}
```

## Monitoring & Diagnostics

### Log Level Configuration

```typescript
// Enable debug logging
if (process.env.REACT_APP_DEBUG === 'true') {
  console.log('[STOMP] Debug mode enabled');
  stompClient.debug = (msg) => console.log('[STOMP]', msg);
}
```

### Performance Metrics

```typescript
// Monitor in DebugPanel or custom component
const metrics = {
  framesPerSecond: store.metrics.framesPerSecond,
  latencyMs: store.metrics.latencyMs,
  droppedFrames: store.debug.framesDropped,
  reconnectCount: store.debug.reconnectCount,
};
```

### Error Tracking

```typescript
// Integrate with error tracking service
import { captureException } from '@sentry/react';

useServerResponses({
  onError: (error) => {
    if (error.severity === 'ERROR' || error.severity === 'FATAL') {
      captureException(new Error(error.message), {
        tags: { category: 'gaze-streaming' },
      });
    }
  },
});
```

## Deployment Checklist

- [ ] Change API/WS URLs to production endpoints
- [ ] Enable HTTPS/WSS
- [ ] Configure CORS on backend
- [ ] Set up JWT token refresh
- [ ] Configure rate limiting (backend)
- [ ] Enable database persistence for sessions
- [ ] Set up ML model inference pipeline
- [ ] Configure monitoring/alerting
- [ ] Test reconnection scenarios
- [ ] Load test with multiple concurrent users
- [ ] Document backend API for team
- [ ] Set up CI/CD for automatic deployment

## Troubleshooting

### Connection Issues

```typescript
// Enable verbose logging
stompClient.debug = (msg) => console.log('[DEBUG]', msg);

// Check network tab in browser DevTools
// Verify WebSocket URL: ws:// or wss://
// Check JWT token expiration
// Verify CORS headers in response
```

### Frame Rate Issues

```typescript
// Monitor actual vs target FPS
useEffect(() => {
  const interval = setInterval(() => {
    console.log('FPS:', store.metrics.framesPerSecond);
    console.log('Latency:', store.metrics.latencyMs, 'ms');
    console.log('Dropped:', store.debug.framesDropped);
  }, 5000);
  return () => clearInterval(interval);
}, [store]);
```

### Token Expiration

```typescript
// Check if token needs refresh
if (isTokenExpired()) {
  authService.refreshToken().then(() => {
    stompClient.forceReconnect();
  });
}
```

## Performance Optimization Tips

1. **Reduce Frame Rate** for low-bandwidth connections:
   ```typescript
   useGazeStream({ targetFps: 30 });
   ```

2. **Batch Features** instead of publishing individually:
   ```typescript
   // Collect 10 features or 500ms, then send batch
   ```

3. **Monitor Latency** and adjust:
   ```typescript
   if (metrics.latencyMs > 500) {
     // Reduce FPS or batch size
   }
   ```

4. **Use SockJS Fallback** for WebSocket unavailability:
   ```typescript
   // Already configured in wsClient.ts
   ```

5. **Cache Session Data** locally:
   ```typescript
   localStorage.setItem('current-session', JSON.stringify(session));
   ```

---

**Version**: 1.0.0  
**Last Updated**: 2026-05-04
