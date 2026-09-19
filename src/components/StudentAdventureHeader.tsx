import { Compass, UserRound } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type AdventureStep = "calibration" | "reading" | "complete";

interface StudentAdventureHeaderProps {
  step: AdventureStep;
  title: string;
  nextAction: string;
  progress: number;
  demoMode?: boolean;
}

const steps: Array<{ key: AdventureStep; label: string }> = [
  { key: "calibration", label: "Warm up" },
  { key: "reading", label: "Read" },
  { key: "complete", label: "Celebrate" },
];

const StudentAdventureHeader = ({
  step,
  title,
  nextAction,
  progress,
  demoMode = false,
}: StudentAdventureHeaderProps) => {
  const activeIndex = steps.findIndex((item) => item.key === step);

  return (
    <header className="relative z-20 w-full border-b border-border/70 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3 sm:gap-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent-foreground shadow-sm" aria-label="Your reading buddy">
          <span className="text-2xl" aria-hidden="true">🐻</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-display text-base font-bold text-foreground sm:text-lg">{title}</p>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              {nextAction}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={progress} className="h-2 flex-1" aria-label={`Adventure progress ${Math.round(progress)} percent`} />
            <span className="min-w-9 text-right text-xs font-semibold text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <nav aria-label="Adventure steps" className="mt-2 flex items-center gap-2">
            {steps.map((item, index) => (
              <span
                key={item.key}
                className={`text-[11px] font-semibold ${index <= activeIndex ? "text-primary" : "text-muted-foreground/60"}`}
              >
                {index > 0 && <span className="mr-2 text-border" aria-hidden="true">/</span>}
                {item.label}
              </span>
            ))}
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 rounded-pill border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground sm:flex">
          <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
          {demoMode ? "Practice" : "My adventure"}
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-6xl pl-14 text-xs font-medium text-muted-foreground sm:hidden">{nextAction}</p>
    </header>
  );
};

export default StudentAdventureHeader;