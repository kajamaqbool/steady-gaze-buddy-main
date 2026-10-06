import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import Mascot from "@/components/Mascot";
import ReadingForestBackground from "@/components/ReadingForestBackground";
import { useSpeechCapture, SpeechCaptureRecord } from "@/hooks/useSpeechCapture";
import { speechService } from "@/api/speechService";
import { SpeechAnalysisResponse } from "@/api/types";
import { getAuthErrorMessage } from "@/api/authService";
import {
  Mic,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
  Shield,
  FileAudio,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  BarChart3,
  FileText,
  Loader2,
} from "lucide-react";

const PASSAGE_TITLE = "The Little Garden";
const PASSAGE_PARAGRAPHS = [
  "Riya loved spending time in the small garden behind her house. Every morning, she watered the plants before going to school. One day, she noticed a tiny green bird sitting on a branch. The bird looked tired and could not fly away. Riya quietly brought a small bowl of water and placed it near the tree. After drinking the water, the bird moved its wings and jumped from one branch to another. Riya watched it carefully and smiled.",
  "The next morning, the bird returned to the garden. It sang a soft song while Riya watered the flowers. She began to visit the garden every day. Soon, she noticed that more birds were coming to the trees. Riya learned that even a small act of kindness could make a difference."
];

const COMPLETE_PASSAGE = PASSAGE_PARAGRAPHS.join("\n\n");

import { useGazeStore } from "@/store/gazeStore";

export interface OralReadingScreenProps {
  sessionId?: string;
  language?: string;
  onComplete?: (audioBlob: Blob | null, record: SpeechCaptureRecord | null, analysis?: SpeechAnalysisResponse | null) => void;
  onSkip?: () => void;
  onBack?: () => void;
}

export type OralReadingStatus = "idle" | "recording" | "uploading" | "processing" | "success" | "api_error";

