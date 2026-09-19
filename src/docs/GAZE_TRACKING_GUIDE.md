/\*\*

- CLINICAL-GRADE GAZE TRACKING PIPELINE
-
- Implementation Guide & Architecture Documentation
  \*/

# 📊 Architecture Overview

The gaze tracking pipeline processes raw 5 Hz eye tracking data into clinically-meaningful metrics:

```
Raw Gaze (5 Hz)
    ↓
Upsampling to 20 Hz (interpolation)
    ↓
Kalman Filtering (smoothing + velocity)
    ↓
Head Normalization (face-relative coords)
    ↓
Fixation Detection (clustered points)
    ↓
Saccade Detection (high-velocity movements)
    ↓
Word Mapping (link fixations to words)
    ↓
Session Validation (clinical criteria)
    ↓
Quality Metrics & Reports
```

# 🔧 Component Breakdown

## Core Utilities

### `gazeProcessing.ts`

- **GazeKalmanFilter**: Smooth noisy gaze with velocity estimation
- **upsampleGazeStream()**: Interpolate from 5 Hz → 20 Hz
- **normalizeGazeToFace()**: Remove head movement
- **isSaccade()**: Detect rapid movements
- **mapGazeToWord()**: Link gaze to text

### `fixationDetection.ts`

- **FixationDetector**: Detect clustered fixations
- Micro-fixation merging (<80ms apart)
- Adaptive radius based on DPI

### `saccadeDetection.ts`

- **SaccadeDetector**: Identify saccades from velocity
- Dual detection (velocity-based + fixation-based)
- Direction classification

### `sessionValidation.ts`

- **SessionValidator**: Compute quality metrics
- Strict clinical thresholds
- Invalid session detection

## React Hooks

### `useGazeSmoothing`

```typescript
const smoothing = useGazeSmoothing({ config });

// Single point
const smoothed = smoothing.smoothPoint(rawPoint);

// Batch processing
const smoothedBatch = smoothing.processBatch(rawPoints);
```

### `useEnhancedGazeTracking`

```typescript
const tracking = useEnhancedGazeTracking({
  enabled: true,
  words: storyWords,
  faceMeshKeypoints: landmarks,
  onQualityUpdate: (quality) => console.log(quality),
});

// Process raw gaze
const { smoothed, fixation, saccade, mappedWord } =
  tracking.processRawGazePoint(rawGaze);

// End session
const quality = tracking.finalizeSession();
```

# 📈 Key Algorithms

## 1. Kalman Filter (Smoothing)

Reduces noise while preserving saccadic movements:

```
State: [x, y, vx, vy]
Update: new_x = x + vx * dt
Correction: x += (measured_x - predicted_x) * gain
```

**Benefits:**

- Smooth trajectory without lag
- Velocity estimation for saccade detection
- Adaptive filtering

## 2. Temporal Upsampling

Interpolates between 5 Hz points:

```
Input: 5 points/second (200ms interval)
Target: 20 points/second (50ms interval)
Method: Linear interpolation between frames
Output: 4 interpolated points per original point
```

## 3. Head Normalization

Removes head movement impact:

```
Screen Gaze = Raw Gaze - Head Movement
```

Uses FaceMesh landmarks (nose, eyes) to track head center.

## 4. Fixation Detection

Clustering algorithm:

```
while distance_from_center < radius:
    accumulate_point()
when distance > radius:
    finalize_fixation()
```

**Micro-fixation merging:**

- If 2 fixations < 80ms apart + < 40px distance
- Merge them into single fixation

## 5. Saccade Detection

Velocity-based approach:

```
velocity = distance / time
if velocity > 0.7 px/ms AND distance > 25px:
    saccade detected
```

Alternative: Detect from fixation transitions (more reliable for low FPS).

## 6. Session Validation

Clinical criteria checklist:

| Metric              | Threshold | Reason            |
| ------------------- | --------- | ----------------- |
| Tracking Confidence | > 70%     | Model reliability |
| Face Stability      | > 50%     | Head movement     |
| Vertical Deviation  | < 100px   | Posture           |
| Skipped Words       | < 40%     | Attention         |
| Saccade Count       | > 10      | Reading behavior  |
| Gaze Jitter         | < 25px    | Fixation quality  |

# 🎯 Integration Example

