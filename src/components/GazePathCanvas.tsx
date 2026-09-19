import { useRef, useEffect } from "react";
import type { Fixation, Saccade } from "@/lib/featureExtraction";

interface GazePathCanvasProps {
  fixations: Fixation[];
  saccades: Saccade[];
  width?: number;
  height?: number;
}

const GazePathCanvas = ({ fixations, saccades, width = 500, height = 200 }: GazePathCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = "hsl(var(--muted))";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (fixations.length === 0) {
      ctx.fillStyle = "hsl(var(--muted-foreground))";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No fixation data available", width / 2, height / 2);
      return;
    }

    // Draw saccade lines
    ctx.strokeStyle = "hsl(var(--muted-foreground) / 0.3)";
    ctx.lineWidth = 1;
    for (const s of saccades) {
      ctx.beginPath();
      ctx.moveTo(s.fromX * width, s.fromY * height);
      ctx.lineTo(s.toX * width, s.toY * height);
      ctx.stroke();
    }

    // Draw regression arrows in red
    ctx.strokeStyle = "hsl(var(--destructive) / 0.6)";
    ctx.lineWidth = 2;
    for (const s of saccades.filter((s) => s.direction === "backward")) {
      ctx.beginPath();
      ctx.moveTo(s.fromX * width, s.fromY * height);
      ctx.lineTo(s.toX * width, s.toY * height);
      ctx.stroke();
    }

    // Draw fixation circles (size = duration)
    for (let i = 0; i < fixations.length; i++) {
      const f = fixations[i];
      const r = Math.max(3, Math.min(15, f.duration / 40));
      const x = f.centerX * width;
      const y = f.centerY * height;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(var(--primary) / ${0.3 + (i / fixations.length) * 0.5})`;
      ctx.fill();
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [fixations, saccades, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-xl border border-border bg-card"
    />
  );
};

export default GazePathCanvas;
