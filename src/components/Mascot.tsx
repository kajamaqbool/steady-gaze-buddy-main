export type MascotState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "encouraging"
  | "celebrating"
  | "guiding"
  | "loading"
  | "calibration"
  | "completion";

interface MascotProps {
  message: string;
  state?: MascotState;
  size?: "small" | "medium" | "large";
  animate?: boolean;
}

const Mascot = ({ message, state = "idle", size = "medium", animate = true }: MascotProps) => {
  const sizeClasses = {
    small: "w-11 h-11",
    medium: "w-14 h-14 sm:w-16 sm:h-16",
    large: "w-20 h-20 sm:w-24 sm:h-24",
  };

  return (
    <div
      className={`flex items-end gap-2 ${animate ? "animate-fade-in-up" : ""}`}
      aria-label={`Lumi says: ${message}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`lumi-mascot ${sizeClasses[size]} lumi-${state} select-none`}
        aria-hidden="true"
      >
        <span className="lumi-wing lumi-wing-left" />
        <span className="lumi-wing lumi-wing-right" />
        <span className="lumi-body">
          <span className="lumi-eye lumi-eye-left" />
          <span className="lumi-eye lumi-eye-right" />
          <span className="lumi-smile" />
        </span>
      </div>
      <div className="bg-card rounded-2xl rounded-bl-sm px-3 py-2 shadow-md max-w-[180px] sm:max-w-[220px]">
        <p className="text-sm sm:text-base font-bold text-foreground">{message}</p>
      </div>
    </div>
  );
};

export { Mascot as FireflyMascot };
export default Mascot;
