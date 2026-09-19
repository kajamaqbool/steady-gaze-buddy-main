/**
 * EXAMPLE: Integration with SteadyReaderGame Component
 * 
 * Shows how to use the clinical-grade gaze tracking pipeline
 * in your existing game component.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useEnhancedGazeTracking } from "@/hooks/useEnhancedGazeTracking";
import { QualityMonitor } from "@/components/QualityMonitorEnhanced";
import type { SessionQuality } from "@/lib/sessionValidation";
import type { GazeDataPoint } from "@/types/gaze";

/**
 * Example integration - adapt to your actual component
 */
export function SteadyReaderGameWithClinicalTracking() {
  // Story state
  const [storyWords, setStoryWords] = useState<Array<{ text: string; x: number; y: number; width: number; height: number }>>([]);

  // Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [sessionQuality, setSessionQuality] = useState<SessionQuality | null>(null);
  const sessionStartTime = useRef<number | null>(null);

  // Initialize clinical gaze tracking
  const tracking = useEnhancedGazeTracking({
    enabled: isTracking,
    totalWords: storyWords.length || 100,
    enableHeadNormalization: true,
    debug: false,
    onQualityUpdate: (quality) => {
      setSessionQuality(quality);
      
      // Real-time feedback
      if (!quality.isValid && quality.failureReasons.length > 0) {
        console.warn("⚠️ Session quality issue:", quality.failureReasons[0]);
      }
    },
  });

  // =========================================================================
  // STEP 1: Extract Word Bounding Boxes from Story
  // =========================================================================

  const extractWordsFromDOM = useCallback(() => {
    const words: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];

    // Assuming story text is in elements with class "story-word"
    const wordElements = document.querySelectorAll(".story-word");

    wordElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      words.push({
        text: el.textContent || "",
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    });

    setStoryWords(words);
    console.log(`Extracted ${words.length} words for gaze mapping`);
  }, []);

  // =========================================================================
  // STEP 2: Handle Raw Gaze Points from MediaPipe
  // =========================================================================

  const handleRawGazePoint = useCallback(
    (gazePoint: GazeDataPoint) => {
      if (!isTracking) return;

      // Process through clinical pipeline
      tracking.processRawGazePoint(gazePoint);

      // Note: Individual fixations/saccades are processed during finalizeSession()
      // For real-time feedback, check quality scores as they update
    },
    [isTracking, tracking]
  );

  // =========================================================================
  // STEP 3: Helper function for validity display
  // =========================================================================

  const getValidityIcon = (quality: SessionQuality | null): string => {
    if (quality === null) return "—";
    return quality.isValid ? "✅" : "❌";
  };

  const startSession = useCallback(() => {
    console.log("🎬 Starting clinical gaze tracking session...");
    
    extractWordsFromDOM();
    tracking.resetSession();
    
    sessionStartTime.current = Date.now();
    setIsTracking(true);
    setSessionQuality(null);
  }, [extractWordsFromDOM, tracking]);

  const endSession = useCallback(async () => {
    console.log("⏹️ Ending session...");
    setIsTracking(false);

    // Finalize tracking and get complete analysis
    const result = tracking.finalizeSession();
    const quality = result.quality;
    
    console.log("Final session quality:", quality);
    console.log("Fixations:", result.fixations.length);
    console.log("Saccades:", result.saccades.length);
    
    // ===== VALIDATION CHECK =====
    if (!quality.isValid) {
      console.error("❌ Session INVALID - Not sending to backend");
      console.error("Reasons:", quality.failureReasons);
      
      // Show user-friendly error
      showInvalidSessionDialog(quality.failureReasons);
      return;
    }

    // ===== SUBMIT to BACKEND =====
    console.log("✅ Session VALID - Submitting to backend...");
    
    try {
      await submitSessionToBackend({
        duration: Date.now() - (sessionStartTime.current || 0),
        fixations: result.fixations,
        saccades: result.saccades,
        quality: quality,
        totalPoints: result.fixations.length + result.saccades.length,
      });
      
      console.log("✅ Session submitted successfully!");
      showSuccessDialog(result);
    } catch (err) {
      console.error("❌ Failed to submit session:", err);
      showErrorDialog("Failed to submit session");
    }
  }, [tracking]);

  // =========================================================================
  // STEP 4: Session Lifecycle Complete - Event handlers kept for reference
  // =========================================================================
  // Note: In this simplified implementation, we collect all gaze data

  const showInvalidSessionDialog = (reasons: string[]) => {
    const message = `Session quality issues:\n${reasons.join("\n")}`;
    alert(message);
  };

  const showSuccessDialog = (result: any) => {
    alert(
      `Session completed!\n` +
      `Fixations: ${result.fixations.length}\n` +
      `Saccades: ${result.saccades.length}`
    );
  };

  const showErrorDialog = (message: string) => {
    alert(`Error: ${message}`);
  };

  const submitSessionToBackend = async (data: any) => {
    // Backend API endpoint for gaze session submission
    const response = await fetch("/api/gaze-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    return response.json();
  };

  // =========================================================================
  // STEP 6: Effects
  // =========================================================================

  // Simulate receiving gaze points from MediaPipe detector
  // In real implementation, this would come from useEyeTracking hook
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      // Example: Simulate raw gaze point
      const gazePoint: GazeDataPoint = {
        timestamp: Date.now(),
        gazeX: Math.random() * 320,
        gazeY: Math.random() * 240,
        leftIrisX: 0,
        leftIrisY: 0,
        rightIrisX: 0,
        rightIrisY: 0,
        textScrollOffset: 0,
        currentWord: "",
        faceDetected: true,
        confidence: 0.8 + Math.random() * 0.2,
      };

      handleRawGazePoint(gazePoint);
    }, 200); // ~5 Hz (simulating current system)

    return () => clearInterval(interval);
  }, [isTracking, handleRawGazePoint]);

  // =========================================================================
  // UI RENDERING
  // =========================================================================

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Controls */}
      <div className="p-4 bg-white shadow-lg rounded-b-lg">
        <div className="flex gap-4">
          <button
            onClick={startSession}
            disabled={isTracking}
            className="px-6 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50"
          >
            Start Session
          </button>
          <button
            onClick={endSession}
            disabled={!isTracking}
            className="px-6 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
          >
            End Session
          </button>
        </div>
        {isTracking && sessionStartTime.current ? (
          <div className="mt-2 text-sm text-gray-600">
            Session duration: {Math.round((Date.now() - sessionStartTime.current) / 1000)}s
          </div>
        ) : null}
      </div>

      {/* Story Content */}
      <div className="p-8 bg-white m-4 rounded-lg shadow-md">
        <div className="text-lg leading-relaxed">
          <span className="story-word">The</span>{" "}
          <span className="story-word">quick</span>{" "}
          <span className="story-word">brown</span>{" "}
          <span className="story-word">fox</span>{" "}
          <span className="story-word">jumps</span>{" "}
          <span className="story-word">over</span>{" "}
          <span className="story-word">the</span>{" "}
          <span className="story-word">lazy</span>{" "}
          <span className="story-word">dog.</span>
        </div>
      </div>

      {/* Quality Monitor - Real-time Quality Feedback */}
      {sessionQuality && (
        <QualityMonitor 
          quality={sessionQuality}
          isLive={isTracking}
        />
      )}

      {/* Debug Info */}
      {isTracking && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded text-xs font-mono max-w-xs">
          <div className="font-bold mb-2">Debug Info</div>
          <div>Status: Recording</div>
          <div>Quality: {sessionQuality ? `${sessionQuality.overallScore}/100` : "—"}</div>
          <div>Valid: {getValidityIcon(sessionQuality)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default SteadyReaderGameWithClinicalTracking;
