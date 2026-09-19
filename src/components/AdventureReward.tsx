import { Sparkles } from "lucide-react";

interface AdventureRewardProps {
  title: string;
  description: string;
}

const AdventureReward = ({ title, description }: AdventureRewardProps) => (
  <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
    <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    <div>
      <p className="font-display text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default AdventureReward;
