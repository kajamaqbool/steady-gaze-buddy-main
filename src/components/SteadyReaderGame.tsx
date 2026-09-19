import { useState, useEffect, useRef, useCallback } from "react";
import CameraPreview from "./CameraPreview";
import Mascot from "./Mascot";
import ReadingForestBackground from "./ReadingForestBackground";
import ForestAdventureShell from "./ForestAdventureShell";
import type { GazeDataPoint, SessionData } from "@/types/gaze";
import type { useEyeTracking } from "@/hooks/useEyeTracking";
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection";
import { useGazeStream } from "@/hooks/useGazeStream";
import SessionManager from "@/api/sessionManager";
import { stompClient } from "@/api/wsClient";
import type { AdventureConfig, AdventureEvent, AdventureSession } from "@/adventure/types";
import WordHuntStage from "./WordHuntStage";
import SyllablePopStage from "./SyllablePopStage";
import { useSpeechCapture } from "@/hooks/useSpeechCapture";
import type { SpeechCaptureRecord } from "@/hooks/useSpeechCapture";

interface SteadyReaderGameProps {
  onComplete: (data: SessionData) => void;
  eyeTracking: ReturnType<typeof useEyeTracking>;
  demoMode?: boolean;
  speechEnabled?: boolean;
}

const TARGET_POINTS = 300;
const CAPTURE_INTERVAL = 200;
const STORY_TEXT = "Once upon a time, in a small village, lived a curious boy named Raj. He loved exploring the forest near his home. One sunny day, Raj found a mysterious golden key hidden under an old oak tree. The key sparkled in the sunlight and felt warm in his hand. Raj wondered what door it could open. He decided to search for the lock that matched this special key. His adventure was just beginning, and he felt excited about the mysteries that awaited him in the forest. The birds sang cheerful songs as Raj walked deeper into the woods. He noticed colorful flowers and tall mushrooms along the path.";
const STORY_WORDS = STORY_TEXT.split(" ");
const FOREST_ADVENTURE: AdventureConfig = {
  id: "forest-adventure",
  title: "Lumi's Forest Adventure",
  constructId: "reading_gaze",
  durationSeconds: 60,
  activityType: "reading",
  instruction: "Follow Lumi along the story path and discover what comes next.",
  prompt: "Lumi found a storybook!",
  items: STORY_WORDS,
  stages: [
    { id: "word-hunt", label: "Word Hunt", enabled: true },
    { id: "line-racer", label: "Line Racer", enabled: false },
    { id: "syllable-pop", label: "Syllable Pop", enabled: true },
    { id: "story-builder", label: "Story Grove", enabled: true },
  ],
};

const ENABLED_STAGES = FOREST_ADVENTURE.stages.filter((stage) => stage.enabled);

const ENCOURAGEMENTS = [
  { time: 45, msg: "You're doing great! 🌟" },
  { time: 30, msg: "Keep reading! 📖" },
  { time: 15, msg: "Almost there! 💪" },
  { time: 5, msg: "Excellent work! 🎉" },
];

