# Production Gaze Tracking Pipeline Architecture
## Complete 8-Phase Implementation

**Status:** ✅ All phases complete and ready for integration

---

## Phase Architecture Overview

```
Raw 30Hz Gaze Stream
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: CORE DATA CAPTURE (useEyeTrackingPhase1.ts)            │
│ • Extract gaze from MediaPipe FaceMesh                           │
│ • Compute velocity (vx, vy) between consecutive frames           │
│ • Extract head position & rotation (6DOF)                        │
│ • Generate GazeFrame at 30Hz with absolute timestamps            │
│ Output: Stream<GazeFrame> (~30 fps)                              │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: GAZE PROCESSING (gazeProcessingPhase2.ts)             │
│ • Smooth with moving average (3-frame window)                   │
│ • Interpolate dropped frames (linear)                            │
│ • Remove outliers (Z-score filtering, σ=3)                      │
│ • Optional Kalman filtering for ultra-smooth                    │
│ Output: Denoised GazeFrame[] ready for features                 │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: FEATURE EXTRACTION (featureExtractionPhase3.ts)       │
│ • Detect fixations (spatial clustering, ≥100ms)                 │
│ • Detect saccades (velocity-based, v > 300px/s)                 │
│ • Detect regressions (backward saccades)                         │
│ • Calculate reading speed (WPM)                                  │
│ • Calculate vertical stability (Y std dev)                       │
│ Output: ExtractedFeatures { fixations, saccades, regressions... │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: WORD MAPPING (wordMappingPhase4.ts)                   │
│ • Extract words from DOM [data-word-index]                      │
│ • Map gaze coordinates to nearest word                           │
│ • Track dwell time per word                                      │
│ • Classify as "fixated" or "skipped"                            │
│ Output: WordMapping { word, wordIndex, dwellTime, isFixated }  │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: SESSION METADATA (sessionMetadataPhase5.ts)           │
│ • Record device info (OS, browser, timezone)                    │
│ • Cache screen resolution & DPR                                  │
│ • Store calibration data                                         │
│ • Generate session ID & timestamps                               │
│ Output: SessionData { metadata, device, screen, calibration }  │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: WEBSOCKET STREAMING (webSocketPhase6.ts)              │
│ • Connect to backend (ws://backend/ws/gaze)                     │
│ • Send GAZE_FRAME messages (30 msgs/sec)                        │
│ • Batch FEATURE_UPDATE (every 2-3 seconds)                      │
│ • Handle reconnection (exponential backoff)                      │
│ • Buffer off-line messages                                       │
│ Output: Messages streaming to backend                            │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: QUALITY CONTROL (qualityControlPhase7.ts)             │
│ • Validate tracking confidence (≥70%)                            │
│ • Check face detection rate (≥60%)                               │
│ • Verify vertical/horizontal stability                           │
│ • Confirm minimum saccade count (≥10)                            │
│ • Check regression rate (≤80%)                                   │
│ Output: SessionQuality { isValid, score, failureReasons[] }    │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 8: ML READINESS (mlReadinessPhase8.ts)                   │
│ • Validate feature ranges:                                       │
│   - avgFixationDuration: 100-500ms                              │
│   - regressionRate: 0-100%                                       │
│   - saccadeCount: ≥10                                            │
│   - readingSpeed: 50-600 WPM                                     │
│   - verticalStability: 10-150px                                  │
│ • Check for NaN/Inf values                                       │
│ • Verify temporal consistency (monotonic timestamps)             │
│ Output: MLReadinessReport { isReady, warnings, recommendations } │
└─────────────────────────────────────────────────────────────────┘
        ↓
Backend FastAPI ML Service (Feature Classification)
```

---

## File Inventory & Responsibilities