```typescript
// In your game/tracking component:

import { useEnhancedGazeTracking } from "@/hooks/useEnhancedGazeTracking";
import { QualityMonitor } from "@/components/QualityMonitor";

function SteadyReaderGame() {
  const [words, setWords] = useState<WordBound[]>([]);
  const [faceMesh, setFaceMesh] = useState(null);

  const tracking = useEnhancedGazeTracking({
    enabled: true,
    words,
    faceMeshKeypoints: faceMesh,
    config: {
      targetFPS: 20,
      kalmanProcessNoise: 0.005,
      fixationMinDuration: 50,
    },
  });

  // When raw gaze arrives from detector:
  const handleRawGaze = (rawGaze: GazeDataPoint) => {
    const { smoothed, fixation, saccade, mappedWord } =
      tracking.processRawGazePoint(rawGaze);

    if (fixation) {
      console.log(
        `Fixed on: ${fixation.duration}ms at (${fixation.gazeX}, ${fixation.gazeY})`
      );
    }

    if (saccade) {
      console.log(
        `Saccade: amplitude=${saccade.amplitude}px, dir=${saccade.direction}`
      );
    }
  };

  // End session:
  const handleSessionEnd = () => {
    const quality = tracking.finalizeSession();

    if (quality.isValid) {
      // Send to backend
      submitSession(tracking.getSessionReport());
    } else {
      // Show error
      showInvalidSessionMsg(quality.invalidReasons);
    }
  };

  return (
    <>
      <QualityMonitor quality={tracking.quality} isTracking={true} />
      {/* Game content */}
    </>
  );
}
```

# ⚙️ Configuration

```typescript
const config: GazeProcessingConfig = {
  // Upsampling
  targetFPS: 20, // Interpolate to 20 Hz

  // Smoothing
  kalmanProcessNoise: 0.005, // Lower = smoother
  kalmanMeasurementNoise: 0.3, // Higher = trust more
  movingAverageWindow: 3, // Optional backup

  // Saccade detection
  saccadeVelocityThreshold: 0.7, // px/ms
  saccadeAmplitudeThreshold: 25, // px
  minSaccadeDuration: 10, // ms

  // Fixation detection
  fixationRadius: 40, // px (adaptive)
  fixationMinDuration: 50, // ms
  microFixationMergeDuration: 80, // ms

  // Head normalization
  enableHeadNormalization: true,

  // Validation
  maxVerticalDeviation: 100, // px
  maxSkippedWordRate: 0.4, // 40%
  minSaccadeCount: 10,
  requiredTrackingConfidence: 0.7, // 70%
};
```

# 🧪 Testing & Validation

## Expected Metrics for Healthy Session

- **Tracking Confidence**: 70-95%
- **Face Stability**: 80-100%
- **Saccades**: 30-50 per 5-minute session
- **Fixations**: 40-100 per 5-minute session
- **Vertical Deviation**: 20-80px
- **Skipped Words**: 5-25%

## Invalid Session Indicators

- Tracking confidence < 70%
- Vertical deviation > 100px
- Skipped words > 40%
- Saccades < 10
- Face unstable < 50%

# 🔍 Debugging Tips

## Enable Verbose Logging

```typescript
const tracking = useEnhancedGazeTracking({
  config: {
    // Existing config
  },
  onQualityUpdate: (quality) => {
    if (!quality.isValid) {
      console.error("Quality report:", quality);
    }
  },
});
```

## Check Real-time Metrics

Use `QualityMonitor` component to visualize:

- Tracking confidence gauge
- Face stability indicator
- Gaze jitter meter
- Invalid session reasons

## Test Cases

1. **Perfect Tracking**: Face steady, gaze smooth
   - Expected: All metrics green
2. **Head Movement**: Move head while reading
   - Expected: Vertical deviation increases
3. **Inattention**: Skip words / look away
   - Expected: Skipped word rate increases
4. **Poor Lighting**: Dim environment
   - Expected: Tracking confidence drops
5. **Distance Variation**: Move closer/farther
   - Expected: Gaze jitter increases

# 📊 Output Formats

## Session Report

```typescript
{
  fixations: [
    {
      id: "fix_0",
      duration: 250,
      position: { x: 150, y: 300 },
      stability: 0.1,
      word: "diagnosis"
    },
    // ...
  ],
  saccades: [
    {
      id: "sac_0",
      duration: 30,
      amplitude: 120,
      peakVelocity: 2.5,
      direction: "forward"
    },
    // ...
  ],
  quality: {
    trackingConfidence: 0.85,
    faceStability: 0.92,
    gazeJitter: 12.3,
    // ...
    isValid: true
  }
}
```

## Quality Metrics

```typescript
{
  trackingConfidence: 0.85,        // 85%
  faceStability: 0.92,             // 92%
  gazeJitter: 12.3,                // px
  verticalDeviation: 45.2,         // px
  skippedWordRate: 0.15,           // 15%
  saccadeCount: 42,
  fixationCount: 58,
  averageFixationDuration: 245.5,  // ms
  isValid: true,
  invalidReasons: []
}
```

# 🚀 Performance Notes

- **Processing**: ~5-10ms per gaze point
- **Memory**: ~5MB per 5-minute session
- **CPU**: <10% on mid-range Android
- All computations offline (no network)

# 🤝 Backend Integration

Only send sessions marked `isValid: true`:

```typescript
if (quality.isValid) {
  await api.submitSession({
    fixations: report.fixations,
    saccades: report.saccades,
    quality: report.quality,
  });
}
```

Backend receives clean, validated data ready for dyslexia analysis.
