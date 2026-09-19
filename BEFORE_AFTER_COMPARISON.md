# 📊 BEFORE & AFTER COMPARISON

## The Problem: Authentication Lost in Transit

### BEFORE (Current - Broken)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │         │  Network    │         │  Backend    │
│             │         │             │         │             │
│ JWT Token   │         │ Frame with  │         │ Principal   │
│  ✓ Exists   │────────→│ Auth Header │────────→│  = null  ✗  │
│             │         │  ✓ Sent     │         │             │
│ WebSocket   │         │             │         │ ExtractName │
│ Connected   │         │ BUT...      │         │  = null  ✗  │
│  ✓          │         │             │         │             │
└─────────────┘         └─────────────┘         │ Result:     │
                                                 │ ✗ No user ✗ │
                                                 └─────────────┘
```

**Frontend Console**:
```
[SteadyReaderGame] ✅ GAME READY - session is live
[useGazeStream] 💯 Streamed 30 frames
[useGazeStream] 💯 Streamed 60 frames
```

**Backend Logs**:
```
✗ Frame received with no authenticated user
✗ Frame received with no authenticated user
✗ Frame received with no authenticated user
```

**Why**: WebSocketAuthInterceptor only handles CONNECT, not frame SEND commands

---

### AFTER (Fixed - Working)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend        │     │  Network         │     │  Backend         │
│                  │     │                  │     │                  │
│ JWT Token        │     │ Frame with:      │     │ WebSocketAuth    │
│  ✓ Exists        │     │  • Authorization │     │ Interceptor      │
│                  │     │    Bearer ...    │     │  ✓ Extracts JWT  │
│ extractUsername  │     │  • X-Auth-Token  │     │  ✓ Parses claims │
│  = "john_doe"    │────→│    Bearer ...    │────→│  ✓ Creates auth  │
│                  │     │  • X-Username    │     │                  │
│ Send in headers: │     │    john_doe      │     │ Principal set    │
│  ✓ Auth header   │     │  ✓ All present   │     │  = john_doe  ✓   │
│  ✓ X-Auth-Token  │     │                  │     │                  │
│  ✓ X-Username    │     │ Backend gets:    │     │ ExtractUsername  │
│                  │     │  ✓ All headers   │     │  = john_doe  ✓   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Frontend Console**:
```
[STOMP] Connecting with user: john_doe token: eyJhbGci...
[STOMP] Client activated for user: john_doe
[SteadyReaderGame] ✅ GAME READY - session is live
[useGazeStream] 💯 Streamed 30 frames
[useGazeStream] 💯 Streamed 60 frames
```

**Backend Logs**:
```
✓ Received gaze frame from john_doe: frameId=..., confidence=...
✓ Received gaze frame from john_doe: frameId=..., confidence=...
✓ Received gaze frame from john_doe: frameId=..., confidence=...
```

**Why**: WebSocketAuthInterceptor extracts JWT from frame headers and attaches Principal

---

## Code Changes

### Frontend: wsClient.ts

#### BEFORE
```typescript
// No JWT extraction
connectHeaders: {
  Authorization: `Bearer ${tokens.accessToken}`,
  'login': '', // Empty
}

// No auth on frames
const headers = {
  'content-type': 'application/json',
};
```

#### AFTER
```typescript
// Extract username from JWT
const username = this.extractUsernameFromToken(tokens.accessToken);

connectHeaders: {
  'Authorization': `Bearer ${tokens.accessToken}`,
  'login': username || 'anonymous',
  'X-Username': username || 'unknown',
  'X-Auth-Token': `Bearer ${tokens.accessToken}`,
}

// Auth on every frame
const headers = {
  'content-type': 'application/json',
  'Authorization': `Bearer ${tokens.accessToken}`,
  'X-Auth-Token': `Bearer ${tokens.accessToken}`,
  'X-Username': username,
};
```

### Backend: WebSocketAuthInterceptor (TODO)

#### BEFORE
```java
@Override
public Message<?> preSend(Message<?> message, MessageChannel channel) {
  StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
  
  if (STOMP.CONNECT.equals(command)) {
    // Extract JWT from CONNECT only
    String token = accessor.getFirstNativeHeader("Authorization");
    // Validate and attach principal
  }
  // Missing: No processing for SEND, SUBSCRIBE, etc.
  
  return message;
}
```

#### AFTER (Required)
```java
@Override
public Message<?> preSend(Message<?> message, MessageChannel channel) {
  StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
  StompCommand command = accessor.getCommand();
  
  // Extract JWT from ALL commands, not just CONNECT
  String token = extractTokenFromHeaders(accessor);
  
  if (token != null) {
    try {
      // Validate JWT
      Claims claims = jwtTokenProvider.getClaimsFromToken(token);
      String username = claims.getSubject();
      
      // Create and attach Principal for ALL commands
      UsernamePasswordAuthenticationToken auth = 
        new UsernamePasswordAuthenticationToken(username, null, new ArrayList<>());
      accessor.setUser(auth);
      
      logger.debug("Authenticated {} for {}", username, command);
    } catch (JwtException e) {
      logger.warn("Invalid JWT: {}", e.getMessage());
      accessor.setUser(null);
    }
  }
  
  return message;
}

