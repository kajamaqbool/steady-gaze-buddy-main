import { useState } from "react";
import ReadingForestBackground from "./ReadingForestBackground";
import Mascot from "./Mascot";
import TypographyPreferenceControl from "./TypographyPreferenceControl";

interface AdventureWelcomeProps {
  onStart: (speechEnabled: boolean) => void;
}

const AdventureWelcome = ({ onStart }: AdventureWelcomeProps) => {
  const [speechEnabled, setSpeechEnabled] = useState(false);

  return (
  <ReadingForestBackground className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
    <div className="max-w-md space-y-3 text-center animate-fade-in-up">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Today's Adventure</p>
      <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">Lumi's Forest Adventure</h1>
      <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
        Lumi found a magical path through the reading forest. Follow along as the story unfolds!
      </p>
    </div>
    
    <Mascot message="Hi! I'm Lumi. Ready to explore the forest?" state="greeting" size="large" />
    
    <div className="w-full max-w-sm space-y-3">
      <TypographyPreferenceControl />
      <label className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left text-sm text-foreground shadow-xs cursor-pointer hover:bg-muted/40 transition-colors">
        <input
          type="checkbox"
          checked={speechEnabled}
          onChange={(event) => setSpeechEnabled(event.target.checked)}
          className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary accent-primary"
        />
        <span>
          <span className="block font-bold">Let Lumi listen while you read</span>
          <span className="text-xs text-muted-foreground leading-normal block mt-0.5">
            🔒 Voice processing stays private on this device.
          </span>
        </span>
      </label>
    </div>

    <button
      type="button"
      onClick={() => onStart(speechEnabled)}
      className="min-h-[52px] rounded-xl bg-primary px-8 py-3.5 text-lg font-bold text-primary-foreground shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Let's Explore! 📖
    </button>
  </ReadingForestBackground>
  );
};

export default AdventureWelcome;
