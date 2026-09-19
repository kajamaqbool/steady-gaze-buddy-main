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
      <p className="text-sm font-bold uppercase tracking-[0.08em] text-primary">Today's adventure</p>
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Lumi's Forest Adventure</h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        Lumi found a magical path through the forest. Will you explore it together?
      </p>
    </div>
    <Mascot message="Hi! I'm Lumi. Ready to explore?" state="greeting" size="large" />
    <TypographyPreferenceControl />
    <label className="flex max-w-sm items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-left text-sm text-foreground">
      <input
        type="checkbox"
        checked={speechEnabled}
        onChange={(event) => setSpeechEnabled(event.target.checked)}
        className="mt-1 h-5 w-5 accent-primary"
      />
      <span>
        <span className="block font-bold">Let Lumi listen while you read</span>
        <span className="text-muted-foreground">Your voice stays on this device and is used only for this adventure.</span>
      </span>
    </label>
    <button
      type="button"
      onClick={() => onStart(speechEnabled)}
      className="min-h-[52px] rounded-xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Let's Explore!
    </button>
  </ReadingForestBackground>
  );
};

export default AdventureWelcome;
