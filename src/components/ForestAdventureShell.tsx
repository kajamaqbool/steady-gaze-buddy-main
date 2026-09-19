import type { ReactNode } from "react";
import type { AdventureConfig } from "@/adventure/types";

interface ForestAdventureShellProps {
  adventure: AdventureConfig;
  children: ReactNode;
}

const ForestAdventureShell = ({ adventure, children }: ForestAdventureShellProps) => (
  <section className="w-full max-w-[60ch] space-y-5" aria-labelledby={`${adventure.id}-title`}>
    <div className="space-y-2 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.08em] text-primary">Forest adventure</p>
      <h2 id={`${adventure.id}-title`} className="font-display text-xl font-bold text-foreground sm:text-2xl">
        {adventure.prompt}
      </h2>
      <p className="text-sm text-muted-foreground">{adventure.instruction}</p>
    </div>
    <div className="min-h-[10rem]">{children}</div>
  </section>
);

export default ForestAdventureShell;
