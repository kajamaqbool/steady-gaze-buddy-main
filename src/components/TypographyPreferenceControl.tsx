import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFontPreference } from "@/hooks/useFontPreference";
import type { FontPreference } from "@/lib/fontPreferences";

const options: Array<{ value: FontPreference; label: string }> = [
  { value: "lexend", label: "Lexend" },
  { value: "dyslexic", label: "OpenDyslexic" },
];

const TypographyPreferenceControl = () => {
  const { preference, changePreference } = useFontPreference();

  return (
    <fieldset className="rounded-md border border-border bg-surface px-3 py-2">
      <legend className="sr-only">Reading font</legend>
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Reading font</span>
        <div className="ml-auto flex gap-1" role="group" aria-label="Choose reading font">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={preference === option.value ? "secondary" : "ghost"}
              aria-pressed={preference === option.value}
              onClick={() => changePreference(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </fieldset>
  );
};

export default TypographyPreferenceControl;
