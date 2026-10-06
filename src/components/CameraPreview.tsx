import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Lock, Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CameraPreviewProps {
  videoElement?: HTMLVideoElement | null;
  faceDetected?: boolean;
}

const CameraPreview = ({ videoElement, faceDetected = false }: CameraPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!videoElement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      if (videoElement.readyState >= 2) {
        setHasVideo(true);
        canvas.width = 80;
        canvas.height = 80;
        // Draw mirrored circular crop
        ctx.save();
        ctx.beginPath();
        ctx.arc(40, 40, 40, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(80, 0);
        ctx.scale(-1, 1);
        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;
        const size = Math.min(vw, vh);
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;
        ctx.drawImage(videoElement, sx, sy, size, size, 0, 0, 80, 80);
        ctx.restore();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [videoElement]);

  const borderColor = faceDetected ? "border-emerald-500" : "border-amber-400";

  return (
    <div className="relative inline-flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative group">
            {isMinimized ? (
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="w-10 h-10 rounded-full bg-card border-2 border-primary/40 flex items-center justify-center shadow-sm hover:scale-105 transition-all text-primary"
                title="Expand camera preview"
              >
                <Eye className="w-5 h-5" />
                <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-emerald-500' : 'bg-amber-400'} animate-pulse`} />
              </button>
            ) : (
              <div
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-3 ${borderColor} transition-all duration-300 shadow-sm`}
                style={{
                  boxShadow: faceDetected
                    ? "0 0 10px rgba(16, 185, 129, 0.4)"
                    : "0 0 8px rgba(245, 158, 11, 0.3)",
                }}
              >
                {!hasVideo ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] text-center text-slate-500 p-1 font-medium">
                    🔍 Finding face...
                  </div>
                ) : null}
                
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-cover"
                  style={{ display: hasVideo ? "block" : "none" }}
                />

                {/* Status Dot */}
                {hasVideo && (
                  <div
                    className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${
                      faceDetected ? "bg-emerald-500" : "bg-amber-400"
                    } animate-pulse border border-white`}
                  />
                )}

                {/* Minimize Button overlay */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold"
                  title="Minimize preview"
                >
                  Hide
                </button>
              </div>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="text-xs bg-slate-900 text-slate-100 p-2 max-w-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            Local Device Processing
          </div>
          <p className="text-slate-300">
            {faceDetected
              ? "✅ Face detected & gaze tracking active."
              : "⏳ Align face inside camera preview."}
            No video streams or images leave your browser.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default CameraPreview;

