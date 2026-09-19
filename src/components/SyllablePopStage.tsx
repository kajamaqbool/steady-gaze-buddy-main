import { useEffect, useState } from "react";
import { AudioLines, Sparkles } from "lucide-react";
import type { AdventureEvent } from "@/adventure/types";

interface SyllablePopStageProps {
  onEvent: (event: Pick<AdventureEvent, "type" | "itemId" | "value" | "metadata">) => void;
  onComplete: () => void;
}

const syllables = ["for", "est"];

const SyllablePopStage = ({ onEvent, onComplete }: SyllablePopStageProps) => {
  const [popped, setPopped] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    syllables.forEach((syllable, index) => {
      const utterance = new SpeechSynthesisUtterance(syllable);
      utterance.rate = 0.8;
      window.setTimeout(() => window.speechSynthesis.speak(utterance), index * 850);
    });
    return () => window.speechSynthesis.cancel();
  }, []);

  const handlePop = (syllable: string) => {
    if (popped.includes(syllable)) return;
    const responseAt = Date.now();
    const nextPopped = [...popped, syllable];
    setPopped(nextPopped);
    onEvent({
      type: "adventure.response",
      itemId: `syllable-pop-${syllable}`,
      value: syllable,
      metadata: { targetSyllable: syllable, responseAt },
    });
    onEvent({
      type: "adventure.item_completed",
      itemId: `syllable-pop-${syllable}`,
      value: syllable,
      metadata: { targetSyllable: syllable, responseAt },
    });
    if (nextPopped.length === syllables.length) window.setTimeout(onComplete, 450);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center" aria-labelledby="syllable-pop-title">
      <div className="space-y-2">
        <AudioLines className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h2 id="syllable-pop-title" className="font-display text-2xl font-bold text-foreground">Pop Lumi's firefly bubbles</h2>
        <p className="text-muted-foreground">Listen for each little sound, then tap its bubble.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-5" role="group" aria-label="Syllable bubbles">
        {syllables.map((syllable) => {
          const isPopped = popped.includes(syllable);
          return (
            <button
              key={syllable}
              type="button"
              onClick={() => handlePop(syllable)}
              disabled={isPopped}
              className={`flex h-24 w-24 items-center justify-center rounded-full border-2 text-xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isPopped ? "border-primary bg-primary/15 text-primary" : "border-secondary bg-secondary/15 text-foreground hover:bg-secondary/25"
              }`}
            >
              {syllable}
            </button>
          );
        })}
      </div>
      {popped.length === syllables.length && <p className="flex items-center justify-center gap-2 font-bold text-primary" role="status"><Sparkles className="h-5 w-5" aria-hidden="true" /> Bubbles popped!</p>}
    </div>
  );
};

export default SyllablePopStage;
