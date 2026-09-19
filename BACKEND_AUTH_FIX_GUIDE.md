# 🔧 BACKEND FIX REQUIRED - WebSocket Authentication

## Problem Statement
Frontend is sending JWT in frame headers, but backend's `WebSocketAuthInterceptor` is not extracting it for STOMP messages (only for initial CONNECT).

Result: `✗ Frame received with no authenticated user` for every gaze frame

## Root Cause
The `WebSocketAuthInterceptor` only handles the initial STOMP CONNECT frame. Subsequent messages (SEND, SUBSCRIBE, etc.) are not processed to extract the JWT from the Authorization header.

## Solution

### 1. Update WebSocketAuthInterceptor

**File**: `edu.ai.dyslexiaprisonbackend.config.WebSocketAuthInterceptor`

#### Current Code (Incomplete)
```java
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
    String command = accessor.getCommand() != null ? accessor.getCommand().getCommandName() : null;
    
    if (StompCommand.CONNECT.getCommandName().equals(command)) {
      // ✓ Currently handles CONNECT
      String token = accessor.getFirstNativeHeader("Authorization");
      // ... extract and validate JWT
    }
    // ✗ Missing: Handle SEND, SUBSCRIBE, etc.
    
    return message;
  }
}
```

#### Updated Code (Complete)
```java
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
  private static final Logger logger = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);
  private final JwtTokenProvider jwtTokenProvider; // Your JWT provider
  
  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
    StompCommand command = accessor.getCommand();
    
    if (command == null) {
      return message;
    }
    
    // Extract JWT from headers - supports multiple header names
    String token = extractTokenFromHeaders(accessor);
    
    if (token != null) {
      try {
        // Validate and parse JWT
        Claims claims = jwtTokenProvider.getClaimsFromToken(token); // or your method
        String username = claims.getSubject(); // or claims.get("username")
        
        // Create/attach Principal for all commands
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
          username, 
          null, 
          new ArrayList<>() // authorities
        );
        auth.setDetails(new WebAuthenticationDetails(HttpServletRequest)); // optional
        
        // Attach to accessor so it's available in controller
        accessor.setUser(auth);
        
        logger.debug("Authenticated user {} for STOMP command {}", username, command.getCommandName());
        
      } catch (ExpiredJwtException e) {
        logger.warn("JWT token expired");
        accessor.setUser(null);
      } catch (JwtException e) {
        logger.warn("Invalid JWT token: {}", e.getMessage());
        accessor.setUser(null);
      }
    } else {
      logger.debug("No JWT token found in headers for command {}", command.getCommandName());
      accessor.setUser(null);
    }
    
    return message;
  }
  
  /**
   * Extract JWT from multiple header sources
   */
  private String extractTokenFromHeaders(StompHeaderAccessor accessor) {
    // Try Authorization header first
    String authHeader = accessor.getFirstNativeHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    
    // Try X-Auth-Token header as backup
    String xAuthToken = accessor.getFirstNativeHeader("X-Auth-Token");
    if (xAuthToken != null && xAuthToken.startsWith("Bearer ")) {
      return xAuthToken.substring(7);
    }
    
    // Try plain token in other headers
    String token = accessor.getFirstNativeHeader("token");
    if (token != null && !token.isBlank()) {
      return token;
    }
    
    return null;
  }
}
```

### 2. Update GazeController

**File**: `edu.ai.dyslexiaprisonbackend.controller.websocket.GazeController`

#### Current extractUsername() (Incomplete)
```java
private String extractUsername(Principal principal, StompHeaderAccessor accessor) {
  if (principal != null) {
    String name = principal.getName();
    if (name != null && !name.isBlank()) {
      return name;
    }
  }
  
  if (accessor != null) {
    Principal user = accessor.getUser();
    if (user != null) {
      String name = user.getName();
      if (name != null && !name.isBlank()) {
        return name;
      }
    }
  }
  
  return null;  // ← Problem: Still null because accessor.getUser() is null
}
```

#### Updated extractUsername() (Enhanced)
```java
private String extractUsername(Principal principal, StompHeaderAccessor accessor) {
  // Strategy 1: Direct principal injection (works for some frameworks)
  if (principal != null) {
    String name = principal.getName();
    if (name != null && !name.isBlank()) {
      return name;
    }
  }
  
  // Strategy 2: Extract from StompHeaderAccessor
  // ✓ NOW works because WebSocketAuthInterceptor attaches user
  if (accessor != null) {
    Principal user = accessor.getUser();
    if (user != null) {
      String name = user.getName();
      if (name != null && !name.isBlank()) {
        return name;
      }
    }
    
    // Strategy 3: Fallback - extract from X-Username header directly
    String username = accessor.getFirstNativeHeader("X-Username");
    if (username != null && !username.isBlank()) {
      return username;
    }
  }
  
  return null;
}
```

### 3. Verify Configuration

**File**: `WebSocketConfig.java`

Ensure the interceptor is registered:
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  
  @Autowired
  private WebSocketAuthInterceptor authInterceptor;
  
  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    // Register the interceptor for ALL inbound messages
    registration.interceptors(authInterceptor);
  }
}
```

## Expected Flow After Fix

```
Frontend sends frame with headers:
{
  Authorization: "Bearer eyJhbGci...",
  X-Auth-Token: "Bearer eyJhbGci...",
  X-Username: "john_doe"
}

WebSocketAuthInterceptor.preSend():
1. Extract token from Authorization header
2. Validate JWT
3. Parse claims to get username (e.g., "john_doe")
4. Create UsernamePasswordAuthenticationToken
5. Attach to accessor.setUser()

GazeController.handleGazeFrame():
1. Call extractUsername(principal, accessor)
2. accessor.getUser() returns authenticated token ✓
3. user.getName() returns "john_doe" ✓
4. Frame processed successfully!

Backend logs:
✓ Received gaze frame from john_doe: frameId=..., confidence=...
✓ Received gaze frame from john_doe: frameId=..., confidence=...
```

## Testing

### Test Case 1: Authentication Success
```
Input: Frame with valid JWT in Authorization header
Expected: ✓ Received gaze frame from [username]
```

### Test Case 2: Expired Token
```
Input: Frame with expired JWT
Expected: ⚠️ JWT token expired, request denied
```

### Test Case 3: Invalid Token
```
Input: Frame with malformed JWT
Expected: ⚠️ Invalid JWT token, request denied
```

### Test Case 4: No Token
```
Input: Frame with no Authorization header
Expected: ✗ Frame received with no authenticated user (acceptable for now)
```

## Deployment Steps

1. ✅ **Frontend**: Deploy updated `wsClient.ts` (COMPLETE)
2. 🔴 **Backend**: Update `WebSocketAuthInterceptor` (PENDING)
3. 🔴 **Backend**: Update `GazeController.extractUsername()` (PENDING)
4. 🔴 **Backend**: Verify `WebSocketConfig` (PENDING)
5. 🔴 **Backend**: Deploy and restart (PENDING)
6. 🔴 **Test**: Run end-to-end test with real client (PENDING)

## Rollback Plan

If the backend changes cause issues:
1. The frontend changes are backward compatible
2. Simply revert the `WebSocketAuthInterceptor` changes
3. Frontend will continue sending auth headers (harmless if not processed)

## Questions for Backend Team

- Where is `JwtTokenProvider` or JWT validation logic located?
- What is the structure of your JWT tokens (claims)?
- Is there an existing JWT filter/interceptor for HTTP that we can mirror?
- Should unauthenticated frames be rejected (403) or just logged as warnings?
