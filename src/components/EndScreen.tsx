import { useState, useEffect, useMemo, useCallback } from "react";
import type { SessionData } from "@/types/gaze";
import { runFullAnalysis, type FullAnalysis } from "@/lib/featureExtraction";
import Confetti from "./Confetti";
import Mascot from "./Mascot";
import ReadingForestBackground from "./ReadingForestBackground";
import AdventureReward from "./AdventureReward";

interface EndScreenProps {
  sessionData: SessionData;
  onPlayAgain: () => void;
}

const EndScreen = ({ sessionData, onPlayAgain }: EndScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

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
      <div className="bg-card rounded-2xl shadow-lg p-5 w-full max-w-sm space-y-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <p className="text-center text-lg font-bold text-foreground font-display">Adventure complete!</p>
        <AdventureReward title="Forest Friend badge earned" description="You completed another adventure with Lumi." />
        <p className="text-center text-sm text-muted-foreground">
          Your reading path has been saved privately on this device.
        </p>
      </div>

      {/* Privacy notice */}
      <div className="text-xs text-muted-foreground/70 text-center max-w-sm animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        🔒 Your video stayed on your device. No images were uploaded.
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2 pb-8 animate-fade-in-up w-full max-w-md" style={{ animationDelay: "0.3s" }}>
        <button onClick={onPlayAgain} className="flex-1 px-5 py-3 bg-primary text-primary-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          🔄 {lowQuality ? "Try Again" : "Play Again"}
        </button>
        <button onClick={handleExportAnalysis} className="flex-1 px-5 py-3 bg-secondary text-secondary-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          📊 Grown-up Results
        </button>
        <button onClick={handleExportRaw} className="flex-1 px-5 py-3 bg-muted text-muted-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          📥 Raw Data
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