const SteadyReaderGame = ({ onComplete, eyeTracking, demoMode = false, speechEnabled = false }: SteadyReaderGameProps) => {
  const [timeLeft, setTimeLeft] = useState(FOREST_ADVENTURE.durationSeconds);
  const [started, setStarted] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [mascotMsg, setMascotMsg] = useState("Let's read a story! 📖");
  const [noFaceWarning, setNoFaceWarning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const gazeDataRef = useRef<GazeDataPoint[]>([]);
  const startTimeRef = useRef(0);
  const textRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const trackingIntervalRef = useRef<number>(0);
  const noFaceCountRef = useRef(0);
  const adventureSessionsRef = useRef<AdventureSession[]>([]);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const lastItemIndexRef = useRef(-1);
  const stageIdRef = useRef(ENABLED_STAGES[0]?.id);
  const speechCapturesRef = useRef<SpeechCaptureRecord[]>([]);

  const activeGame = FOREST_ADVENTURE;

  const createGameEvent = useCallback((
    type: AdventureEvent["type"],
    itemId?: string,
    value?: string,
    metadata?: AdventureEvent["metadata"],
  ): AdventureEvent => ({
    type,
    sessionId: sessionIdRef.current,
    gameId: activeGame.id,
    stageId: stageIdRef.current,
    constructId: activeGame.constructId,
    itemId,
    phase: "assessment",
    timestamp: Date.now(),
    value,
    metadata,
  }), [activeGame]);

  const recordGameEvent = useCallback((event: AdventureEvent) => {
    const currentGame = adventureSessionsRef.current[0];
    if (currentGame) currentGame.events.push(event);
  }, []);


  // STOMP & Streaming Integration
  const { connect } = useWebSocketConnection();
  const { streamFrame, start: startStream, stop: stopStream } = useGazeStream();
  const { isSupported: speechSupported, start: startSpeech, stop: stopSpeech, pause: pauseSpeech, resume: resumeSpeech } = useSpeechCapture({
    onComplete: (record) => speechCapturesRef.current.push(record),
  });
  const currentStage = ENABLED_STAGES[stageIndex];

  const handleStageEvent = useCallback((event: Pick<AdventureEvent, "type" | "itemId" | "value" | "metadata">) => {
    recordGameEvent(createGameEvent(event.type, event.itemId, event.value, event.metadata));
  }, [createGameEvent, recordGameEvent]);

  const advanceStage = useCallback(() => {
    recordGameEvent(createGameEvent("adventure.stage_completed"));
    const nextIndex = stageIndex + 1;
    if (nextIndex < ENABLED_STAGES.length) {
      stageIdRef.current = ENABLED_STAGES[nextIndex].id;
      lastItemIndexRef.current = -1;
      setStageIndex(nextIndex);
      recordGameEvent(createGameEvent("adventure.stage_started"));
      if (ENABLED_STAGES[nextIndex].id === "story-builder" && speechEnabled && speechSupported) {
        startSpeech().catch((error) => console.warn("Speech capture unavailable:", error));
      }
    }
  }, [stageIndex, createGameEvent, recordGameEvent, speechEnabled, speechSupported, startSpeech]);

  const togglePause = useCallback(() => {
    const nextPaused = !paused;
    recordGameEvent(createGameEvent(nextPaused ? "adventure.paused" : "adventure.resumed"));
    if (nextPaused) pauseSpeech();
    else resumeSpeech();
    setPaused(nextPaused);
  }, [paused, createGameEvent, recordGameEvent, pauseSpeech, resumeSpeech]);

  // Connect WebSocket on Mount
  // Do not auto-connect on mount. Connection happens when session starts.

  // Timer
  useEffect(() => {
    if (!started || timeLeft <= 0 || paused) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, timeLeft, paused]);

  // Complete the single adventure without exposing its internal timer.
  useEffect(() => {
    if (!started || timeLeft !== 0) return;

    const currentSession = adventureSessionsRef.current[0];
    if (currentSession) {
      currentSession.completedAt = Date.now();
      recordGameEvent(createGameEvent("adventure.stage_completed"));
      currentSession.events.push(createGameEvent("adventure.completed"));
    }

    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    stopStream();
    stopSpeech();
    SessionManager.endSession().catch(console.error);

    const session: SessionData = {
      startTime: startTimeRef.current,
      endTime: Date.now(),
      gazePoints: gazeDataRef.current,
      totalPointsTarget: TARGET_POINTS,
      duration: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
      miniGames: adventureSessionsRef.current,
      speechCaptures: speechCapturesRef.current,
    };

    onComplete(session);
  }, [timeLeft, started, onComplete, stopStream, stopSpeech, createGameEvent, recordGameEvent]);

  // Mascot messages
  useEffect(() => {
    if (!started) return;
    if (paused) {
      setMascotMsg("Move closer to the camera! 📷");
      return;
    }
    const enc = ENCOURAGEMENTS.find((e) => e.time === timeLeft);
    if (enc) setMascotMsg(enc.msg);
  }, [timeLeft, started, paused]);

  // Text scroll
  useEffect(() => {
    if (!started || timeLeft <= 0 || paused || currentStage?.id !== "story-builder") return;
    const frame = setInterval(() => {
      scrollRef.current += 1.5;
      setScrollOffset(scrollRef.current);
    }, 33);
    return () => clearInterval(frame);
  }, [started, timeLeft, paused, currentStage?.id]);

  // Gaze tracking
  useEffect(() => {
    if (!started || timeLeft <= 0 || currentStage?.id !== "story-builder") return;

    const interval = setInterval(async () => {
      if (paused) return;

      const elapsed = Date.now() - startTimeRef.current;
      const itemIndex = Math.floor((scrollRef.current / 80) % activeGame.items.length);
      if (itemIndex !== lastItemIndexRef.current) {
        if (lastItemIndexRef.current >= 0) {
          recordGameEvent(createGameEvent(
            "adventure.item_completed",
            `${activeGame.id}-${lastItemIndexRef.current}`,
            activeGame.items[lastItemIndexRef.current],
          ));
        }
        lastItemIndexRef.current = itemIndex;
        recordGameEvent(createGameEvent(
          "adventure.item_presented",
          `${activeGame.id}-${itemIndex}`,
          activeGame.items[itemIndex],
        ));
      }

      if (demoMode) {
        // We do not support demo mode generating synthetic data to backend
        return;
      }

      const result = await eyeTracking.detectFace();

      if (result) {
        noFaceCountRef.current = 0;
        setNoFaceWarning(false);
        if (paused) {
          console.log("Face re-detected, resuming game");
          setPaused(false);
        }

        const point: GazeDataPoint = {
          timestamp: elapsed,
          gazeX: result.gazeX,
          gazeY: result.gazeY,
          leftIrisX: result.leftIrisX,
          leftIrisY: result.leftIrisY,
          rightIrisX: result.rightIrisX,
          rightIrisY: result.rightIrisY,
          textScrollOffset: scrollRef.current,
          currentWord: activeGame.items[itemIndex] || "",
          faceDetected: true,
          confidence: result.confidence,
          gameId: activeGame.id,
          stageId: stageIdRef.current,
          constructId: activeGame.constructId,
          itemId: `${activeGame.id}-${itemIndex}`,
          phase: "assessment",
        };
        gazeDataRef.current.push(point);
        const currentGame = adventureSessionsRef.current[0];
        if (currentGame) {
          currentGame.signals.gazePointCount += 1;
          currentGame.signals.faceDetectedCount += 1;
        }
        // Push actual point to ML pipeline
        streamFrame(point);
      } else {
        noFaceCountRef.current += 1;
        
        const NO_FACE_PAUSE_THRESHOLD = 5;
        
        if (noFaceCountRef.current >= 2) {
          setNoFaceWarning(true);
        }
        
        if (noFaceCountRef.current >= NO_FACE_PAUSE_THRESHOLD) {
          console.warn("No face detected for > 1 second, pausing game");
          recordGameEvent(createGameEvent("adventure.paused"));
          setPaused(true);
        }

        const point: GazeDataPoint = {
          timestamp: elapsed,
          gazeX: 0, gazeY: 0,
          leftIrisX: 0, leftIrisY: 0,
          rightIrisX: 0, rightIrisY: 0,
          textScrollOffset: scrollRef.current,
          currentWord: "",
          faceDetected: false,
          confidence: 0,
          gameId: activeGame.id,
          stageId: stageIdRef.current,
          constructId: activeGame.constructId,
          itemId: `${activeGame.id}-${itemIndex}`,
          phase: "assessment",
        };
        gazeDataRef.current.push(point);
        const currentGame = adventureSessionsRef.current[0];
        if (currentGame) currentGame.signals.gazePointCount += 1;
        streamFrame(point);
      }
    }, CAPTURE_INTERVAL);

    trackingIntervalRef.current = interval as unknown as number;
    return () => clearInterval(interval);
  }, [started, timeLeft, eyeTracking, demoMode, paused, streamFrame, activeGame, currentStage?.id, createGameEvent, recordGameEvent]);

  // Auto-resume when face detected again
  useEffect(() => {
    if (!paused || demoMode) return;
    
    const check = setInterval(async () => {
      const result = await eyeTracking.detectFace();
      if (result) {
        // Check multiple times to confirm face is stable
        const confirmResult = await eyeTracking.detectFace();
        if (confirmResult) {
          noFaceCountRef.current = 0;
          setNoFaceWarning(false);
          console.log("Face confirmed after pause, resuming");
          recordGameEvent(createGameEvent("adventure.resumed"));
          resumeSpeech();
          setPaused(false);
        }
      }
    }, 300); // Check more frequently (was 500ms)
    
    return () => clearInterval(check);
  }, [paused, demoMode, eyeTracking, createGameEvent, recordGameEvent, resumeSpeech]);

  const handleStart = useCallback(async () => {
    // CRITICAL: Enforce proper session lifecycle
    // 1. Connect WebSocket (if not already)
    // 2. Create session in backend
    // 3. Start streaming frames
    
    console.log('[SteadyReaderGame] 🎮 Game START requested');
    
    if (!demoMode) {
      try {
        // Step 1: Ensure WebSocket is CONNECTED
        if (!stompClient.isConnected()) {
          console.log('[SteadyReaderGame] 🔌 WebSocket not connected, connecting now...');
          await connect();
          if (!stompClient.isConnected()) {
            throw new Error('WebSocket connection failed');
          }
        }
        console.log('[SteadyReaderGame] ✓ WebSocket CONNECTED');

        // Step 2: Start session in backend
        console.log('[SteadyReaderGame] 📝 Creating session in backend...');
        const sessionId = await SessionManager.startSession("steady-reader", { userId: "current-user" });
        sessionIdRef.current = sessionId;
        console.log('[SteadyReaderGame] ✓ Session created:', sessionId);

        // Step 3: Start frame streaming
        console.log('[SteadyReaderGame] 📤 Starting frame stream...');
        await startStream();
        console.log('[SteadyReaderGame] ✓ Frame streaming started');
      } catch (e) {
        console.error('[SteadyReaderGame] ❌ Failed to start game:', e);
        throw e;
      }
    } else {
      sessionIdRef.current = `demo-${Date.now()}`;
      console.log('[SteadyReaderGame] 🎮 Demo mode: starting without backend streaming');
    }

    startTimeRef.current = Date.now();
    scrollRef.current = 0;
    lastItemIndexRef.current = 0;
    gazeDataRef.current = [];
    adventureSessionsRef.current = [{
      gameId: FOREST_ADVENTURE.id,
      constructId: FOREST_ADVENTURE.constructId,
      startedAt: Date.now(),
      events: [
        {
          type: "adventure.started",
          sessionId: sessionIdRef.current,
          gameId: FOREST_ADVENTURE.id,
          constructId: FOREST_ADVENTURE.constructId,
          phase: "assessment",
          timestamp: Date.now(),
        },
        createGameEvent("adventure.instructions_shown"),
        createGameEvent("adventure.stage_started"),
        {
          type: "adventure.item_presented",
          sessionId: sessionIdRef.current,
          gameId: FOREST_ADVENTURE.id,
          constructId: FOREST_ADVENTURE.constructId,
          phase: "assessment",
          timestamp: Date.now(),
        },
      ],
      responses: [],
      signals: { gazePointCount: 0, faceDetectedCount: 0 },
    }];
    setStarted(true);
  }, [connect, demoMode, startStream, createGameEvent]);

  const adventureProgress = ((stageIndex + (currentStage?.id === "story-builder" ? 0.5 : 0)) / ENABLED_STAGES.length) * 100;

  if (!started) {
    return (
      <ReadingForestBackground className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center space-y-3 animate-fade-in-up">
          <h1 className="text-2xl sm:text-4xl font-bold text-primary font-display">
            📖 Steady Reader 📖
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-md">
            Lumi found a storybook in the Reading Forest. Let's explore it together!
          </p>
        </div>

        {!demoMode && (
          <div className="flex items-center gap-3">
            <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
            <span className="text-sm text-muted-foreground">
              {eyeTracking.modelLoaded ? "✅ Eye tracking ready" : "⏳ Loading model..."}
            </span>
          </div>
        )}

        {demoMode && (
          <div className="bg-secondary/15 border border-secondary/30 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm font-bold text-secondary">🎮 Demo Mode</p>
            <p className="text-xs text-muted-foreground">Simulated gaze data will be generated</p>
          </div>
        )}

        <Mascot message="Lumi found a storybook for us!" state="greeting" size="large" />
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-lg sm:text-xl font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[56px]"
        >
          Start Reading! 📚
        </button>
      </ReadingForestBackground>
    );
  }

  return (
    <ReadingForestBackground className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-6xl animate-gentle-bounce">📷</div>
          <p className="text-xl font-bold text-foreground font-display text-center">
            Lumi lost the forest trail.
          </p>
          <p className="text-base text-muted-foreground text-center max-w-xs">
            Move a little closer so Lumi can find you. The adventure will resume automatically.
          </p>
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin-slow" />
          <button
            type="button"
            onClick={togglePause}
            className="min-h-[52px] rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continue Adventure
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-card/80 backdrop-blur-sm shadow-sm z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          {!demoMode && (
            <CameraPreview videoElement={eyeTracking.videoRef.current} faceDetected={eyeTracking.faceDetected} />
          )}
          {demoMode && (
            <span className="text-xs font-bold text-secondary bg-secondary/15 px-2 py-1 rounded-full">DEMO</span>
          )}
          {noFaceWarning && !paused && (
            <span className="text-xs sm:text-sm text-muted-foreground font-bold animate-pulse">
              Let’s find your face again 📷
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={togglePause}
          className="min-h-[48px] rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={paused}
        >
          {paused ? "Continue Adventure" : "Take a Break"}
        </button>
        <div className="flex items-center gap-2 min-w-32" aria-label="Forest adventure progress">
          <span className="text-xs sm:text-sm font-bold text-muted-foreground whitespace-nowrap">
            {paused ? "Paused" : "Lumi's journey"}
          </span>
          <div className="w-16 sm:w-24 h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${adventureProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Story area */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        {currentStage?.id === "word-hunt" && <WordHuntStage onEvent={handleStageEvent} onComplete={advanceStage} />}
        {currentStage?.id === "syllable-pop" && <SyllablePopStage onEvent={handleStageEvent} onComplete={advanceStage} />}
        {currentStage?.id === "story-builder" && <ForestAdventureShell adventure={activeGame}>
          <div
            ref={textRef}
            className="whitespace-nowrap text-left text-foreground font-body leading-relaxed"
            style={{
              fontSize: "clamp(16px, 4vw, 22px)",
              lineHeight: 1.7,
              letterSpacing: "0.015em",
              transform: `translateX(-${scrollOffset}px)`,
              transition: "transform 33ms linear",
            }}
          >
            {STORY_TEXT}
          </div>
        </ForestAdventureShell>}
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between p-3 sm:p-4 bg-card/80 backdrop-blur-sm z-10">
          <Mascot message={mascotMsg} state={paused ? "thinking" : "encouraging"} />
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs sm:text-sm font-bold text-muted-foreground">Reading along</span>
          <div className="w-24 sm:w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${adventureProgress}%` }}
            />
          </div>
        </div>
      </div>
    </ReadingForestBackground>
  );
};

export default SteadyReaderGame;
