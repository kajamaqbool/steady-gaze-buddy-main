# STOMP Implementation - Production Deployment Checklist

## 🚀 Pre-Deployment Verification

### Dependencies Installed ✅
- [ ] Run `npm install` successfully
- [ ] No installation errors
- [ ] node_modules/ directory created
- [ ] package-lock.json generated
- [ ] All required packages present:
  ```
  @stomp/stompjs
  sockjs-client
  axios
  uuid
  zustand
  ```

### Build Configuration ✅
- [ ] Environment variables set (see STOMP_SETUP.md)
  - `REACT_APP_API_URL` = production API URL
  - `REACT_APP_WS_URL` = production WebSocket URL (wss://)
- [ ] Run `npm run build` successfully
- [ ] Build output in `dist/` folder
- [ ] No build warnings or errors
- [ ] Build size reasonable (<500KB gzipped recommended)

### Code Quality ✅
- [ ] Run `npm run lint` - no critical errors
- [ ] Review console.log statements - remove debug code
- [ ] Check for console.warn/error - handle gracefully
- [ ] Type checking passes (`tsc --noEmit`)
- [ ] No TypeScript errors

### Testing ✅
- [ ] Unit tests pass: `npm run test`
- [ ] Integration tests pass (if implemented)
- [ ] Manual testing on localhost:
  - [ ] Login flow works
  - [ ] WebSocket connects
  - [ ] Frames streaming
  - [ ] ML results displaying
  - [ ] Error handling works
  - [ ] Reconnection works (stop backend, restart)

---

## 🔐 Security Checklist

### Authentication ✅
- [ ] JWT token stored in memory (not localStorage for sensitive apps)
- [ ] Token refresh working on 401
- [ ] Logout clears all tokens
- [ ] No credentials in code/comments
- [ ] No credentials in environment files (use .env.local)
- [ ] No API keys exposed

### HTTPS/WSS ✅
- [ ] `REACT_APP_API_URL` starts with `https://`
- [ ] `REACT_APP_WS_URL` starts with `wss://` (not ws://)
- [ ] SSL certificate valid (not self-signed in production)
- [ ] HTTPS redirect configured on server

### CORS & Headers ✅
- [ ] Backend CORS configured for your domain
- [ ] `Access-Control-Allow-Origin` header correct
- [ ] Authorization header allowed
- [ ] Content-Type header allowed

### API Security ✅
- [ ] JWT token validation on backend
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (if using SQL)
- [ ] No sensitive data in logs

---

## 📊 Performance Checklist

### Bundle Size ✅
- [ ] Production build: `npm run build`
- [ ] Main bundle < 500KB gzipped
- [ ] Vendor bundle < 300KB
- [ ] Run `npm install --save-dev webpack-bundle-analyzer` to check
- [ ] Tree-shaking enabled in vite.config.ts

### Runtime Performance ✅
- [ ] Frame rate target: 60 FPS (check LiveMetricsPanel)
- [ ] Memory usage stable (check DevTools)
- [ ] No memory leaks (keep app running, monitor memory)
- [ ] Latency < 100ms typical (check metrics.latencyMs)
- [ ] No jank or stuttering during streaming

### Network ✅
- [ ] WebSocket connection stable
- [ ] No excessive retries (check reconnectCount)
- [ ] ACK latency acceptable
- [ ] Packet loss near zero (check framesDropped)
- [ ] Bandwidth usage reasonable (~50-200 Kbps at 60 FPS)

---

## 🔧 Backend Integration Checklist

### STOMP Broker Setup ✅
- [ ] STOMP broker running
- [ ] WebSocket endpoint at `/ws/gaze` (or configured URL)
- [ ] SockJS fallback enabled
- [ ] Heartbeat configured
- [ ] Message size limit set appropriately

### Authentication Handler ✅
- [ ] JWT validation on STOMP CONNECT
- [ ] Principal context set for each user
- [ ] Token expiration handled
- [ ] Unauthorized connections rejected

### Message Handlers ✅
- [ ] `/app/gaze.frame` handler implemented
  - [ ] Receives GazeFrameDto
  - [ ] Validates frame
  - [ ] Stores in database
  - [ ] Sends ACK to `/user/queue/ack`
- [ ] `/app/gaze.feature` handler implemented
  - [ ] Receives FeaturePayloadDto
  - [ ] Stores features
  - [ ] Sends ACK
- [ ] `/app/gaze.session.start` handler
  - [ ] Creates session record
  - [ ] Returns ACK
- [ ] `/app/gaze.session.end` handler
  - [ ] Finalizes session
  - [ ] Returns ACK

### ML Pipeline ✅
- [ ] Receives frames asynchronously
- [ ] Processes frames (inference)
- [ ] Generates ML results
- [ ] Publishes to `/user/queue/result`
- [ ] Handles model errors gracefully
- [ ] Publishes errors to `/user/queue/errors` if needed

### Error Handling ✅
- [ ] Validation errors handled
- [ ] Rate limiting with ACK status
- [ ] Server errors logged
- [ ] Errors sent to `/user/queue/errors`
- [ ] Circuit breaker for failed operations

### Monitoring ✅
- [ ] Logging implemented for all messages
- [ ] Error tracking (e.g., Sentry)
- [ ] Performance metrics collected
- [ ] Alerts configured for failures

---

## 📈 Monitoring & Observability

### Logging ✅
- [ ] Enable structured logging in production
- [ ] Log level set to INFO (not DEBUG)
- [ ] Log frames: connection, session start/end, errors
- [ ] Sanitize logs (no tokens/PII)
- [ ] Logs aggregated (e.g., ELK stack)

### Metrics ✅
- [ ] Metrics collected:
  - [ ] FPS average
  - [ ] Latency p50, p95, p99
  - [ ] Error rate
  - [ ] Reconnection rate
  - [ ] ML result count/sec
- [ ] Metrics dashboard configured
- [ ] Alerts set for thresholds:
  - [ ] FPS < 30
  - [ ] Latency > 500ms
  - [ ] Error rate > 1%
  - [ ] Reconnects > 5/min

### Tracing ✅
- [ ] Request tracing enabled (e.g., Jaeger)
- [ ] Session ID propagated through logs
- [ ] Backend traces WebSocket messages
- [ ] Frontend captures timing data

---

## 🧪 Load Testing

### Before Deployment ✅
- [ ] Load test with expected concurrent users
- [ ] Test frame streaming at high volume
- [ ] Monitor server resources during load
- [ ] Check for memory leaks
- [ ] Verify error handling under stress
- [ ] Test reconnection under load

### Tools ✅
- [ ] Use Apache JMeter or similar for STOMP load tests
- [ ] Simulate 60 FPS × N concurrent users
- [ ] Monitor:
  - [ ] CPU usage
  - [ ] Memory usage
  - [ ] Network bandwidth
  - [ ] Frame drop rate
  - [ ] Latency percentiles

---

## 📱 Browser Compatibility

### Desktop Browsers ✅
- [ ] Chrome/Chromium (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)

### Mobile Browsers ✅
- [ ] Chrome Mobile (if supporting mobile)
- [ ] Safari iOS (if supporting iOS)
- [ ] Firefox Android (if supporting Android)

### Fallback Support ✅
- [ ] SockJS fallback enabled (for browsers without native WebSocket)
- [ ] Test in Safari iOS (sometimes needs fallback)
- [ ] Test in restrictive networks

---

## 🚨 Failure Scenarios

### Test These Scenarios ✅
1. **Network Loss**
   - [ ] Stop internet, app should reconnect
   - [ ] Resume after reconnect
   - [ ] No data loss

2. **Backend Crash**
   - [ ] Backend stops, frontend shows error
   - [ ] Frontend attempts reconnect
   - [ ] Recovers when backend restarts

3. **Token Expiration**
   - [ ] Let token expire during session
   - [ ] Token refresh triggered automatically
   - [ ] Session continues seamlessly

4. **Rate Limiting**
   - [ ] Backend triggers rate limit
   - [ ] ACK sent with RATE_LIMITED status
   - [ ] Frontend reduces FPS
   - [ ] No frame loss after adjustment

5. **ML Model Failure**
   - [ ] Model fails to process frame
   - [ ] Backend sends error to `/user/queue/errors`
   - [ ] Frontend handles gracefully
   - [ ] Session continues

6. **Session Timeout**
   - [ ] Session exceeds time limit
   - [ ] Backend ends session
   - [ ] Frontend receives notification
   - [ ] User can start new session

---

## 📋 Deployment Steps

### 1. Prepare Environment
```bash
# Set production environment variables
export REACT_APP_API_URL=https://api.production.com
export REACT_APP_WS_URL=wss://api.production.com/ws/gaze
export NODE_ENV=production
```

### 2. Build
```bash
npm run build
# Output in dist/ folder
```

### 3. Test Build Locally
```bash
npm run preview
# Visit http://localhost:4173
# Test login, connection, streaming
```

### 4. Deploy
```bash
# Deploy dist/ folder to CDN or static hosting
# Examples:
# - AWS S3 + CloudFront
# - Vercel/Netlify
# - Traditional web server
# - Docker container
```

### 5. Post-Deployment Verification
```bash
# Test in production environment
1. Visit production URL
2. Login with test account
3. Verify WebSocket connects (check browser DevTools)
4. Start session
5. Verify frames streaming (check Network tab)
6. Wait for ML results
7. Check metrics/errors in dashboard
8. Monitor for 24 hours before full rollout
```

### 6. Rollback Plan
- [ ] Keep previous version deployed (blue-green)
- [ ] Monitor error rate in first hour
- [ ] Be ready to rollback if:
  - [ ] Error rate > 5%
  - [ ] WebSocket success rate < 99%
  - [ ] Critical bugs discovered

---

## 🔄 Continuous Integration/Deployment

### CI/CD Pipeline ✅
- [ ] GitHub Actions (or equivalent) configured
- [ ] Runs on every commit:
  - [ ] `npm install`
  - [ ] `npm run lint`
  - [ ] `npm run test`
  - [ ] `npm run build`
- [ ] Build succeeds before merge
- [ ] Deploy script configured
- [ ] Automatic deployment on main branch

### Example GitHub Actions Workflow
```yaml
name: Deploy STOMP Frontend

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - name: Deploy to production
        run: |
          # Your deploy script here
          aws s3 sync dist/ s3://your-bucket/
```

---

## 📞 On-Call Runbook

### Common Issues & Fixes

**Problem: "WebSocket not connecting"**
```
1. Check REACT_APP_WS_URL is correct (wss://)
2. Verify backend is running
3. Check browser console for specific error
4. Verify CORS headers in response
5. Check firewall/proxy allows WebSocket
```

**Problem: "High error rate"**
```
1. Check backend logs for errors
2. Check database connectivity
3. Check ML model status
4. Monitor CPU/memory on backend
5. Check network latency
```

**Problem: "Frames not streaming"**
```
1. Verify WebSocket connected
2. Verify session started
3. Check frontend console for errors
4. Check backend frame handler
5. Verify gaze tracking data available
```

**Problem: "Latency > 500ms"**
```
1. Check network latency (ping backend)
2. Check backend processing time
3. Monitor ML model inference time
4. Check database query performance
5. Consider reducing frame rate
```

---

## ✅ Final Checklist

Before going live:
- [ ] All code reviewed and tested
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Monitoring configured
- [ ] Team trained on deployment
- [ ] Rollback plan in place
- [ ] Documentation updated
- [ ] Support contacts configured
- [ ] Go-live approval from stakeholders
- [ ] Deployment window scheduled

---

**Status**: Ready to deploy ✅  
**Last Updated**: 2026-05-04  
**Maintenance**: Review quarterly or after major updates
