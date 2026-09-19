import { useEffect, useState } from "react";
import { applyFontPreference, getFontPreference, type FontPreference } from "@/lib/fontPreferences";

export function useFontPreference() {
  const [preference, setPreference] = useState<FontPreference>(() => getFontPreference());

  useEffect(() => {
    const handlePreferenceChange = () => setPreference(getFontPreference());
    window.addEventListener("fontpreferencechange", handlePreferenceChange);
    return () => window.removeEventListener("fontpreferencechange", handlePreferenceChange);
  }, []);

  const changePreference = (nextPreference: FontPreference) => {
    setPreference(nextPreference);
    applyFontPreference(nextPreference);
  };

  return { preference, changePreference };
}
