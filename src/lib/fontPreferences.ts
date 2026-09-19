export type FontPreference = "lexend" | "dyslexic";

const STORAGE_KEY = "dyslex-shield-font-preference";

export function getFontPreference(): FontPreference {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dyslexic" ? "dyslexic" : "lexend";
  } catch {
    return "lexend";
  }
}

export function applyFontPreference(preference: FontPreference): void {
  document.documentElement.dataset.font = preference;
  window.dispatchEvent(new Event("fontpreferencechange"));
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Preferences remain active for the current session if storage is unavailable.
  }
}