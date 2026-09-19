import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import type { AdventureEvent } from "@/adventure/types";

interface WordHuntStageProps {
  onEvent: (event: Pick<AdventureEvent, "type" | "itemId" | "value" | "metadata">) => void;
  onComplete: () => void;
}

const choices = ["moon", "leaf", "star", "river", "tree"];
const target = "star";

const WordHuntStage = ({ onEvent, onComplete }: WordHuntStageProps) => {
  const [found, setFound] = useState(false);

  const handleSelect = (choice: string) => {
    const responseAt = Date.now();
    onEvent({
      type: "adventure.response",
      itemId: "word-hunt-star",
      value: choice,
      metadata: { targetId: target, responseAt },
    });
    if (choice === target) {
      setFound(true);
      onEvent({
        type: "adventure.item_completed",
        itemId: "word-hunt-star",
        value: target,
        metadata: { targetId: target, responseAt },
      });
      window.setTimeout(onComplete, 450);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center" aria-labelledby="word-hunt-title">
      <div className="space-y-2">
        <Search className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h2 id="word-hunt-title" className="font-display text-2xl font-bold text-foreground">Help Lumi find a hidden word</h2>
        <p className="text-muted-foreground">Which word is glowing in the forest?</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label="Forest word choices">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => handleSelect(choice)}
            disabled={found}
            className={`min-h-[56px] rounded-md border-2 px-3 py-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              found && choice === target ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
      {found && <p className="flex items-center justify-center gap-2 font-bold text-primary" role="status"><Sparkles className="h-5 w-5" aria-hidden="true" /> Nice exploring!</p>}
    </div>
  );
};

export default WordHuntStage;
