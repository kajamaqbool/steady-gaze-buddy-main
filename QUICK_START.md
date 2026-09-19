/\*\*

- Quick Start Guide - Clinical Gaze Tracking
-
- FASTEST way to integrate the 10-tier gaze pipeline into your app
  \*/

// ============================================================================
// STEP 1: Import the hook
// ============================================================================

import { useGazeProcessing, useGazeDebugVisualization } from "@/hooks/useGazeProcessing";
import QualityMonitor from "@/components/QualityMonitorEnhanced";
import { useEyeTracking } from "@/hooks/useEyeTracking";

// ============================================================================
// STEP 2: Use in your component
// ============================================================================

export function ClinicalGazeReader() {
// Eye tracking provides raw gaze points
const { videoRef, detectFace, faceDetected } = useEyeTracking({
enabled: true,
});

// Gaze processing does everything else
const gaze = useGazeProcessing({
enableHeadNormalization: true,
totalWords: 107, // Your story word count
debug: false,
});

// Use processed data for visualization
const viz = useGazeDebugVisualization(gaze.processedData);

// =========================================================================
// STEP 3: Connect raw gaze to processor
// =========================================================================

const processGazeFrame = async () => {
if (!faceDetected) return;

    // Get raw gaze from your eye tracking
    const rawGaze = await detectFace();
    if (!rawGaze) return;

    // Prepare raw point
    const gazePoint: GazeDataPoint = {
      timestamp: Date.now(),
      gazeX: rawGaze.gazeX,
      gazeY: rawGaze.gazeY,
      leftIrisX: rawGaze.leftIrisX,
      leftIrisY: rawGaze.leftIrisY,
      rightIrisX: rawGaze.rightIrisX,
      rightIrisY: rawGaze.rightIrisY,
      textScrollOffset: window.scrollY,
      currentWord: "", // Will be set by word mapper
      faceDetected: true,
      confidence: rawGaze.confidence,
    };

    // Process through pipeline
    // (Internally: smooth, normalize, etc)
    gaze.processRawGazePoint(gazePoint, faceMeshKeypoints);

    // Optional: Use smoothed output immediately
    // (Already smoothed, head-normalized, validated)

};

// =========================================================================
// STEP 4: End session and validate
// =========================================================================

const handleFinishReading = () => {
// Run full validation pipeline
const result = gaze.finalizeSession();

    if (!result) {
      console.error("Session processing failed:", gaze.processingError);
      return;
    }

    console.log("📊 Session Complete:");
    console.log(`- Quality Score: ${result.quality.overallScore}/100`);
    console.log(`- Valid: ${result.quality.isValid}`);
    console.log(`- Fixations: ${result.fixations.length}`);
    console.log(`- Saccades: ${result.saccades.length}`);

    if (result.quality.isValid) {
      // ✅ SEND TO BACKEND
      submitToBackend({
        fixations: result.fixations,
        saccades: result.saccades,
        metrics: result.quality.metrics,
        duration: getDuration(),
      });
    } else {
      // ❌ SHOW ERROR TO USER
      showError(
        "Session quality too low.",
        result.quality.failureReasons[0]
      );
    }

};

// =========================================================================
// STEP 5: Render UI with live quality
// =========================================================================

return (
<div className="flex flex-col gap-4">
{/_ Show live quality monitoring _/}
{gaze.processedData && (
<QualityMonitor 
          quality={gaze.processedData.quality} 
          isLive={true} 
        />
)}

      {/* Story content */}
      <div id="story-container" ref={videoRef}>
        {/* Text goes here - must have data-word-index attributes */}
        {storyText.map((word, i) => (
          <span
            key={i}
            data-word-index={i}
            data-text-index={i}
            className="hover:bg-blue-100"
          >
            {word}{" "}
          </span>
        ))}
      </div>

      {/* Debug visualization (optional) */}
      {DEBUG_MODE && (
        <DebugVisualization data={viz} />
      )}

      {/* Status */}
      <div className="text-sm text-muted-foreground">
        Points: {gaze.getSessionStatus().pointCount}
        Duration: {gaze.getSessionStatus().duration.toFixed(1)}s
      </div>

      {/* Action buttons */}
      <button
        onClick={handleFinishReading}
        className="px-4 py-2 bg-primary text-white rounded"
      >
        Finish Reading
      </button>
    </div>

);
}

// ============================================================================
// WHAT HAPPENS INSIDE useGazeProcessing
// ============================================================================

/\*

When you call processRawGazePoint():

1. ✓ Store raw gaze point
2. ✓ Extract head pose from landmarks
3. ✓ Normalize gaze to head-relative space
4. ✓ Return smoothed frame

When you call finalizeSession():

1. ✓ Smooth all points with 3-frame window
2. ✓ Interpolate to 20 Hz (from 5 Hz input)
3. ✓ Remove statistical outliers
4. ✓ Clamp extreme velocity jumps
5. ✓ Detect fixations (cluster + merge micro-fixations)
6. ✓ Detect saccades (velocity + transition methods)
7. ✓ Calculate features:
   - Vertical stability
   - Tracking confidence
   - Face detection rate
   - Jitter amount
   - Skipped word rate
   - Saccade count
   - Regression rate
   - Fixation duration