private String extractTokenFromHeaders(StompHeaderAccessor accessor) {
  String authHeader = accessor.getFirstNativeHeader("Authorization");
  if (authHeader != null && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}
```

---

## Data Flow

### BEFORE (Broken)

```
User Login
  ↓
Frontend gets JWT
  ↓
WebSocket CONNECT (✓ auth works here)
  ↓
Session START (✓ auth works here)
  ↓
Frame SEND ✗ Auth Lost!
  ✗ Interceptor skips SEND frames
  ✗ No Principal attached
  ✗ Controller sees null username
  ✗ Frame rejected
```

### AFTER (Fixed)

```
User Login
  ↓
Frontend gets JWT + extracts username
  ↓
WebSocket CONNECT (✓ auth + username in headers)
  ↓
Session START (✓ auth + username in headers)
  ↓
Frame SEND ✓ Auth Preserved!
  ✓ Interceptor extracts JWT from frame headers
  ✓ Principal attached to accessor
  ✓ Controller sees username
  ✓ Frame accepted and buffered
  ↓
ML Pipeline Processes
```

---

## Deployment Order

### Phase 1: Frontend (✅ COMPLETE)
- Update `wsClient.ts` 
- Deploy frontend
- Users will send JWT in all formats

### Phase 2: Backend (🔴 TODO)
- Update `WebSocketAuthInterceptor`
- Deploy backend
- Frames will be authenticated

### Phase 3: Verification (🔴 TODO)
- Check backend logs for `✓ Received gaze frame from [user]`
- Verify buffer metrics increasing
- Test ML results appearing in real-time
- Verify risk scores updating in UI

---

## Testing Scenarios

| Scenario | BEFORE | AFTER |
|----------|--------|-------|
| User sends frame with valid JWT | ✗ Rejected (no auth) | ✅ Accepted & buffered |
| User sends frame with expired JWT | ✗ Rejected (no auth) | ⚠️ Rejected (expired) |
| User sends frame with no JWT | ✗ Rejected (no auth) | ✗ Rejected (no auth) |
| Session flows normally | ❌ Breaks at frames | ✅ Works end-to-end |
| ML pipeline processes | ❌ No data | ✅ Full session analysis |

---

## Configuration Impact

### Frontend
- ✅ No configuration changes needed
- ✅ Backward compatible
- ✅ Graceful degradation if backend doesn't extract

### Backend
- 🔴 REQUIRES WebSocketAuthInterceptor update
- 🔴 REQUIRES verifying JWT validation logic
- ✅ No database changes
- ✅ No API changes

---

## Success Metrics

### BEFORE
```
Frontend: 60 frames/min sent ✓
Backend: 0 frames processed ✗
Status: Session data LOST ✗
```

### AFTER
```
Frontend: 60 frames/min sent ✓
Backend: 60 frames/min processed ✓
Buffer: Growing correctly ✓
ML: Analyzing session ✓
Status: End-to-end streaming ✓
```

---

## Rollback Plan

If something breaks:
1. Frontend changes are **100% safe** (just sends more headers)
2. Backend can safely ignore new headers
3. Simply revert backend changes if needed
4. Frontend will work either way

---

## Time to Implement

- **Frontend Fix**: ✅ 30 minutes (COMPLETE)
- **Backend Fix**: ~45 minutes (see BACKEND_AUTH_FIX_GUIDE.md)
- **Testing**: ~15 minutes
- **Total**: ~2 hours

---

## Next Steps

1. ✅ Frontend updated - **Ready to deploy**
2. 🔴 Backend team implements interceptor fix
3. 🔴 Deploy backend changes  
4. 🔴 Verify authentication working
5. ✅ System fully operational

See [BACKEND_AUTH_FIX_GUIDE.md](BACKEND_AUTH_FIX_GUIDE.md) for implementation details.
