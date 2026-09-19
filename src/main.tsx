import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyFontPreference, getFontPreference } from "./lib/fontPreferences";

applyFontPreference(getFontPreference());

createRoot(document.getElementById("root")!).render(<App />);
