import { useState } from "react";
import { Check, Compass } from "lucide-react";
import ReadingForestBackground from "./ReadingForestBackground";
import Mascot from "./Mascot";
import { saveExplorerProfile } from "@/adventure/profileStore";

const PROFILE_KEY = "dyslex-shield-explorer-avatar";
const profiles = [
  { id: "fox", label: "Fox", emoji: "🦊" },
  { id: "panda", label: "Panda", emoji: "🐼" },
  { id: "frog", label: "Frog", emoji: "🐸" },
];

interface ChildProfileSelectProps {
  onContinue: (avatarId: string) => void;
}

const ChildProfileSelect = ({ onContinue }: ChildProfileSelectProps) => {
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_KEY) ?? profiles[0].id;
    } catch {
      return profiles[0].id;
    }
  });

  const handleContinue = () => {
    saveExplorerProfile(selectedId);
    try {
      localStorage.setItem(PROFILE_KEY, selectedId);
    } catch {
      // The selection still applies for this session when storage is unavailable.
    }
    onContinue(selectedId);
  };

  return (
    <ReadingForestBackground className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center space-y-3 animate-fade-in-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-4xl">Who's exploring today?</h1>
        <p className="text-base text-muted-foreground">Choose a forest friend to join Lumi.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3" role="radiogroup" aria-label="Choose a forest friend">
        {profiles.map((profile) => {
          const selected = profile.id === selectedId;
          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedId(profile.id)}
              className={`relative flex min-h-[112px] min-w-[96px] flex-col items-center justify-center gap-2 rounded-md border-2 px-4 py-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"
              }`}
            >
              <span className="text-4xl" aria-hidden="true">{profile.emoji}</span>
              <span className="text-sm font-bold">{profile.label}</span>
              {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <Mascot message="Lumi is ready to explore with you!" state="greeting" size="large" />
      <button
        type="button"
        onClick={handleContinue}
        className="min-h-[52px] rounded-xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        That's me! Let's go
      </button>
    </ReadingForestBackground>
  );
};

export default ChildProfileSelect;
