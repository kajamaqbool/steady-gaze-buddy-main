import { useRef, useState, useCallback, useEffect } from "react";
import "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import type { GazeDataPoint } from "@/types/gaze";

const PROCESS_INTERVAL = 200; // 5 FPS

interface CalibrationOffset {
  x: number;
  y: number;
}

interface UseEyeTrackingOptions {
  enabled: boolean;
  onGazePoint?: (point: GazeDataPoint) => void;
  scrollOffset?: number;
  storyWords?: string[];
}

export function useEyeTracking({ enabled, onGazePoint, scrollOffset = 0, storyWords = [] }: UseEyeTrackingOptions) {
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calibrationRef = useRef<CalibrationOffset>({ x: 0, y: 0 });
  const trackingRef = useRef(false);
  const startTimeRef = useRef(0);
  const gazeDataRef = useRef<GazeDataPoint[]>([]);
  const lastProcessTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Load model
  const loadModel = useCallback(async () => {
    console.log("📦 loadModel() called - checking state...");
    if (detectorRef.current) {
      console.log("✅ Detector already loaded");
      return;
    }
    
    if (modelLoading) {
      console.log("⏳ Model already loading, waiting...");
      return;
    }
    
    console.log("🧠 Starting FaceMesh model load...");
    setModelLoading(true);
    try {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      console.log("Creating detector with model:", model);
      let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
      
      try {
        // Try with refineLandmarks enabled first (better accuracy)
        console.log("Attempting detector creation with refineLandmarks=true...");
        detector = await faceLandmarksDetection.createDetector(model, {
          runtime: "tfjs" as const,
          refineLandmarks: true,
          maxFaces: 1,
        });
      } catch (refinedErr) {
        console.warn("⚠️ Failed with refineLandmarks=true, trying without...", refinedErr);
        // Fallback: try without refineLandmarks
        detector = await faceLandmarksDetection.createDetector(model, {
          runtime: "tfjs" as const,
          refineLandmarks: false,
          maxFaces: 1,
        });
      }
      
      if (!detector) {
        throw new Error("Detector creation returned null");
      }
      
      // Warm up the model with a dummy frame to ensure TensorFlow is initialized
      console.log("🔥 Warming up model with dummy frame...");
      try {
        const dummyCanvas = document.createElement("canvas");
        dummyCanvas.width = 512;
        dummyCanvas.height = 512;
        const ctx = dummyCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, 512, 512);
          // Run inference on dummy frame to warm up
          await detector.estimateFaces(dummyCanvas as any, { flipHorizontal: true });
          console.log("✅ Model warm-up complete");
        }
      } catch (warmupErr) {
        console.warn("⚠️ Model warm-up failed (non-critical):", warmupErr);
      }
      
      detectorRef.current = detector;
      setModelLoaded(true);
      console.log("✅ FaceMesh model loaded successfully, detector set!");
    } catch (err) {
      console.error("❌ Failed to load FaceMesh model:", err);
      setError("Failed to load eye tracking model: " + String(err));
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.transform = "scaleX(-1)"; // Mirror the video like a selfie
      
      // CRITICAL: Attach video to DOM for autoplay to work in modern browsers
      // Create hidden container if doesn't exist
      if (!containerRef.current) {
        const container = document.createElement("div");
        // Make video visible in bottom-right corner for debugging/ensuring frames decode
        container.style.position = "fixed";
        container.style.right = "10px";
        container.style.bottom = "10px";
        container.style.width = "320px";
        container.style.height = "240px";
        container.style.zIndex = "9999";
        container.style.border = "2px solid lime";
        container.style.borderRadius = "8px";
        container.style.overflow = "hidden";
        container.style.backgroundColor = "black";
        container.id = "eye-tracking-video-container";
        document.body.appendChild(container);
        containerRef.current = container;
        console.log("✅ Created VISIBLE video container in corner for frame decoding");
      }
      
      // Append video to hidden container so it can stream properly
      containerRef.current.appendChild(video);
      // Ensure video fills the container
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.display = "block";
      video.style.objectFit = "cover";
      console.log("Video attached to DOM for streaming");
      
      // Log camera stream info
      const tracks = stream.getTracks();
      const videoTracks = stream.getVideoTracks();
      console.log(`📹 Stream info: ${tracks.length} total tracks, ${videoTracks.length} video track(s)`);
      videoTracks.forEach((track, i) => {
        const settings = track.getSettings?.();
        console.log(`   Video track ${i}: enabled=${track.enabled}, ${settings?.width}x${settings?.height}`);
      });
      
      // Wait for frame data to be available
      await new Promise<void>((resolve) => {
        let resolved = false;
        
        const handleReady = () => {
          if (resolved) return;
          resolved = true;
          video.removeEventListener("canplay", handleReady);
          video.removeEventListener("loadeddata", handleReady);
          videoRef.current = video;
          console.log("✅ Video frame stream active - readyState:", video.readyState, "dimensions:", video.videoWidth, "x", video.videoHeight);
          resolve();
        };
        
        // Listen for canplay and loadeddata events
        video.addEventListener("canplay", handleReady);
        video.addEventListener("loadeddata", handleReady);
        
        // Attempt to play
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("Video playing successfully");
              // Proactively check if we can read frames
              if (video.readyState >= 2) {
                handleReady();
              }
            })
            .catch(err => console.warn("Video autoplay prevented (may resume):", err.message));
        }
        
        // Force video to keep playing with muted attribute
        // Some browsers need explicit play loop for MediaStream
        video.onplay = () => {
          console.log("🎮 Video onplay event fired");
        };
        
        video.onplaying = () => {
          console.log("🎬 Video onplaying event fired - frames advancing!");
          if (!resolved) {
            handleReady();
          }
        };
        
        // Fallback check for already-playing state
        setTimeout(() => {
          if (video.readyState >= 2) {
            handleReady();
          }
        }, 100);
        
        // Timeout after 10 seconds (increased from 5)
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            video.removeEventListener("canplay", handleReady);
            video.removeEventListener("loadeddata", handleReady);
            videoRef.current = video;
            console.warn("⚠️ Video stream timeout (readyState:", video.readyState + "). Continuing anyway - may need permission check.");
            resolve();
          }
        }, 10000);
        
        // Track and clear timeout on event
        const onReady = () => {
          clearTimeout(timeoutId);
        };
        video.addEventListener("canplay", onReady, { once: true });
      });
      
      return stream;
    } catch (err) {
      console.error("❌ Camera access error:", err);
      setError("Camera not available - check browser permissions");
      return null;
    }
  }, []);

  // Helper: Prepare video for detection
  const prepareVideoForDetection = useCallback(async (video: HTMLVideoElement) => {
    if (video.paused) {
      console.warn("⚠️ Video was paused, resuming...");
      try {
        await video.play();
      } catch (e) {
        console.error("Failed to resume video:", e);
      }
    }
    
    if (video.readyState < 2) {
      console.debug("Video not ready, readyState:", video.readyState);
      return false;
    }

    return true;
  }, []);

  // Helper: Detect faces with video or canvas fallback
  const detectFacesWithFallback = useCallback(async (video: HTMLVideoElement) => {
    if (!detectorRef.current) return null;
    
    let faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: true });

    if (faces.length === 0) {
      console.debug("No faces from video element, trying canvas approach...");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx && detectorRef.current) {
        try {
          ctx.drawImage(video, 0, 0);
          faces = await detectorRef.current.estimateFaces(canvas as any, { flipHorizontal: true });
        } catch (e) {
          console.error("Canvas detection failed:", e);
          return null;
        }
      }
    }

    return faces.length > 0 ? faces[0] : null;
  }, []);

  // Helper: Extract gaze position from face landmarks
  const extractGazeFromFace = useCallback((
    face: any,
    videoW: number,
    videoH: number
  ) => {
    const leftIris = face.keypoints?.[468];
    const rightIris = face.keypoints?.[473];
    const faceBbox = face.box ?? face.boundingBox;

    let rawGazeX: number;
    let rawGazeY: number;
    let leftIrisX: number;
    let leftIrisY: number;
    let rightIrisX: number;
    let rightIrisY: number;
    let confidence: number;

    // Use iris landmarks if available, otherwise use face center as fallback
    if (leftIris && rightIris && leftIris.x !== undefined && rightIris.x !== undefined) {
      rawGazeX = (leftIris.x + rightIris.x) / 2;
      rawGazeY = (leftIris.y + rightIris.y) / 2;
      leftIrisX = leftIris.x;
      leftIrisY = leftIris.y;
      rightIrisX = rightIris.x;
      rightIrisY = rightIris.y;
      confidence = 0.95;
    } else if (faceBbox && (faceBbox.xMin !== undefined || faceBbox.x !== undefined)) {
      // Fallback to face center if iris landmarks unavailable
      const xMin = faceBbox.xMin ?? faceBbox.x ?? 0;
      const xMax = faceBbox.xMax ?? (faceBbox.x ?? 0) + (faceBbox.width ?? 0);
      const yMin = faceBbox.yMin ?? faceBbox.y ?? 0;
      const yMax = faceBbox.yMax ?? (faceBbox.y ?? 0) + (faceBbox.height ?? 0);
      rawGazeX = (xMin + xMax) / 2;
      rawGazeY = (yMin + yMax) / 2;
      leftIrisX = xMin;
      leftIrisY = yMin;
      rightIrisX = xMax;
      rightIrisY = yMax;
      confidence = 0.7;
    } else {
      console.warn("No iris landmarks or face bbox available");
      return null;
    }

    const normalizedX = rawGazeX / videoW + calibrationRef.current.x;
    const normalizedY = rawGazeY / videoH + calibrationRef.current.y;

    return {
      gazeX: Math.max(0, Math.min(1, normalizedX)),
      gazeY: Math.max(0, Math.min(1, normalizedY)),
      leftIrisX,
      leftIrisY,
      rightIrisX,
      rightIrisY,
      confidence,
    };
  }, []);

  // Single frame detection
  const detectFace = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) {
      console.debug("Detector or video ref missing");
      return null;
    }
    
    const video = videoRef.current;
    
    const isReady = await prepareVideoForDetection(video);
    if (!isReady) return null;

    try {
      console.debug("Detecting - video:", {
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        srcObject: video.srcObject ? "stream active" : "no stream",
      });
      
      const face = await detectFacesWithFallback(video);
      if (!face) {
        setFaceDetected(false);
        return null;
      }

      console.log("✅ Face detected!");
      setFaceDetected(true);

      const videoW = video.videoWidth || 320;
      const videoH = video.videoHeight || 240;
      return extractGazeFromFace(face, videoW, videoH);
    } catch (err) {
      console.error("❌ Face detection error:", err);
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
      }
      setFaceDetected(false);
      return null;
    }
  }, [prepareVideoForDetection, detectFacesWithFallback, extractGazeFromFace]);

  // Helper: Analyze video frame content
  const analyzeFrameContent = useCallback((video: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    try {
      ctx.drawImage(video, 0, 0);
    } catch (e) {
      console.error("Failed to draw video to canvas:", e);
      return null;
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let nonBlackPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      totalBrightness += (r + g + b) / 3;
      if (Math.max(r, g, b) > 50) nonBlackPixels++;
    }
    
    const pixelCount = data.length / 4;
    const avgBrightnessNum = totalBrightness / pixelCount;
    const contentPercentNum = (nonBlackPixels / pixelCount) * 100;
    
    console.log(`📸 Frame analysis: brightness=${avgBrightnessNum.toFixed(0)}/255, content=${contentPercentNum.toFixed(1)}% (${canvas.width}x${canvas.height})`);
    
    if (avgBrightnessNum < 30) console.warn("⚠️ Frame is VERY DARK - check lighting!");
    if (contentPercentNum < 20) console.warn("⚠️ Frame is mostly empty/blank - check camera!");
    
    return { brightness: avgBrightnessNum, content: contentPercentNum };
  }, []);

  // Helper: Run face detection test
  const runFaceEstimation = useCallback(async (video: HTMLVideoElement) => {
    if (!detectorRef.current) return null;
    
    const startTime = performance.now();
    try {
      const faces = await detectorRef.current.estimateFaces(video, {
        flipHorizontal: true,
      });
      const elapsed = performance.now() - startTime;
      
      if (faces.length > 0) {
        console.log(`✅ estimateFaces FOUND ${faces.length} FACE(S) in ${elapsed.toFixed(1)}ms!`);
        return { success: true, faceCount: faces.length, elapsed };
      } else {
        console.log(`⏱️ estimateFaces ran for ${elapsed.toFixed(1)}ms but found 0 faces`);
        console.log("Video is streaming but model can't detect a face");
        console.log("Possible causes: no face visible, wrong angle, poor lighting, or model quirk");
        return { success: true, faceCount: 0, elapsed };
      }
    } catch (e) {
      const elapsed = performance.now() - startTime;
      console.error(`❌ estimateFaces threw error after ${elapsed.toFixed(1)}ms:`, e);
      return { success: false, faceCount: 0, elapsed, error: String(e) };
    }
  }, []);

  // Helper: Extract video setup and state checks
  const ensureVideoReady = useCallback(async (video: HTMLVideoElement) => {
    if (video.paused) {
      console.log("⚠️ Video was paused, forcing play...");
      try {
        await video.play();
      } catch (e) {
        console.warn("Could not force play:", e);
      }
    }
    
    const initialTime = video.currentTime;
    console.log("Video state:", {
      srcObject: video.srcObject ? "✅ stream" : "❌ no stream",
      paused: video.paused,
      readyState: video.readyState,
      width: video.videoWidth,
      height: video.videoHeight,
      currentTime: initialTime,
    });
    
    if (video.readyState < 2) {
      console.log("❌ Video readyState too low:", video.readyState);
      return null;
    }
    
    return initialTime;
  }, []);

  // Helper: Wait for frame to update
  const waitForFrameUpdate = useCallback(async (video: HTMLVideoElement, initialTime: number) => {
    await new Promise(r => {
      let frameCount = 0;
      const checkFrame = () => {
        frameCount++;
        if (frameCount > 5) {
          r(null);
        } else {
          requestAnimationFrame(checkFrame);
        }
      };
      requestAnimationFrame(checkFrame);
    });
    
    const afterRAFTime = video.currentTime;
    console.log(`⏱️ currentTime - Before: ${initialTime.toFixed(3)}, After RAF: ${afterRAFTime.toFixed(3)}, Changed: ${(afterRAFTime !== initialTime ? "YES ✅" : "NO ❌")}`);
    return afterRAFTime;
  }, []);

  // Helper: Run face estimation with canvas fallback
  const runFaceEstimationWithFallback = useCallback(async (video: HTMLVideoElement) => {
    try {
      console.log("🎬 Calling estimateFaces with video element...");
      const result = await runFaceEstimation(video);
      if (!result) return { success: false, error: "estimation_failed" };
      
      // If video element detection failed, try with canvas
      if (!result.success || (result.faceCount === 0 && result.success)) {
        console.log("⏰ Video element detection didn't work, trying canvas approach...");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0);
            console.log("🎨 Trying face estimation with canvas...");
            const canvasResult = await runFaceEstimation(canvas as any);
            if ((canvasResult?.faceCount || 0) > 0) {
              console.log("✅ Canvas approach found faces!");
              return { ...canvasResult, method: "canvas" };
            }
          } catch (canvasErr) {
            console.error("Canvas approach failed:", canvasErr);
          }
        }
      }
      
      return result;
    } catch (e) {
      console.error("❌ estimateFaces threw error:", e);
      return { error: String(e) };
    }
  }, [runFaceEstimation]);

  // Debug test function
  const testDetection = useCallback(async () => {
    console.log("🧪 Starting detection test...");
    if (!detectorRef.current) {
      console.log("❌ Detector not initialized");
      return "detector_missing";
    }
    if (!videoRef.current) {
      console.log("❌ Video reference missing");
      return "video_missing";
    }
    
    const video = videoRef.current;
    
    const initialTime = await ensureVideoReady(video);
    if (initialTime === null) return "readystate_low";
    
    const afterRAFTime = await waitForFrameUpdate(video, initialTime);
    analyzeFrameContent(video);
    
    const result = await runFaceEstimationWithFallback(video);
    return result ? { ...result, timingInfo: { initialTime, afterRAFTime } } : { error: "estimation_failed" };
  }, [ensureVideoReady, waitForFrameUpdate, runFaceEstimationWithFallback, analyzeFrameContent]);

  // Calibrate at a specific point
  const calibrateAtPoint = useCallback(async (targetX: number, targetY: number) => {
    const result = await detectFace();
    if (!result) return null;
    return {
      targetX,
      targetY,
      detectedX: result.gazeX,
      detectedY: result.gazeY,
      offsetX: targetX - result.gazeX,
      offsetY: targetY - result.gazeY,
    };
  }, [detectFace]);

  // Set calibration offsets
  const setCalibration = useCallback((offsets: { offsetX: number; offsetY: number }[]) => {
    if (offsets.length === 0) return;
    const avgX = offsets.reduce((s, o) => s + o.offsetX, 0) / offsets.length;
    const avgY = offsets.reduce((s, o) => s + o.offsetY, 0) / offsets.length;
    calibrationRef.current = { x: avgX, y: avgY };
  }, []);

  // Start tracking loop
  const startTracking = useCallback(() => {
    startTimeRef.current = Date.now();
    gazeDataRef.current = [];
    trackingRef.current = true;
    lastProcessTimeRef.current = 0;

    const loop = async () => {
      if (!trackingRef.current) return;

      const now = Date.now();
      if (now - lastProcessTimeRef.current >= PROCESS_INTERVAL) {
        lastProcessTimeRef.current = now;
        const result = await detectFace();

        if (result) {
          const elapsed = now - startTimeRef.current;
          const wordIndex = Math.floor((scrollOffset / 10) % Math.max(1, storyWords.length));

          const point: GazeDataPoint = {
            timestamp: elapsed,
            gazeX: result.gazeX,
            gazeY: result.gazeY,
            leftIrisX: result.leftIrisX,
            leftIrisY: result.leftIrisY,
            rightIrisX: result.rightIrisX,
            rightIrisY: result.rightIrisY,
            textScrollOffset: scrollOffset,
            currentWord: storyWords[wordIndex] || "",
            faceDetected: true,
            confidence: result.confidence,
          };

          gazeDataRef.current.push(point);
          onGazePoint?.(point);
        } else {
          // Still record a point with faceDetected=false for continuity
          const elapsed = now - startTimeRef.current;
          const point: GazeDataPoint = {
            timestamp: elapsed,
            gazeX: 0,
            gazeY: 0,
            leftIrisX: 0,
            leftIrisY: 0,
            rightIrisX: 0,
            rightIrisY: 0,
            textScrollOffset: scrollOffset,
            currentWord: "",
            faceDetected: false,
            confidence: 0,
          };
          gazeDataRef.current.push(point);
          onGazePoint?.(point);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [detectFace, onGazePoint, scrollOffset, storyWords]);

  const stopTracking = useCallback(() => {
    trackingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      // Stop all media tracks and remove video element
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => {
            t.stop();
            console.log("Stopped media track:", t.kind);
          });
        }
        // Remove video from DOM
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current);
        }
        videoRef.current = null;
      }
      
      // Clean up container
      if (containerRef.current?.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
        console.log("Removed video container");
        containerRef.current = null;
      }
    };
  }, []);

  return {
    modelLoaded,
    modelLoading,
    faceDetected,
    error,
    loadModel,
    startCamera,
    detectFace,
    testDetection,
    calibrateAtPoint,
    setCalibration,
    startTracking,
    stopTracking,
    gazeDataRef,
    videoRef,
  };
}
