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

      <div className="flex flex-wrap justify-center gap-4" role="radiogroup" aria-label="Choose a forest friend">
        {profiles.map((profile) => {
          const selected = profile.id === selectedId;
          return (
            <button
              key={profile.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedId(profile.id)}
              className={`relative flex min-h-[120px] min-w-[110px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-5 py-4 text-foreground transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? "border-primary bg-primary/10 shadow-sm" : "border-border/80 bg-card hover:bg-muted/50"
              }`}
            >
              <span className="text-4xl" aria-hidden="true">{profile.emoji}</span>
              <span className="text-sm font-bold font-display">{profile.label}</span>
              {selected && (
                <div className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Mascot message="Lumi is ready to explore with you!" state="greeting" size="large" />
      
      <button
        type="button"
        onClick={handleContinue}
        className="min-h-[52px] rounded-xl bg-primary px-8 py-3.5 text-lg font-bold text-primary-foreground shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        That's me! Let's go 🌟
      </button>
    </ReadingForestBackground>
  );
};

export default ChildProfileSelect;
