# 🔐 AUTHENTICATION FIX FOR BACKEND - Frontend Changes

## Problem
Backend logs show: `✗ Frame received with no authenticated user`

Despite frontend sending Authorization header with every frame, the backend's WebSocketAuthInterceptor is not extracting the user from the JWT token for STOMP frame messages.

## Root Cause
The JWT token needs to be properly extracted and made available to the backend's `StompHeaderAccessor` so that `extractUsername()` in the Java controller can find it.

## Frontend Fix Applied

### Changes to `src/api/wsClient.ts`

#### 1. **Added JWT Username Extraction**
```typescript
private extractUsernameFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(decoded);
    return payload.sub || payload.username || payload.user || null;
  } catch {
    return null;
  }
}
```

#### 2. **Enhanced CONNECT Headers**
Added multiple authentication headers to the STOMP CONNECT frame:
```typescript
connectHeaders: {
  'Authorization': `Bearer ${tokens.accessToken}`,
  'login': username || 'anonymous',
  'passcode': '',
  'X-Username': username || 'unknown',
  'X-Auth-Token': `Bearer ${tokens.accessToken}`,
}
```

#### 3. **Added Headers to Every Frame**
Now every published message includes:
```typescript
headers['Authorization'] = `Bearer ${tokens.accessToken}`;
headers['X-Auth-Token'] = `Bearer ${tokens.accessToken}`;
if (username) {
  headers['X-Username'] = username;
}
```

#### 4. **Improved Logging**
- Shows extracted username in connection logs
- Tracks which user is sending frames

## What This Enables

The backend can now:
1. Extract the JWT from the Authorization header in frame messages
2. Parse the JWT to get the username (from `sub`, `username`, or `user` claim)
3. Attach the user to the Principal in StompHeaderAccessor
4. Successfully authenticate frames with `extractUsername()`

## Backend Changes Required

The WebSocketAuthInterceptor needs to be updated to:

1. **Extract JWT from Message Headers**
```java
String authHeader = accessor.getFirstNativeHeader("Authorization");
if (authHeader != null && authHeader.startsWith("Bearer ")) {
  String token = authHeader.substring(7);
  // Validate token and extract username
  String username = extractUsernameFromToken(token);
  // Create/attach Principal to accessor
}
```

2. **Support Multiple Auth Header Names**
Check for `Authorization`, `X-Auth-Token`, or `X-Username` headers

3. **Handle All STOMP Commands**
Apply auth extraction for SEND, SUBSCRIBE, etc. (not just CONNECT)

## Verification

### Frontend Console Should Show:
```
[STOMP] Connecting with user: [username] token: eyJhbGci...
[STOMP] Client activated for user: [username]
[STOMP] Publishing to /app/gaze.frame (repeated)
```

### Backend Should Show:
```
✓ Received gaze frame from [username] ← SHOULD APPEAR
✓ Received gaze frame from [username]
✓ Received gaze frame from [username]
```

(Currently showing `✗ Frame received with no authenticated user` because WebSocketAuthInterceptor doesn't extract JWT from frame headers)

## Next Steps

1. ✅ Frontend sending JWT in all required headers (COMPLETE)
2. 🔴 Backend needs to extract JWT from frame headers (IN PROGRESS)
3. 🔴 Backend needs to attach extracted user to Principal (IN PROGRESS)
4. 🔴 Test end-to-end authentication (PENDING)

## Files Modified

- [src/api/wsClient.ts](src/api/wsClient.ts) - Added JWT extraction, enhanced auth headers, improved logging
