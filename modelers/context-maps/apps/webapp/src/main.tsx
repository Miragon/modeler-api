import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted Miragon typeface (Geist + Geist Mono) — no CDN, works offline & GDPR-compliant.
// Registers the families 'Geist Variable' / 'Geist Mono Variable' used by app.css and the canvas.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
// The renderer's diagram-js chrome (palette, context pad, connection markers) + brand tokens.
// Imported explicitly here — the transitive side-effect import from the renderer entry is
// tree-shaken out of the production build, so relying on it leaves prod unstyled.
import "@miragon/context-maps-renderer/assets/context-maps.css";
import "./styles/app.css";
import App from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