8. ✓ Run 7-point validation
9. ✓ Assign quality score (0-100)
10. ✓ Return results with YES/NO verdict

\*/

// ============================================================================
// VALIDATION RULES (What makes a session INVALID)
// ============================================================================

/\*

Session fails if ANY of these occur:
❌ Tracking confidence < 70% (ML model not confident)
❌ Face detected < 60% of time (Face moved out of frame)
❌ Vertical deviation > 100px (Head moved too much vertically)
❌ Skipped words > 40% (Didn't read enough)
❌ Saccade count < 10 (Too few eye movements)
❌ Regression rate > 80% (Almost all backward saccades)
❌ Avg fixation < 100ms (Fixations too brief)
❌ Jitter > 10px (Too much noise)

Score calculation:
Start: 100 points
Each failure: -5 to -20 points
Pass threshold: 60 points

\*/

// ============================================================================
// WHAT TO DO WITH RESULTS
// ============================================================================

/\*

IF session is VALID (quality score ≥ 70):
→ Send everything to backend
→ Use for clinical analysis
→ Classify reader profile
→ Store metrics for trending

IF session is VALID but LOW SCORE (60-69):
→ Store for analysis
→ Mark as "acceptable" not "excellent"
→ Show user: "Session OK but could improve"

IF session is INVALID (score < 60):
→ DO NOT send to backend
→ Show improvement suggestions:
Face unstable? → "Keep camera steady"
Too many skipped? → "Slow down, focus on text"
Tracking poor? → "Better lighting needed"
→ Allow user to retry

\*/

// ============================================================================
// CONFIGURATION OPTIONS
// ============================================================================

interface UseGazeProcessingOptions {
smoothingWindow?: number; // 3 (default), 5px more smooth but slower response
targetFps?: number; // 20 (default), 30 for smoother but more data
inputFps?: number; // 5 (default), your camera FPS
enableHeadNormalization?: boolean; // true (default), remove head movement
totalWords?: number; // 100 (default), your story's word count
debug?: boolean; // false (default), enable console logging
}

// ============================================================================
// HOOKREF: useGazeProcessing RETURNS
// ============================================================================

/\*

{
// Main functions
processRawGazePoint(point, keypoints) → SmoothedFrame | null
finalizeSession() → ProcessedGazeData | null
resetSession() → void
getSessionStatus() → { pointCount, duration, ... }

// State
processedData → ProcessedGazeData | null
processingError → string | null
}

ProcessedGazeData = {
raw: GazeDataPoint[] // Original raw points
smoothed: SmoothedFrame[] // After smoothing + interpolation
fixations: Fixation[] // Detected fixation clusters
saccades: Saccade[] // Detected eye movements
quality: SessionQuality // Validation results
headPoses: HeadPose[] // Head orientation over time
}

SessionQuality = {
isValid: boolean // Pass/fail verdict
overallScore: number // 0-100
failureReasons: string[] // Why it failed
metrics: {
trackingConfidence: number // %
faceStability: number // %
verticalDeviation: number // px
horizontalDeviation: number // px
jitterAmount: number // px
skippedWordRate: number // %
saccadeCount: number // count
regressionRate: number // %
fixationDuration: number // ms
readingFlow: boolean // in-order?
}
}

\*/

// ============================================================================
// DEBUGGING
// ============================================================================

// Enable full logging
const gaze = useGazeProcessing({ debug: true });

// Output in console:
// 📊 Finalizing session with 250 raw points
// ✓ After smoothing + interpolation: 1000 points
// ✓ After outlier removal & clamping: 1000 points
// ✓ Detected 32 fixations
// ✓ Detected 28 saccades
// ✓ Quality assessment: 85/100 - VALID

// For visualization
const viz = useGazeDebugVisualization(gaze.processedData);
console.log("Gaze trail:", viz.gazeTrail); // Smoothed trajectory
console.log("Fixations:", viz.fixations); // Circles with duration
console.log("Saccades:", viz.saccades); // Paths between
console.log("Head pos:", viz.headPositions); // Head movement

// ============================================================================
// TESTING
// ============================================================================

// Test with synthetic data
const syntheticGaze: GazeDataPoint = {
timestamp: Date.now(),
gazeX: Math.random(), // 0-1 normalized
gazeY: Math.random(),
leftIrisX: 300,
leftIrisY: 300,
rightIrisX: 350,
rightIrisY: 300,
textScrollOffset: 0,
currentWord: "test",
faceDetected: true,
confidence: 0.95,
};

gaze.processRawGazePoint(syntheticGaze);

// Run 50 times to generate session
for (let i = 0; i < 50; i++) {
gaze.processRawGazePoint({
...syntheticGaze,
timestamp: Date.now() + i _ 200,
gazeX: syntheticGaze.gazeX + Math.random() _ 0.05 - 0.025,
gazeY: syntheticGaze.gazeY + Math.random() \* 0.05 - 0.025,
});
}

const result = gaze.finalizeSession();
console.log("Test result:", result?.quality);