### Core Types & Interfaces
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/types/gazeFrame.ts` | Base gaze data structure | `GazeFrame`, `Fixation`, `Saccade` |

### Processing Pipeline
| File | Phase | Key Exports |
|------|-------|-------------|
| `src/hooks/useEyeTrackingPhase1.ts` | 1 | `useEyeTracking()` hook, 30Hz sampler |
| `src/lib/gazeProcessingPhase2.ts` | 2 | `smoothGazeFrames()`, `interpolateFrames()`, `removeOutliers()`, `applyKalmanFilter()` |
| `src/lib/featureExtractionPhase3.ts` | 3 | `detectFixations()`, `detectSaccades()`, `extractFeatures()`, `calculateReadingSpeed()` |
| `src/lib/wordMappingPhase4.ts` | 4 | `extractWordsFromDOM()`, `findNearestWord()`, `WordDwellTracker` class |
| `src/lib/sessionMetadataPhase5.ts` | 5 | `DeviceInfo`, `ScreenInfo`, `SessionManager` singleton |
| `src/lib/webSocketPhase6.ts` | 6 | `WebSocketClient` class, message protocol definitions |
| `src/lib/qualityControlPhase7.ts` | 7 | `assessSessionQuality()`, `isSessionValid()`, `getFailureReasons()` |
| `src/lib/mlReadinessPhase8.ts` | 8 | `checkMLReadiness()`, `validateFeatureRanges()`, `MLReadinessReport` |

---

## WebSocket Message Protocol

### 1. SESSION_START (Sent at session initialization)
```json
{
  "type": "SESSION_START",
  "sessionId": "uuid-1234",
  "timestamp": 1704067200000,
  "device": {
    "os": "Windows",
    "browser": "Chrome",
    "userAgent": "Mozilla/5.0..."
  },
  "screen": {
    "viewportWidth": 1920,
    "viewportHeight": 1080,
    "devicePixelRatio": 1.0
  },
  "calibration": {
    "distance": 600,
    "accuracy": 25,
    "points": [...]
  }
}
```

### 2. GAZE_FRAME (Sent at 30 Hz - ~30 messages/second)
```json
{
  "type": "GAZE_FRAME",
  "frameId": 1,
  "timestamp": 1704067200033,
  "elapsedMs": 33,
  "gazeX": 0.5,
  "gazeY": 0.4,
  "velocityX": 0.002,
  "velocityY": 0.001,
  "velocity": 0.0022,
  "headCenterX": 960,
  "headCenterY": 540,
  "headRotationX": 0.05,
  "headRotationY": -0.02,
  "headRotationZ": 0.01,
  "faceDetected": true,
  "eyesOpen": true,
  "confidence": 0.95
}
```

### 3. FEATURE_UPDATE (Sent every 2-3 seconds - aggregated)
```json
{
  "type": "FEATURE_UPDATE",
  "timestamp": 1704067200000,
  "sessionId": "uuid-1234",
  "features": {
    "avgFixationDuration": 250,
    "maxFixationDuration": 800,
    "regressionRate": 0.15,
    "saccadeCount": 45,
    "readingSpeed": 210,
    "verticalStability": 45.2,
    "skippedWordRate": 0.08
  },
  "wordMappings": [
    { "word": "The", "wordIndex": 0, "dwellTime": 180, "isFixated": true },
    { "word": "quick", "wordIndex": 1, "dwellTime": 120, "isFixated": true }
  ]
}
```

### 4. FEATURE_UPDATE + QUALITY (Sent at session end)
```json
{
  "type": "FEATURE_UPDATE",
  "timestamp": 1704067200000,
  "features": {...},
  "quality": {
    "trackingConfidence": 0.85,
    "faceStability": 0.72,
    "verticalDeviation": 42.5,
    "horizontalDeviation": 58.3,
    "jitterAmount": 4.2,
    "skippedWordRate": 0.12,
    "saccadeCount": 125,
    "regressionRate": 0.18,
    "isValid": true,
    "score": 0.8
  },
  "mlReadiness": {
    "isReady": true,
    "warnings": [],
    "recommendations": []
  }
}
```

### 5. SESSION_END (Sent at session conclusion)
```json
{
  "type": "SESSION_END",
  "sessionId": "uuid-1234",
  "timestamp": 1704067200000,
  "duration": 120000,
  "totalFrames": 3600,
  "quality": {...},
  "mlReadiness": {...}
}
```

---

## Data Flow Specification

### Capture Phase (30 Hz Loop)
```
MediaPipe FaceMesh
    ↓ (33ms interval)