export const OralReadingScreen: React.FC<OralReadingScreenProps> = ({
  sessionId,
  language = "en",
  onComplete,
  onSkip,
  onBack,
}) => {
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [speechRecord, setSpeechRecord] = useState<SpeechCaptureRecord | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [status, setStatus] = useState<OralReadingStatus>("idle");
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResponse | null>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  const processAudioUpload = async (audioBlob: Blob) => {
    setApiError(null);
    setStatus("uploading");

    try {
      // Transition smoothly from uploading to processing
      setTimeout(() => {
        setStatus((prev) => (prev === "uploading" ? "processing" : prev));
      }, 500);

      const targetSessionId = sessionId || useGazeStore.getState().lastEndedSessionId || useGazeStore.getState().session?.sessionId;

      const result = await speechService.uploadOralReadingAudio({
        audioBlob,
        referenceText: COMPLETE_PASSAGE,
        sessionId: targetSessionId || undefined,
        language,
      });

      setAnalysisResult(result);
      useGazeStore.getState().setSpeechResult(result);
      setStatus("success");
    } catch (err: any) {
      console.warn("[OralReadingScreen] Speech analysis backend error:", err);
      const friendlyErr = getAuthErrorMessage(
        err,
        "Unable to analyze the recording. Please try again."
      );
      setApiError(friendlyErr);
      setStatus("api_error");
    }
  };

  const handleSpeechCaptureComplete = useCallback(
    (record: SpeechCaptureRecord, audioBlob: Blob) => {
      setSpeechRecord(record);
      setRecordedBlob(audioBlob);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Automatically upload audio & request speech analysis
      processAudioUpload(audioBlob);
    },
    [sessionId, language]
  );

  const { isSupported, isCapturing, start, stop } = useSpeechCapture({
    onComplete: handleSpeechCaptureComplete,
  });

  // Clean up Object URL on unmount or retry
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Handle recording timer
  useEffect(() => {
    if (isCapturing) {
      setTimerSeconds(0);
      timerRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isCapturing]);

  const handleStartReading = async () => {
    setPermissionError(null);
    setApiError(null);
    setAnalysisResult(null);

    if (!isSupported) {
      setPermissionError("Microphone recording is not supported on this browser.");
      return;
    }

    try {
      const success = await start();
      if (success) {
        setStatus("recording");
      }
    } catch (err: any) {
      console.warn("Permission error in OralReadingScreen:", err);
      if (
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.message?.includes("denied")
      ) {
        setPermissionError("Microphone permission was denied. Please allow microphone access in your browser settings to proceed with oral reading.");
      } else {
        setPermissionError("Could not access microphone. Please check your audio input device.");
      }
      setStatus("idle");
    }
  };

  const handleStopReading = () => {
    stop();
  };

  const handleReadAgain = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordedBlob(null);
    setSpeechRecord(null);
    setAnalysisResult(null);
    setApiError(null);
    setTimerSeconds(0);
    setPermissionError(null);
    setStatus("idle");
  };

  const handleRetryUpload = () => {
    if (recordedBlob) {
      processAudioUpload(recordedBlob);
    }
  };

  const handleCopyTranscript = () => {
    if (analysisResult?.transcript) {
      navigator.clipboard.writeText(analysisResult.transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleFinishStage = () => {
    if (onComplete) {
      onComplete(recordedBlob, speechRecord, analysisResult);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <Navbar />

      <ReadingForestBackground className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Stage 2 Header Banner */}
        <section className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              Stage 2: Oral Reading Assessment
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground">
              {PASSAGE_TITLE}
            </h1>
            <p className="text-sm text-muted-foreground">
              Read the story out loud at your own comfortable pace when you are ready.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {status === "recording" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 font-extrabold text-sm animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                <span>Recording {formatTimer(timerSeconds)}</span>
              </div>
            )}
            {(status === "uploading" || status === "processing") && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-700 font-bold text-sm">
                <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                <span>Analyzing your reading...</span>
              </div>
            )}
            {status === "success" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Speech Analysis Complete ({Math.round((speechRecord?.durationMs || 0) / 1000)}s)</span>
              </div>
            )}
          </div>
        </section>

        {/* Permission Error Notification */}
        {permissionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm animate-fade-in-up">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Microphone Access Notice</p>
                <p className="text-xs text-rose-800">{permissionError}</p>
              </div>
            </div>
            {onSkip && (
              <Button size="sm" variant="outline" onClick={onSkip} className="shrink-0 border-rose-300 text-rose-900 hover:bg-rose-100 font-semibold rounded-xl text-xs">
                Skip this step →
              </Button>
            )}
          </div>
        )}

        {/* API / Network / Endpoint Error Notification */}
        {status === "api_error" && (
          <div className="p-5 bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl space-y-3 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-amber-950">Oral Reading Analysis Status</h3>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {apiError || "Unable to analyze the recording. Please try again."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" onClick={handleRetryUpload} className="rounded-xl font-bold text-xs bg-amber-700 text-white hover:bg-amber-800">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Analysis
              </Button>
              <Button size="sm" variant="outline" onClick={handleReadAgain} className="rounded-xl text-xs border-amber-300 text-amber-950">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Read Again
              </Button>
              {onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip} className="rounded-xl text-xs text-amber-900 hover:bg-amber-100 font-semibold ml-auto">
                  Skip Stage 2 →
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Reading Passage Card */}
        <section className="bg-card rounded-3xl border border-border/80 shadow-md p-6 sm:p-10 space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-2 text-primary font-bold text-base">
              <BookOpen className="w-5 h-5" />
              <span>Reading Passage</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface text-muted-foreground border border-border">
              The Little Garden
            </span>
          </div>

          <div className="space-y-6 text-foreground font-body text-base sm:text-lg lg:text-xl leading-relaxed sm:leading-loose text-justify sm:text-left select-none tracking-normal">
            {PASSAGE_PARAGRAPHS.map((paragraph, index) => (
              <p key={index} className="p-4 sm:p-5 rounded-2xl bg-surface/60 border border-border/40 shadow-xs">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {/* Recording Controls & Active Processing Card */}
        <section className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Mascot State & Guidance */}
            <div className="flex items-center gap-4 text-center sm:text-left">
              <Mascot
                emotion={
                  status === "recording"
                    ? "encouraging"
                    : status === "uploading" || status === "processing"
                    ? "thinking"
                    : status === "success"
                    ? "happy"
                    : "greeting"
                }
                size="sm"
                message={
                  status === "recording"
                    ? "Lumi is listening carefully as you read!"
                    : status === "uploading" || status === "processing"
                    ? "Analyzing your reading..."
                    : status === "success"
                    ? "Oral reading metrics calculated! Check your results below."
                    : status === "api_error"
                    ? "Your recording is safe! You can retry analysis or read again."
                    : "Click 'Start Reading' whenever you are ready!"
                }
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
              {status === "idle" && (
                <>
                  <Button
                    onClick={handleStartReading}
                    className="h-12 px-6 rounded-2xl font-bold text-base bg-primary text-primary-foreground hover:opacity-90 shadow-md flex items-center gap-2 min-h-[48px]"
                  >
                    <Mic className="w-5 h-5" />
                    Start Reading
                  </Button>
                  {onSkip && (
                    <Button
                      onClick={onSkip}
                      variant="outline"
                      className="h-12 px-4 rounded-2xl font-semibold text-sm border-border flex items-center gap-2 min-h-[48px]"
                    >
                      Skip Stage 2
                    </Button>
                  )}
                </>
              )}

              {status === "recording" && (
                <Button
                  onClick={handleStopReading}
                  className="h-12 px-6 rounded-2xl font-bold text-base bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-2 min-h-[48px] animate-pulse"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Stop Reading
                </Button>
              )}

              {(status === "uploading" || status === "processing") && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface border border-border text-sm font-bold text-muted-foreground">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span>Analyzing your reading...</span>
                </div>
              )}

              {(status === "success" || status === "api_error") && (
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <Button
                    onClick={handleReadAgain}
                    variant="outline"
                    className="h-11 px-4 rounded-xl font-semibold text-sm border-border flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Read Again
                  </Button>

                  <Button
                    onClick={handleFinishStage}
                    className="h-11 px-6 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 shadow-sm flex items-center gap-2"
                  >
                    <span>Complete Stage 2</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

          </div>

          {/* Local Audio Playback Controls */}
          {audioUrl && (
            <div className="pt-4 border-t border-border space-y-3 p-4 rounded-2xl bg-surface border border-border animate-fade-in-up">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <FileAudio className="w-4 h-4 text-primary" />
                  <span>Audio Recording Preview</span>
                </div>
                <span>{Math.round((speechRecord?.durationMs || 0) / 1000)}s</span>
              </div>

              <audio controls src={audioUrl} className="w-full h-10 rounded-xl" />
            </div>
          )}
        </section>

        {/* ORAL READING RESULTS SECTION */}
        {status === "success" && analysisResult && (
          <section className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  ORAL READING RESULTS
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official backend speech analysis evidence.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Speech Evaluated
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Words Correct</span>
                <div className="text-xl font-extrabold text-foreground">
                  {analysisResult.correctWords} <span className="text-xs font-normal text-muted-foreground">/ {analysisResult.totalWords}</span>
                </div>
                <span className="text-[10px] text-muted-foreground block">Words Read Correctly</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Accuracy</span>
                <div className="text-xl font-extrabold text-emerald-600">
                  {typeof analysisResult.accuracy === "number" ? `${analysisResult.accuracy}%` : "N/A"}
                </div>
                <span className="text-[10px] text-muted-foreground block">Reading Accuracy</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">WCPM</span>
                <div className="text-xl font-extrabold text-primary">
                  {typeof analysisResult.wcpm === "number" ? analysisResult.wcpm : "N/A"}
                </div>
                <span className="text-[10px] text-muted-foreground block">Words Correct Per Minute</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Substitutions</span>
                <div className="text-xl font-extrabold text-amber-600">
                  {analysisResult.substitutions ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground block">Substitutions</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Omissions</span>
                <div className="text-xl font-extrabold text-rose-600">
                  {analysisResult.omissions ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground block">Omissions</span>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Insertions</span>
                <div className="text-xl font-extrabold text-indigo-600">
                  {analysisResult.insertions ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground block">Insertions</span>
              </div>

            </div>

            {/* EXPANDABLE RECOGNIZED TRANSCRIPT SECTION */}
            <div className="rounded-2xl border border-border overflow-hidden bg-surface">
              <button
                type="button"
                onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">Recognized Speech</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isTranscriptExpanded ? "Hide" : "Show"}
                  </span>
                  {isTranscriptExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isTranscriptExpanded && (
                <div className="p-4 border-t border-border/60 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Transcript Text</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyTranscript}
                      className="h-7 text-xs px-2.5 rounded-lg border-border"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 mr-1 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Text
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-surface border border-border font-mono text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {analysisResult.transcript || "No transcript returned."}
                  </div>
                </div>
              )}
            </div>

          </section>
        )}

      </ReadingForestBackground>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        🔒 Dyslexia Shield Oral Reading Protocol • Private & Secure Speech Processing
      </footer>
    </div>
  );
};

export default OralReadingScreen;
