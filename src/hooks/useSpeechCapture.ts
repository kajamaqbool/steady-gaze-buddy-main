import { useCallback, useRef, useState } from "react";

export interface SpeechCaptureRecord {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  mimeType: string;
}

interface UseSpeechCaptureOptions {
  onComplete?: (record: SpeechCaptureRecord, audio: Blob) => void;
}

export function useSpeechCapture({ onComplete }: UseSpeechCaptureOptions = {}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

  const stop = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") recorderRef.current.resume();
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || recorderRef.current?.state === "recording") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (autoStopTimerRef.current) {
          clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }
        const endedAt = Date.now();
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onComplete?.({
          startedAt: startedAtRef.current,
          endedAt,
          durationMs: endedAt - startedAtRef.current,
          mimeType: audio.type,
        }, audio);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsCapturing(false);
      };
      recorder.start();
      setIsCapturing(true);

      // Enforce 90-second maximum duration cap
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          console.log("[useSpeechCapture] 90-second cap reached. Auto-stopping recording.");
          recorderRef.current.stop();
        }
      }, 90000);

      return true;
    } catch (err) {
      console.warn("[useSpeechCapture] Microphone access failed or denied:", err);
      throw err;
    }
  }, [isSupported, onComplete]);

  return { isSupported, isCapturing, start, stop, pause, resume };
}
