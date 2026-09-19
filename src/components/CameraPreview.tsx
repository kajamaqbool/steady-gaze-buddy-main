import { useEffect, useRef, useState } from "react";

interface CameraPreviewProps {
  videoElement?: HTMLVideoElement | null;
  faceDetected?: boolean;
}

const CameraPreview = ({ videoElement, faceDetected = false }: CameraPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

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

  const borderColor = faceDetected ? "border-success" : "border-primary";

  return (
    <div
      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 ${borderColor} transition-colors duration-300`}
      style={{ boxShadow: faceDetected ? "0 0 12px hsl(var(--success) / 0.5)" : "0 0 12px hsl(var(--primary) / 0.35)" }}
    >
      {!hasVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-center text-muted-foreground p-1">
          ✨ Lumi is nearby...
        </div>
      ) : null}
      <canvas ref={canvasRef} className="w-full h-full object-cover" style={{ display: hasVideo ? "block" : "none" }} />
      {hasVideo && (
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${faceDetected ? "bg-success" : "bg-primary"} animate-pulse`} />
      )}
    </div>
  );
};

export default CameraPreview;
