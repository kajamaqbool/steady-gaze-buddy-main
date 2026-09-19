/**
 * PHASE 1: Core Eye Tracking Hook (30Hz, Real-time)
 * 
 * Captures gaze frames at ~30Hz with:
 * - Absolute timestamps
 * - Velocity computation
 * - Head position tracking
 * - Dynamic confidence scoring
 * 
 * CRITICAL: Must maintain monotonic frame IDs and timestamps
 */

import { useRef, useState, useCallback, useEffect } from "react";
import "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import type { GazeFrame, GazeCaptureMetadata } from "@/types/gazeFrame";

const TARGET_SAMPLING_RATE_HZ = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_SAMPLING_RATE_HZ; // ~33ms

interface CalibrationOffset {
  x: number;
  y: number;
}

interface UseEyeTrackingPhase1Options {
  enabled: boolean;
  onGazeFrame?: (frame: GazeFrame) => void;
  debug?: boolean;
}

interface EyeTrackingState {
  modelLoaded: boolean;
  faceDetected: boolean;
  error: string | null;
  framesCollected: number;
  droppedFrames: number;
}

export function useEyeTrackingPhase1(
  options: UseEyeTrackingPhase1Options
) {
  const { enabled, onGazeFrame, debug = false } = options;

  // ========== SERVICE LAYER: MODEL & VIDEO ==========

  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ========== STATE TRACKING ==========

  const [state, setState] = useState<EyeTrackingState>({
    modelLoaded: false,
    faceDetected: false,
    error: null,
    framesCollected: 0,
    droppedFrames: 0,
  });

  // ========== SESSION TRACKING ==========

  const calibrationRef = useRef<CalibrationOffset>({ x: 0, y: 0 });
  const trackingRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastGazeRef = useRef<{ x: number; y: number } | null>(null);
  const lastHeadRef = useRef<{ x: number; y: number } | null>(null);
  const frameBufferRef = useRef<GazeFrame[]>([]);
  const rafRef = useRef<number>(0);

  // ========== PHASE 1: MODEL LOADING ==========

  const loadModel = useCallback(async () => {
    if (detectorRef.current) {
      if (debug) console.log("✅ Model already loaded");
      return;
    }

    if (debug) console.log("🧠 Loading FaceMesh model...");

    try {
      let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;

      try {
        detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "tfjs" as const,
            refineLandmarks: true,
            maxFaces: 1,
          }
        );
      } catch {
        // Fallback without refineLandmarks
        detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "tfjs" as const,
            refineLandmarks: false,
            maxFaces: 1,
          }
        );
      }

      if (!detector) throw new Error("Detector creation failed");

      detectorRef.current = detector;
      setState((s) => ({ ...s, modelLoaded: true }));
      if (debug) console.log("✅ FaceMesh model loaded");
    } catch (err) {
      const errorMsg = `Failed to load model: ${String(err)}`;
      setState((s) => ({ ...s, error: errorMsg }));
      if (debug) console.error("❌", errorMsg);
    }
  }, [debug]);

  // ========== PHASE 1: VIDEO STREAMING ==========

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.transform = "scaleX(-1)";

      // Create visible container for frame decoding
      if (!containerRef.current) {
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.right = "10px";
        container.style.bottom = "10px";
        container.style.width = "240px";
        container.style.height = "180px";
        container.style.zIndex = "9999";
        container.style.border = "2px solid lime";
        container.style.borderRadius = "8px";
        container.style.overflow = "hidden";
        container.id = "eye-tracking-video-phase1";
        document.body.appendChild(container);
        containerRef.current = container;
      }

      containerRef.current.appendChild(video);
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.display = "block";
      video.style.objectFit = "cover";

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener("canplay", onReady);
          videoRef.current = video;
          resolve();
        };
        video.addEventListener("canplay", onReady);
      });

      if (debug) console.log("✅ Camera started");
    } catch (err) {
      const errorMsg = `Camera error: ${String(err)}`;
      setState((s) => ({ ...s, error: errorMsg }));
      if (debug) console.error("❌", errorMsg);
    }
  }, [debug]);

  // ========== PHASE 1: HEAD POSITION EXTRACTION ==========

  const extractHeadPosition = useCallback(
    (face: any, videoW: number, videoH: number) => {
      const keypoints = face.keypoints || [];
      if (keypoints.length < 10) {
        return {
          x: 0.5,
          y: 0.5,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
        };
      }

      // Use nose, eyes for face center
      const noseTip = keypoints[1] || { x: videoW / 2, y: videoH / 2 };
      const leftEye = keypoints[33] || noseTip;
      const rightEye = keypoints[263] || noseTip;

      const headCenterX =
        ((noseTip.x + leftEye.x + rightEye.x) / 3) / videoW;
      const headCenterY =
        ((noseTip.y + leftEye.y + rightEye.y) / 3) / videoH;

      // Estimate rotation (simplified from landmarks)
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);
      const yaw = eyeDistance > 0 ? Math.atan2(rightEye.x - leftEye.x, 100) : 0;

      const eyeHeight = Math.abs(rightEye.y - noseTip.y);
      const pitch = eyeHeight > 0 ? Math.atan2(eyeHeight, 100) : 0;

      return {
        x: Math.max(0, Math.min(1, headCenterX)),
        y: Math.max(0, Math.min(1, headCenterY)),
        rotX: yaw,
        rotY: pitch,
        rotZ: 0,
      };
    },
    []
  );

  // ========== PHASE 1: GAZE EXTRACTION WITH VELOCITY ==========

  const extractGazeWithVelocity = useCallback(
    (face: any, videoW: number, videoH: number, dtMs: number) => {
      const leftIris = face.keypoints?.[468];
      const rightIris = face.keypoints?.[473];
      const faceBbox = face.box ?? face.boundingBox;

      if (!leftIris || !rightIris) {
        return null;
      }

      // Raw gaze
      const rawGazeX = (leftIris.x + rightIris.x) / 2 / videoW;
      const rawGazeY = (leftIris.y + rightIris.y) / 2 / videoH;

      // Apply calibration
      const gazeX = Math.max(0, Math.min(1, rawGazeX + calibrationRef.current.x));
      const gazeY = Math.max(0, Math.min(1, rawGazeY + calibrationRef.current.y));

      // Compute velocity (normalized units per ms)
      let velocityX = 0;
      let velocityY = 0;
      let velocity = 0;

      if (lastGazeRef.current && dtMs > 0) {
        velocityX = (gazeX - lastGazeRef.current.x) / dtMs;
        velocityY = (gazeY - lastGazeRef.current.y) / dtMs;
        velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      }

      lastGazeRef.current = { x: gazeX, y: gazeY };

      // Dynamic confidence based on FaceMesh quality
      let confidence = 0.95; // Iris visible

      if (faceBbox) {
        const boxQuality = faceBbox.width && faceBbox.height ? 1.0 : 0.8;
        confidence *= boxQuality;
      }

      return {
        gazeX,
        gazeY,
        velocityX,
        velocityY,
        velocity,
        confidence,
      };
    },
    []
  );

  // ========== PHASE 1: FACE DETECTION WITH FALLBACK ==========

  const detectFaceAndExtractGaze = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) {
      return null;
    }

    const video = videoRef.current;

    try {
      // Ensure video is ready
      if (video.readyState < 2) return null;
      if (video.paused) {
        try {
          await video.play();
        } catch {
          // Ignore play errors in some contexts
        }
      }

      // Detect faces
      let faces = await detectorRef.current.estimateFaces(video, {
        flipHorizontal: true,
      });

      // Canvas fallback
      if (faces.length === 0) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0);
            faces = await detectorRef.current.estimateFaces(canvas as any, {
              flipHorizontal: true,
            });
          } catch {
            // Canvas approach failed
          }
        }
      }

      if (faces.length === 0) {
        setState((s) => ({ ...s, faceDetected: false }));
        return null;
      }

      const face = faces[0];
      const now = Date.now();
      const dtMs = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : FRAME_INTERVAL_MS;

      const headPos = extractHeadPosition(face, video.videoWidth, video.videoHeight);
      const gazeData = extractGazeWithVelocity(face, video.videoWidth, video.videoHeight, dtMs);

      if (!gazeData) return null;

      setState((s) => ({ ...s, faceDetected: true }));

      return {
        ...gazeData,
        headCenterX: headPos.x,
        headCenterY: headPos.y,
        headRotationX: headPos.rotX,
        headRotationY: headPos.rotY,
        headRotationZ: headPos.rotZ,
        dtMs,
        timestampMs: now,
      };
    } catch (err) {
      if (debug) console.error("❌ Face detection error:", err);
      setState((s) => ({ ...s, faceDetected: false }));
      return null;
    }
  }, [extractHeadPosition, extractGazeWithVelocity, debug]);

  // ========== PHASE 1: CALIBRATION ==========

  const calibrateAtPoint = useCallback(
    async (targetX: number, targetY: number) => {
      const result = await detectFaceAndExtractGaze();
      if (!result) return null;

      return {
        targetX,
        targetY,
        detectedX: result.gazeX,
        detectedY: result.gazeY,
        offsetX: targetX - result.gazeX,
        offsetY: targetY - result.gazeY,
      };
    },
    [detectFaceAndExtractGaze]
  );

  const setCalibration = useCallback(
    (offsets: Array<{ offsetX: number; offsetY: number }>) => {
      if (offsets.length === 0) return;
      const avgX = offsets.reduce((s, o) => s + o.offsetX, 0) / offsets.length;
      const avgY = offsets.reduce((s, o) => s + o.offsetY, 0) / offsets.length;
      calibrationRef.current = { x: avgX, y: avgY };
      if (debug) console.log(`✅ Calibration set: (${avgX.toFixed(3)}, ${avgY.toFixed(3)})`);
    },
    [debug]
  );

  // ========== PHASE 1: FRAME CAPTURE LOOP (30Hz) ==========

  const startTracking = useCallback(() => {
    sessionStartTimeRef.current = Date.now();
    frameIdRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastGazeRef.current = null;
    frameBufferRef.current = [];

    trackingRef.current = true;
    if (debug) console.log("🟢 Tracking started");

    const captureFrame = async () => {
      if (!trackingRef.current) return;

      const now = Date.now();
      const elapsedMs = now - sessionStartTimeRef.current;

      const gazeData = await detectFaceAndExtractGaze();

      if (gazeData && gazeData.dtMs > 0) {
        const frame: GazeFrame = {
          timestampMs: now,
          elapsedMs,
          frameId: frameIdRef.current++,

          gazeX: gazeData.gazeX,
          gazeY: gazeData.gazeY,

          velocityX: gazeData.velocityX,
          velocityY: gazeData.velocityY,
          velocity: gazeData.velocity,

          headCenterX: gazeData.headCenterX,
          headCenterY: gazeData.headCenterY,
          headRotationX: gazeData.headRotationX,
          headRotationY: gazeData.headRotationY,
          headRotationZ: gazeData.headRotationZ,

          confidence: gazeData.confidence,
          faceDetected: true,
          irisVisible: true,

          samplingRateHz: TARGET_SAMPLING_RATE_HZ,
          dtMs: gazeData.dtMs,
        };

        frameBufferRef.current.push(frame);
        onGazeFrame?.(frame);

        lastFrameTimeRef.current = now;

        setState((s) => ({
          ...s,
          framesCollected: s.framesCollected + 1,
        }));
      } else {
        // No face detected this frame
        setState((s) => ({
          ...s,
          droppedFrames: s.droppedFrames + 1,
        }));
      }

      rafRef.current = requestAnimationFrame(captureFrame);
    };

    rafRef.current = requestAnimationFrame(captureFrame);
  }, [detectFaceAndExtractGaze, onGazeFrame, debug]);

  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    if (debug) console.log("🔴 Tracking stopped");
  }, [debug]);

  // ========== FRAME BUFFER ACCESS ==========

  const getFrameBuffer = useCallback(
    (): GazeFrame[] => {
      return [...frameBufferRef.current];
    },
    []
  );

  const clearFrameBuffer = useCallback(() => {
    frameBufferRef.current = [];
  }, []);

  // ========== CAPTURE METADATA ==========

  const getCaptureMetadata = useCallback((): GazeCaptureMetadata => {
    const endTimeMs = Date.now();
    const totalDurationMs = endTimeMs - sessionStartTimeRef.current;
    const averageSamplingRate =
      totalDurationMs > 0
        ? (frameBufferRef.current.length / totalDurationMs) * 1000
        : 0;

    return {
      sessionId: `session_${sessionStartTimeRef.current}`,
      startTimeMs: sessionStartTimeRef.current,
      startFrameId: 0,

      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      viewport: {
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      },

      calibrationDistanceMm: 600, // Assume typical screen distance
      calibrationAccuracyPx: 20,

      targetSamplingRateHz: TARGET_SAMPLING_RATE_HZ,
      actualAverageSamplingRateHz: averageSamplingRate,

      userAgent: navigator.userAgent,
      platformInfo: navigator.platform,
    };
  }, []);

  // ========== CLEANUP ==========

  useEffect(() => {
    return () => {
      stopTracking();
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
      if (containerRef.current?.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }
    };
  }, [stopTracking]);

  // ========== MAIN API ==========

  return {
    // State
    ...state,

    // Model & Camera
    loadModel,
    startCamera,

    // Tracking
    startTracking,
    stopTracking,

    // Calibration
    calibrateAtPoint,
    setCalibration,

    // Data Access
    getFrameBuffer,
    clearFrameBuffer,
    getCaptureMetadata,

    // Refs
    videoRef,
  };
}
