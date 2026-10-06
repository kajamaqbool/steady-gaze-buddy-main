import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionData } from "@/types/gaze";
import { runFullAnalysis, type FullAnalysis } from "@/lib/featureExtraction";
import Confetti from "./Confetti";
import Mascot from "./Mascot";
import ReadingForestBackground from "./ReadingForestBackground";
import AdventureReward from "./AdventureReward";
import MlResultDisplay from "./MlResultDisplay";
import OralReadingScreen from "./OralReadingScreen";
import { useGazeStore } from "@/store/gazeStore";
import { Sparkles } from "lucide-react";

interface EndScreenProps {
  sessionData: SessionData;
  onPlayAgain: () => void;
}

const EndScreen = ({ sessionData, onPlayAgain }: EndScreenProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showStage2Modal, setShowStage2Modal] = useState(false);
  const [stage2Skipped, setStage2Skipped] = useState(false);

  const latestResult = useGazeStore((state) => state.latestResult);
  const speechResult = useGazeStore((state) => state.speechResult);

  const result: FullAnalysis = useMemo(
    () => runFullAnalysis(sessionData.gazePoints, sessionData.duration),
    [sessionData]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const download = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportAnalysis = useCallback(() => {
    const { fixations, saccades, regressions, ...exportData } = result;
    download(
      { ...exportData, fixationCount: fixations.length, saccadeCount: saccades.length, regressionCount: regressions.length, rawGazeData: sessionData.gazePoints },
      `dyslexia-analysis-${Date.now()}.json`
    );
  }, [result, sessionData, download]);

  const handleExportRaw = useCallback(() => {
    download(sessionData, `dyslexia-raw-${Date.now()}.json`);
  }, [sessionData, download]);

  const collected = sessionData.gazePoints.length;
  const lowQuality = collected < 250;

  // Stage 2 is conditionally triggered ONLY if gaze ML classification is MODERATE or HIGH
  const gazeClassification = latestResult?.classification;
  const isModerateOrHigh = gazeClassification === "MODERATE" || gazeClassification === "HIGH";
  const shouldPromptStage2 = isModerateOrHigh && !speechResult && !stage2Skipped;

  if (showStage2Modal) {
    return (
      <OralReadingScreen
        sessionId={useGazeStore.getState().lastEndedSessionId || undefined}
        language="en"
        onComplete={() => setShowStage2Modal(false)}
        onSkip={() => {
          setStage2Skipped(true);
          setShowStage2Modal(false);
        }}
        onBack={() => setShowStage2Modal(false)}
      />
    );
  }

  if (loading) {
    return (
      <ReadingForestBackground className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground animate-pulse font-display text-center">
          ✨ Wonderful reading! Getting your adventure ready... ✨
        </p>
        {/* Progress steps */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-4">
          <AnalysisStep label="Saving your journey..." delay={0} />
          <AnalysisStep label="Adding your discoveries..." delay={1000} />
          <AnalysisStep label="Opening your treasure chest..." delay={2000} />
        </div>
        <Mascot message="Lumi is opening your forest treasure chest..." state="loading" />
      </ReadingForestBackground>
    );
  }

  return (
    <ReadingForestBackground className="min-h-screen flex flex-col items-center p-4 sm:p-6 gap-5 overflow-y-auto">
      {showConfetti && <Confetti />}

      {/* Header with badge */}
      <div className="animate-fade-in-up text-center space-y-2 pt-4">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl sm:text-4xl font-bold text-primary font-display">
          Adventure Complete!
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          You made it through the whole story! 🎉
        </p>
      </div>

      {/* Low quality warning */}
      {lowQuality && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 max-w-sm text-center animate-fade-in-up">
          <p className="text-sm font-bold text-foreground">
            Want to take another reading adventure?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            A fresh adventure can help us follow your journey more closely.
          </p>
        </div>
      )}

      {/* Child-friendly completion summary */}
      <div className="bg-card rounded-2xl border border-border/80 shadow-md p-6 w-full max-w-md space-y-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <p className="text-center text-xl font-extrabold text-foreground font-display">Adventure Complete!</p>
        <AdventureReward title="Forest Explorer Badge Earned" description="You completed another reading adventure with Lumi!" />
        <p className="text-center text-xs text-muted-foreground">
          Your reading path has been saved privately on this device.
        </p>
      </div>

      {/* Stage 2 Recommendation Prompt Banner (Triggered ONLY when Gaze Classification is MODERATE or HIGH) */}
      {shouldPromptStage2 && (
        <div className="w-full max-w-4xl bg-indigo-50/90 border-2 border-indigo-300 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            One More Quick Check!
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-indigo-950 font-display">
            Stage 2: Read Aloud Assessment Recommended
          </h2>
          <p className="text-sm text-indigo-900 max-w-lg mx-auto leading-relaxed font-medium">
            One more quick check — read this passage aloud to help Lumi complete your full reading assessment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowStage2Modal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 min-h-[48px] transition-transform active:scale-95"
            >
              <span>🎙️</span>
              <span>Start Stage 2: Read Aloud</span>
            </button>
            <button
              type="button"
              onClick={() => setStage2Skipped(true)}
              className="w-full sm:w-auto px-5 py-3.5 text-indigo-800 hover:bg-indigo-100/70 font-semibold rounded-2xl text-sm min-h-[48px]"
            >
              Skip Stage 2 (View Gaze Results)
            </button>
          </div>
        </div>
      )}

      {/* Backend ML Analysis Results */}
      <div className="w-full max-w-4xl mt-2 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <MlResultDisplay />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4 pb-8 animate-fade-in-up w-full max-w-xl" style={{ animationDelay: "0.3s" }}>
        {!speechResult && (
          <button
            type="button"
            onClick={() => setShowStage2Modal(true)}
            className="flex-1 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 min-h-[48px] flex items-center justify-center gap-2"
          >
            <span>🎙️</span>
            <span>Stage 2: Oral Reading</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 px-5 py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 min-h-[48px] flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>{lowQuality ? "Try Again" : "Play Again"}</span>
        </button>

        <button
          type="button"
          onClick={handleExportAnalysis}
          className="flex-1 px-5 py-3.5 bg-secondary text-secondary-foreground rounded-xl text-base font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 min-h-[48px] flex items-center justify-center gap-2"
        >
          <span>📊</span>
          <span>Export Summary</span>
        </button>
      </div>

      <Mascot
        message={lowQuality ? "Want to explore again with me?" : "Lumi had fun exploring with you! 🌟"}
        state="completion"
        size="large"
      />
    </ReadingForestBackground>
  );
};

// Small helper components
const AnalysisStep = ({ label, delay }: { label: string; delay: number }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return <span className="animate-fade-in-up">✅ {label}</span>;
};

export default EndScreen;