Compute velocity & head position
    ↓
Frame ID + absolute timestamp
    ↓
Dynamic confidence score
    ↓
Emit GazeFrame
```

### Processing Phase (Streaming)
```
GazeFrame → Smooth (MA-3) → Interpolate → Remove Outliers → Kalman (optional)
```

### Feature Phase (Every frame)
```
Processed GazeFrame[] → Fixation detection
                     → Saccade detection (velocity-based)
                     → Regression classification (backward saccades)
                     → Reading speed (unique words / time)
                     → Vertical stability (Y σ in pixels)
```

### Word Mapping Phase (Real-time)
```
Per GazeFrame: Find closest word in DOM
            ↓
            Accumulate dwell time
            ↓
            Mark as fixated OR skipped
            ↓
            Tag frame with word index
```

### Session Context
```
SessionManager singleton tracks:
  - sessionId (UUID)
  - startTime (Date.now)
  - device info (OS, browser)
  - screen resolution & calibration
  - running feature aggregates
```

### Quality Gates (7 Validation Points)
```
Before transmission to backend:
  ✓ trackingConfidence ≥ 70%
  ✓ faceStability ≥ 60%
  ✓ verticalDeviation ≤ 100px
  ✓ horizontalDeviation ≤ 150px
  ✓ jitterAmount ≤ 10px
  ✓ saccadeCount ≥ 10
  ✓ regressionRate ≤ 80%
  
  IF ANY FAIL → Block GAZE_FRAME transmission
  Log failure reason for user feedback
```

### ML Readiness Checks (6 Validation Points)
```
Feature space validation:
  ✓ avgFixationDuration ∈ [100ms, 500ms]
  ✓ regressionRate ∈ [0%, 100%]
  ✓ saccadeCount ≥ 10
  ✓ readingSpeed ∈ [50 WPM, 600 WPM]
  ✓ verticalStability ∈ [10px, 150px]
  ✓ No NaN/Inf values
  ✓ Monotonic timestamps (no gaps > 500ms)
  
  IF ALL PASS → MLReadinessReport.isReady = true
             → Safe to send to FastAPI classifier
```

---

## Integration Points (Ready for Next Phase)

### 1. Hook Composition (useFuseGazePipeline)
**Location:** `src/hooks/useFuseGazePipeline.ts` (TO CREATE)

Should chain:
```typescript
Phase1: useEyeTracking() 
  ↓ (30Hz GazeFrame stream)
Phase2: smoothGazeFrames() + interpolateFrames() + removeOutliers()
  ↓ (denoised GazeFrame stream)
Phase3: extractFeatures() on batch window
  ↓ (ExtractedFeatures every 100ms)
Phase4: mapGazeToWords() + WordDwellTracker
  ↓ (WordMapping per frame)
Phase7: assessSessionQuality() on aggregates
  ↓ (gate check - pass/fail)
Phase6: IF PASS → WebSocketClient.send(GAZE_FRAME)
  ↓ (to backend)
Phase8: checkMLReadiness() every 2-3 sec
  ↓ (confidence report)

Return object:
{
  currentFrame: GazeFrame | null,
  features: ExtractedFeatures | null,
  wordMapping: WordMapping | null,
  quality: SessionQuality,
  mlReadiness: MLReadinessReport,
  isStreaming: boolean,
  error: string | null,
  isSessionValid: boolean
}
```

### 2. React Components (TO CREATE)
- `<GazeProvider>` - Context wrapper with useFuseGazePipeline
- `<GazeSessionMonitor>` - Real-time metrics display
- `<CameraPreview>` - Video + gaze cursor overlay
- `<ReadingSessionGame>` - Main interaction component

### 3. Backend WebSocket Handler (Spring Boot)
Expected endpoint: `ws://localhost:8080/ws/gaze`

Handler responsibilities:
- Accept SESSION_START, route to ML pipeline
- Buffer GAZE_FRAME messages (3-frame window for smoothing)
- Parse FEATURE_UPDATE, extract features
- Forward to FastAPI classifier when FEATURE_UPDATE received
- Return predictions to frontend
- Log SESSION_END for analytics

