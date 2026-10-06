import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import CalibrationScreen from "@/components/CalibrationScreen";
import SteadyReaderGame from "@/components/SteadyReaderGame";
import EndScreen from "@/components/EndScreen";
import { useEyeTracking } from "@/hooks/useEyeTracking";
import type { SessionData } from "@/types/gaze";
import Mascot from "@/components/Mascot";
import ReadingForestBackground from "@/components/ReadingForestBackground";
import ChildProfileSelect from "@/components/ChildProfileSelect";
import AdventureWelcome from "@/components/AdventureWelcome";
import Navbar from "@/components/Navbar";

type GamePhase = "profile" | "welcome" | "loading" | "calibration" | "game" | "end";

const Index = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const normRole = role ? role.trim().toUpperCase() : null;
    if (normRole === 'PARENT') {
      navigate('/parent/dashboard', { replace: true });
    } else if (normRole === 'TEACHER') {
      navigate('/teacher/dashboard', { replace: true });
    }
  }, [role, navigate]);

  const [phase, setPhase] = useState<GamePhase>("profile");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Lumi is waking up the forest...");
  const [loadingStep, setLoadingStep] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  const eyeTracking = useEyeTracking({ enabled: true });

  useEffect(() => {
    if (demoMode || phase !== "loading") return;
    const init = async () => {
      try {
        setLoadingStep(1);
        setLoadingMessage("Lumi is finding the forest path... 🌿");
        console.log("\n🚀 === INITIALIZATION STARTED ===");
        console.log("Step 1: Loading FaceMesh model...");
        await eyeTracking.loadModel();
        console.log("Step 1: ✅ Model loaded, modelLoaded state:", eyeTracking.modelLoaded);

        setLoadingStep(2);
        setLoadingMessage("Lumi is checking the firefly trail... ✨");
        console.log("Step 2: Starting camera...");
        const stream = await eyeTracking.startCamera();
        if (!stream) {
          throw new Error("Camera stream is null");
        }
        console.log("Step 2: ✅ Camera started");

        // Give the video a moment to start streaming
        console.log("Waiting for video to stabilize...");
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify detection is working
        setLoadingStep(3);
        setLoadingMessage("Lumi is making sure the stars are ready... ⭐");
        let detectionWorking = false;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`\n[Test Attempt ${attempt + 1}] Calling testDetection()...`);
          const testResult = await eyeTracking.testDetection();
          if (testResult?.success && testResult?.faceCount > 0) {
            detectionWorking = true;
            console.log("✅✅✅ FACE DETECTED - SUCCESS!");
            break;
          }
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        setLoadingStep(3);
        setLoadingMessage("The Reading Forest is ready! ✨");
        setTimeout(() => setPhase("welcome"), 500);
      } catch (error) {
        console.error("❌ Init error:", error);
        setLoadingMessage("Error: " + String(error));
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, phase]);

  const handleProfileContinue = useCallback(() => {
    setPhase("loading");
  }, []);

  const handleWelcomeStart = useCallback((shouldCaptureSpeech: boolean) => {
    setSpeechEnabled(shouldCaptureSpeech);
    setPhase("calibration");
  }, []);

  const handleDemoMode = useCallback(() => {
    setDemoMode(true);
    setPhase("welcome");
  }, []);

  const handleRetryLoad = useCallback(() => {
    window.location.reload();
  }, []);

  const handleCalibrationComplete = useCallback(() => {
    setPhase("game");
  }, []);

  const handleGameComplete = useCallback((data: SessionData) => {
    setSessionData(data);
    eyeTracking.stopTracking();
    setPhase("end");
  }, [eyeTracking]);

  const handlePlayAgain = useCallback(() => {
    setSessionData(null);
    setPhase("calibration");
  }, []);

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Navbar />
        <ReadingForestBackground className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
          <p className="text-xl font-bold text-foreground font-display text-center">{loadingMessage}</p>
          <Mascot message="Lumi is getting the next adventure ready..." state="loading" />

          {/* Progress steps */}
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  loadingStep >= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {eyeTracking.error && (
            <div className="bg-secondary/15 border border-secondary/30 rounded-2xl p-5 max-w-sm text-center animate-fade-in-up">
              <p className="text-foreground font-bold text-base">Lumi needs a little help finding the forest path.</p>
              <p className="text-sm text-muted-foreground mt-2">
                {eyeTracking.error.includes("Camera")
                  ? "Please allow camera access, then try again."
                  : "Please check your connection and try again."}
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleRetryLoad}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold min-h-[48px]"
                >
                  🔄 Retry
                </button>
                <button
                  type="button"
                  onClick={handleDemoMode}
                  className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-bold min-h-[48px]"
                >
                  🎮 Demo Mode (No Camera)
                </button>
              </div>
            </div>
          )}

          {/* Demo mode shortcut */}
          {!eyeTracking.error && (
            <button
              type="button"
              onClick={handleDemoMode}
              className="mt-4 text-sm text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Skip → Demo Mode (testing)
            </button>
          )}

          <p className="text-xs text-muted-foreground/60 mt-4 text-center max-w-xs">
            🔒 All video processing happens on your device. Nothing is uploaded.
          </p>
        </ReadingForestBackground>
      </div>
    );
  }

  if (phase === "profile") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <ChildProfileSelect onContinue={handleProfileContinue} />
        </div>
      </div>
    );
  }

  if (phase === "welcome") {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <AdventureWelcome onStart={handleWelcomeStart} />
        </div>
      </div>
    );
  }

  switch (phase) {
    case "calibration":
      return (
        <CalibrationScreen
          onComplete={handleCalibrationComplete}
          eyeTracking={eyeTracking}
          demoMode={demoMode}
        />
      );
    case "game":
      return (
        <SteadyReaderGame
          onComplete={handleGameComplete}
          eyeTracking={eyeTracking}
          demoMode={demoMode}
          speechEnabled={speechEnabled}
        />
      );
    case "end":
      return sessionData ? (
        <div className="min-h-screen bg-background flex flex-col justify-between">
          <Navbar />
          <div className="flex-1">
            <EndScreen sessionData={sessionData} onPlayAgain={handlePlayAgain} />
          </div>
        </div>
      ) : null;
  }
};

export default Index;

