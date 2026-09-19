import type { FeatureAnalysisItem } from "@/lib/featureExtraction";

interface FeatureCardProps {
  item: FeatureAnalysisItem;
}

const FeatureCard = ({ item }: FeatureCardProps) => {
  const isNormal = item.status === "normal";

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-muted-foreground">{item.label}</span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isNormal
              ? "bg-success/20 text-success"
              : "bg-warning/20 text-warning"
          }`}
        >
          {isNormal ? "Normal" : "Review"}
        </span>
      </div>
      <div className="text-2xl font-bold text-foreground font-display">
        {item.value.toFixed(item.unit === "%" || item.unit === "WPM" ? 1 : 0)}
        <span className="text-sm font-normal text-muted-foreground ml-1">{item.unit}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Typical: </span>
        {item.normalRange}
      </div>
      <p className="text-xs text-muted-foreground/80">{item.description}</p>
    </div>
  );
};

export default FeatureCard;
