# 🚨 AUTHENTICATION ISSUE - ROOT CAUSE & SOLUTION

## Current Status

### Frontend ✅ COMPLETE
- WebSocket connection established
- Session created and streaming frames
- **JWT token is being sent with every frame** ✓

### Backend 🔴 INCOMPLETE  
- Frames arriving at controller
- **JWT not being extracted from frame headers** ✗
- Result: `✗ Frame received with no authenticated user`

---

## Root Cause Analysis

### What's Happening

```
Frontend sends frame:
{
  destination: "/app/gaze.frame",
  headers: {
    Authorization: "Bearer eyJhbGci...",
    X-Auth-Token: "Bearer eyJhbGci...",
    X-Username: "john_doe"
  },
  body: { frameId, timestamp, gazeX, gazeY, ... }
}
```

```
Backend receives in GazeController:
- principal = null (because JWT is not in standard HTTP format)
- accessor.getUser() = null (because WebSocketAuthInterceptor doesn't extract it)
- Result: extractUsername() returns null
- Error: "✗ Frame received with no authenticated user"
```

### Why This Happens

The `WebSocketAuthInterceptor` currently **only processes the initial STOMP CONNECT frame**. It doesn't process subsequent messages (SEND, SUBSCRIBE, etc.), so it never extracts the JWT from frame headers.

```java
// Current: Only handles CONNECT
if (StompCommand.CONNECT.getCommandName().equals(command)) {
  // Extract JWT and attach to principal
}
// Missing: Handle SEND (frames) and other commands
```

---

## Solution Summary

### Frontend (✅ COMPLETED)

**Updated `src/api/wsClient.ts`** to:
1. Extract username from JWT token
2. Send JWT in multiple header formats:
   - `Authorization: Bearer ...`
   - `X-Auth-Token: Bearer ...`
   - `X-Username: john_doe`
3. Include these headers in **both** CONNECT and every frame message

**Result**: JWT is now guaranteed to reach the backend with every frame.

### Backend (🔴 REQUIRED)

**Update `WebSocketAuthInterceptor`** to:
1. Extract JWT from frame headers (not just CONNECT)
2. Validate and parse the JWT
3. Create `UsernamePasswordAuthenticationToken` from the JWT claims
4. Attach it to `StompHeaderAccessor.setUser()` for **all commands**

**Result**: When `GazeController.extractUsername()` is called, it will find the authenticated user.

---

## Files & Next Steps

### ✅ Frontend Changes (COMPLETE)
- [src/api/wsClient.ts](src/api/wsClient.ts) - JWT extraction + auth headers

### 📖 Documentation Created
- [FRONTEND_AUTH_FIX.md](FRONTEND_AUTH_FIX.md) - Frontend solution details
- [BACKEND_AUTH_FIX_GUIDE.md](BACKEND_AUTH_FIX_GUIDE.md) - **Complete backend fix with code samples**

### 🔴 Backend Changes (REQUIRED)

**Files to Update**:
1. `WebSocketAuthInterceptor.java` - Extract JWT from frame headers
2. `GazeController.java` - Enhanced extractUsername() fallback
3. `WebSocketConfig.java` - Verify interceptor registration

**See**: [BACKEND_AUTH_FIX_GUIDE.md](BACKEND_AUTH_FIX_GUIDE.md) for complete code

---

## Quick Test Checklist

### Before Backend Fix
```
❌ Frontend: gaze frames publishing
❌ Backend: ✗ Frame received with no authenticated user
```

### After Backend Fix
```
✅ Frontend: gaze frames publishing with JWT
✅ Backend: ✓ Received gaze frame from john_doe
✅ Backend: Buffer accumulating frames
✅ Backend: ML pipeline processing session
✅ Frontend: Risk scores updating in UI
```

---

## Key Files

| File | Status | Purpose |
|------|--------|---------|
| [src/api/wsClient.ts](src/api/wsClient.ts) | ✅ FIXED | JWT extraction + auth headers |
| [FRONTEND_AUTH_FIX.md](FRONTEND_AUTH_FIX.md) | 📖 Guide | What changed in frontend |
| [BACKEND_AUTH_FIX_GUIDE.md](BACKEND_AUTH_FIX_GUIDE.md) | 📖 Guide | **Backend implementation guide** |
| WebSocketAuthInterceptor.java | 🔴 TODO | Extract JWT from all frames |
| GazeController.java | 🔴 TODO | Already has fallbacks, just needs interceptor |

---

## Success Criteria

✅ When you see this in backend logs:
```
2026-05-04T23:11:00+05:30 INFO  GazeController : ✓ Received gaze frame from john_doe: frameId=..., confidence=...
2026-05-04T23:11:00+05:30 INFO  GazeController : ✓ Received gaze frame from john_doe: frameId=..., confidence=...
2026-05-04T23:11:00+05:30 INFO  GazeController : ✓ Received gaze frame from john_doe: frameId=..., confidence=...
```

✅ And frontend console shows:
```
[STOMP] 📤 Publishing to /app/gaze.frame
[useGazeStream] 💯 Streamed 30 frames
```

✅ And UI shows:
```
Risk Score: 0.34 (updating in real-time)
Frames Received: 150
```

**Then the system is working end-to-end! 🎉**

---

## Support

- **Frontend questions**: See [FRONTEND_AUTH_FIX.md](FRONTEND_AUTH_FIX.md)
- **Backend questions**: See [BACKEND_AUTH_FIX_GUIDE.md](BACKEND_AUTH_FIX_GUIDE.md)
- **Architecture**: See [FRONTEND_FIXES_SUMMARY.md](FRONTEND_FIXES_SUMMARY.md)
