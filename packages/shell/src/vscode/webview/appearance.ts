import {
  appearanceAttributes,
  appearanceFromBodyClasses,
  resolveAppearance,
  type Appearance,
  type Theme,
} from "../../core/index.js";
import { isAppearanceMessage } from "../protocol.js";

const NO_TRANSITION_CLASS = "cd-shell-no-transition";

/** The latest mode switch per `<html>`: only its second frame may lift the transition stop. */
const latestSwitch = new WeakMap<Element, number>();

function showsAppearance(element: Element, appearance: Appearance): boolean {
  const attributes = appearanceAttributes(appearance);
  return (
    element.getAttribute("data-cd-theme") === attributes["data-cd-theme"] &&
    element.getAttribute("data-cd-kontrast") === (attributes["data-cd-kontrast"] ?? null)
  );
}

/**
 * Writes `data-cd-theme` and `data-cd-kontrast` on `element` (default `<html>`) in one task, with
 * transitions suppressed for one frame: adds `cd-shell-no-transition` to `<html>`, sets both
 * attributes and removes the class in a nested `requestAnimationFrame` (after the last of several
 * quick switches).
 */
export function applyAppearance(appearance: Appearance, element?: HTMLElement): void {
  const target = element ?? document.documentElement;
  const html = target.ownerDocument.documentElement;
  const attributes = appearanceAttributes(appearance);
  const kontrast = attributes["data-cd-kontrast"];

  const switchId = (latestSwitch.get(html) ?? 0) + 1;
  latestSwitch.set(html, switchId);
  html.classList.add(NO_TRANSITION_CLASS);
  target.setAttribute("data-cd-theme", attributes["data-cd-theme"]);
  if (kontrast) target.setAttribute("data-cd-kontrast", kontrast);
  else target.removeAttribute("data-cd-kontrast");

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (latestSwitch.get(html) !== switchId) return;
      latestSwitch.delete(html);
      html.classList.remove(NO_TRANSITION_CLASS);
    }),
  );
}

export interface AppearanceListenerOptions {
  /** The modes the modeler can show; the body-class fallback resolves against them. */
  themes: readonly Theme[];
}

/**
 * Listens for `AppearanceMessage`s on `window` and applies them to `<html>`, resolved against
 * `themes` once more so a webview never shows a mode its bundle cannot. Until the first message
 * arrives, a `MutationObserver` on `<body>` applies the VS Code body classes as fallback (resolved
 * against `themes`); messages win from then on, because the body classes do not know the
 * `colorTheme` setting. The body classes are applied at once only when `<html>` has no
 * `data-cd-theme` yet; otherwise the attributes from `renderWebviewHtml` stand. Returns the
 * disconnect function. Throws when `themes` is empty.
 */
export function connectAppearance(options: AppearanceListenerOptions): () => void {
  const { themes } = options;
  if (themes.length === 0) {
    throw new Error("@miragon/modeler-shell: connectAppearance needs at least one theme");
  }
  const html = document.documentElement;
  const show = (requested: Appearance): void => {
    const resolved = resolveAppearance(requested, themes);
    if (!showsAppearance(html, resolved)) applyAppearance(resolved, html);
  };

  let fallbackActive = true;
  const applyBodyClasses = (): void => {
    if (!fallbackActive || !document.body) return;
    const requested = appearanceFromBodyClasses(document.body.classList);
    if (requested) show(requested);
  };
  const observer = new MutationObserver(applyBodyClasses);
  const startFallback = (): void => {
    if (!document.body) return;
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    if (!html.hasAttribute("data-cd-theme")) applyBodyClasses();
  };
  const stopFallback = (): void => {
    if (!fallbackActive) return;
    fallbackActive = false;
    observer.disconnect();
    document.removeEventListener("DOMContentLoaded", startFallback);
  };

  const onMessage = (event: MessageEvent): void => {
    if (!isAppearanceMessage(event.data)) return;
    stopFallback();
    show(event.data.appearance);
  };

  window.addEventListener("message", onMessage);
  if (document.body) startFallback();
  else document.addEventListener("DOMContentLoaded", startFallback, { once: true });

  return () => {
    window.removeEventListener("message", onMessage);
    stopFallback();
  };
}
