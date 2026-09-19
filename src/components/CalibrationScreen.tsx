import { useEffect, useState, useCallback, useRef } from "react";
import Mascot from "./Mascot";
import CameraPreview from "./CameraPreview";
import ReadingForestBackground from "./ReadingForestBackground";
import TypographyPreferenceControl from "./TypographyPreferenceControl";
import type { useEyeTracking } from "@/hooks/useEyeTracking";

interface CalibrationScreenProps {
  onComplete: () => void;
  eyeTracking: ReturnType<typeof useEyeTracking>;
  demoMode?: boolean;
}

const STAR_POSITIONS = [
  { x: 15, y: 15, label: "top-left", normX: 0.15, normY: 0.15 },
  { x: 85, y: 15, label: "top-right", normX: 0.85, normY: 0.15 },
  { x: 50, y: 50, label: "center", normX: 0.5, normY: 0.5 },
  { x: 15, y: 85, label: "bottom-left", normX: 0.15, normY: 0.85 },
  { x: 85, y: 85, label: "bottom-right", normX: 0.85, normY: 0.85 },
];

const MASCOT_MESSAGES = [
  "Follow the stars with your eyes! ⭐",
  "Great job! Keep going!",
  "You're a star tracker! ✨",
  "Almost done!",
  "Perfect! Let's read! 📖",
];

const CalibrationScreen = ({ onComplete, eyeTracking, demoMode = false }: CalibrationScreenProps) => {
  const [currentStar, setCurrentStar] = useState(-1);
  const [started, setStarted] = useState(false);
  const [gazeStatus, setGazeStatus] = useState("");
  const calibrationOffsetsRef = useRef<{ offsetX: number; offsetY: number }[]>([]);

  const startCalibration = useCallback(() => {
    setStarted(true);
    setCurrentStar(0);
  }, []);

  const skipCalibration = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!started || currentStar < 0) return;

    if (currentStar >= STAR_POSITIONS.length) {
      if (!demoMode) {
        eyeTracking.setCalibration(calibrationOffsetsRef.current);
      }
      setGazeStatus("Lumi found every star! ✨");
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }

    const captureTimer = setTimeout(async () => {
      if (demoMode) {
        setGazeStatus("Lumi found it! ✨");
      } else {
        const pos = STAR_POSITIONS[currentStar];
        const result = await eyeTracking.calibrateAtPoint(pos.normX, pos.normY);
        if (result) {
          calibrationOffsetsRef.current.push({ offsetX: result.offsetX, offsetY: result.offsetY });
          setGazeStatus("Lumi found it! ✨");
        } else {
          setGazeStatus("Let's look for this star together.");
        }
      }
    }, 600);

    const advanceTimer = setTimeout(() => {
      setCurrentStar((prev) => prev + 1);
    }, 1200);

    return () => {
      clearTimeout(captureTimer);
      clearTimeout(advanceTimer);
    };
  }, [currentStar, started, onComplete, eyeTracking, demoMode]);

  if (!started) {
    return (
      <ReadingForestBackground className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center space-y-4 animate-fade-in-up">
          <h1 className="text-2xl sm:text-4xl font-bold text-primary font-display">
            ⭐ Help Lumi Find the Stars ⭐
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-md">
            Lumi is exploring the Reading Forest. Follow each glowing star with your eyes.
          </p>
        </div>

        {!demoMode && (
          <div className="flex items-center gap-4">
            <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
            <span className="text-sm text-muted-foreground">
              {eyeTracking.faceDetected ? "✅ Face detected!" : "👀 Position your face in the camera"}
            </span>
          </div>
        )}

        {demoMode && (
          <div className="bg-secondary/15 border border-secondary/30 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm font-bold text-secondary">🎮 Demo Mode</p>
            <p className="text-xs text-muted-foreground">Camera disabled — using simulated data</p>
          </div>
        )}

        <Mascot message="Can you help me find five stars?" state="greeting" size="large" />

        <TypographyPreferenceControl />

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={startCalibration}
            className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 min-h-[56px]"
          >
            Let's explore! 🌟
          </button>
          {demoMode && (
            <button
              onClick={skipCalibration}
              className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Take the short path
            </button>
          )}
        </div>
      </ReadingForestBackground>
    );
  }

  const done = currentStar >= STAR_POSITIONS.length;
  const mascotState = done ? "completion" : gazeStatus === "Lumi found it! ✨" ? "celebrating" : "calibration";

  return (
    <ReadingForestBackground className="min-h-screen relative overflow-hidden">
      {/* Progress + status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <div className="bg-card rounded-full px-4 py-2 shadow-md">
          <span className="text-sm sm:text-base font-bold text-foreground">
            {done ? "✨ The meadow is ready!" : "Help Lumi find the glowing star"}
          </span>
        </div>
        {gazeStatus && (
          <span className="text-sm text-muted-foreground animate-fade-in-up">{gazeStatus}</span>
        )}
      </div>

      {/* Camera preview */}
      {!demoMode && (
        <div className="absolute top-4 right-4 z-10">
          <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
        </div>
      )}

      {/* Stars */}
      {STAR_POSITIONS.map((pos, i) => (
        <div
          key={pos.label}
          className="absolute transition-all duration-300"
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <span
            className={`text-4xl sm:text-5xl inline-block transition-all duration-300 ${
              i === currentStar
                ? "animate-sparkle opacity-100 scale-100"
                : i < currentStar
                ? "opacity-30 scale-75"
                : "opacity-0 scale-50"
            }`}
          >
            ⭐
          </span>
        </div>
      ))}

      {/* Mascot */}
      <div className="absolute bottom-6 left-4 sm:left-6">
        <Mascot
          message={MASCOT_MESSAGES[Math.min(currentStar, MASCOT_MESSAGES.length - 1)] || "Great!"}
          state={mascotState}
        />
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-6 right-4 sm:right-6 flex gap-2">
        {STAR_POSITIONS.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              i < currentStar ? "bg-success" : i === currentStar ? "bg-primary animate-pulse" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </ReadingForestBackground>
  );
};

export default CalibrationScreen;