---

## Configuration & Thresholds

### Sampling
- **PROCESS_INTERVAL**: 33ms (30 Hz)
- **FEATURE_WINDOW**: 100-300ms (3-10 frames)
- **BATCH_INTERVAL**: 2-3 seconds (batch size ~90 frames)

### Feature Algorithms
- **Fixation Tolerance**: 0.03 normalized (≈ 3% of screen)
- **Fixation Duration Min**: 100ms
- **Saccade Velocity Threshold**: 300 pixels/second
- **Vertical Stability**: Computed from gazeY σ in physical pixels

### Quality Thresholds
- Tracking Confidence: ≥70%
- Face Detection Rate: ≥60%
- Vertical Deviation: ≤100px
- Horizontal Deviation: ≤150px
- Jitter: ≤10px per frame
- Min Saccades: ≥10 per session
- Max Regression Rate: ≤80%

### ML Feature Ranges
- Fix Duration: 100-500ms
- Regression Rate: 0-100%
- Saccade Count: ≥10
- Reading Speed: 50-600 WPM
- Vertical Stability: 10-150px

### WebSocket
- **URL**: `ws://localhost:8080/ws/gaze` (configurable)
- **Reconnect Strategy**: Exponential backoff (1s, 2s, 4s, 8s, 16s max)
- **Buffer Size**: 1000 messages
- **Heartbeat**: Optional (every 30s)

---

## Error Handling Strategy

### Network Failures
- WebSocket disconnect → Attempt reconnection
- Reconnection successful → Flush buffered messages
- Max reconnect attempts: 5 with exponential backoff

### Data Quality Issues
- Low confidence frames → Downweight in feature extraction
- Face not detected → Skip frame, don't transmit
- Extremes (NaN, Inf) → Log, truncate to reasonable bounds

### Session Validation
- If quality gates fail → Log failure reason, show user feedback
- If ML readiness fails → Recommend calibration, retry
- If too many failures → Suggest app restart

---

## Performance Targets (Low-End Device)

| Metric | Target | Notes |
|--------|--------|-------|
| CPU Usage | <15% | MediaPipe + processing |
| Memory | <50MB | Buffer 5-10 seconds of frames |
| Battery Impact | <5% per hour | Optimized TensorFlow.js model |
| Frame Drop Rate | <5% | At 30Hz, ~1-2 drops acceptable |
| WebSocket Latency | <100ms | Round-trip to backend |
| Message Throughput | 30-35 msgs/sec | GAZE_FRAME + periodic FEATURE_UPDATE |

---

## Testing Checklist

- [ ] Phase 1: 30Hz sampling validated (count frames per second)
- [ ] Phase 2: Smoothing preserves saccades (spike test)
- [ ] Phase 3: Fixation detection on static gaze (dwell test)
- [ ] Phase 4: Word mapping accuracy (known text, known gaze positions)
- [ ] Phase 5: Session metadata completeness (all fields populated)
- [ ] Phase 6: WebSocket reconnection on network loss
- [ ] Phase 7: Quality gates block bad sessions (<70% confidence)
- [ ] Phase 8: ML readiness report on known datasets (pass/fail cases)
- [ ] Integration: Full pipeline end-to-end (capture → backend)
- [ ] Components: React rendering without memory leaks

---

## Next Steps

**IMMEDIATE (Integration Layer):**
1. Create `useFuseGazePipeline()` hook composing all 8 phases
2. Build React components (Provider, Monitor, Camera, Game)
3. Create mock WebSocket server for testing

**SHORT-TERM (Backend Pairing):**
1. Implement Spring Boot `/ws/gaze` endpoint
2. FastAPI message handlers (parse GAZE_FRAME, FEATURE_UPDATE)
3. Feature extraction validation

**LONG-TERM (Deployment):**
1. Device profiling (low-end phone testing)
2. Performance optimization (message compression, reduced sampling)
3. User feedback loop (calibration guide, error messages)

---

**Architecture Validation:** ✅ All 8 phases complete, modular, testable, and ready for composition.
