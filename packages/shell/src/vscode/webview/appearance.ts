import {
  REDUCED_MOTION_CLASS,
  appearanceAttributes,
  appearanceFromBodyClasses,
  reducedMotionFromBodyClasses,
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
 * `themes` once more so a webview never shows a mode its bundle cannot. A page whose `<html>` has
 * no `data-cd-theme` at connect (no `renderWebviewHtml`) falls back to the VS Code body classes,
 * through a `MutationObserver` on `<body>` until the first message (resolved against `themes`).
 * With the attributes of `renderWebviewHtml` there is no fallback: the extension's bridge knows the
 * `colorTheme` setting, the body classes do not, and VS Code changes them before the bridge's
 * message arrives, which would flash the mode without the setting. Returns the disconnect
 * function. Throws when `themes` is empty.
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

  let fallbackActive = !html.hasAttribute("data-cd-theme");
  const applyBodyClasses = (): void => {
    if (!fallbackActive || !document.body) return;
    const requested = appearanceFromBodyClasses(document.body.classList);
    if (requested) show(requested);
  };
  const observer = new MutationObserver(applyBodyClasses);
  const startFallback = (): void => {
    if (!fallbackActive || !document.body) return;
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    applyBodyClasses();
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
  else if (fallbackActive)
    document.addEventListener("DOMContentLoaded", startFallback, { once: true });

  return () => {
    window.removeEventListener("message", onMessage);
    fallbackActive = false;
    observer.disconnect();
    document.removeEventListener("DOMContentLoaded", startFallback);
  };
}

/**
 * Mirrors VS Code's `workbench.reduceMotion` (the body class `vscode-reduce-motion`, which VS Code
 * keeps up to date) as `REDUCED_MOTION_CLASS` on `<html>` for the whole session: the shell's
 * animations stop and an explicit fit jumps, as under `prefers-reduced-motion` (guide §5.14, §7).
 * Returns the disconnect function, which removes the class again.
 */
export function connectReducedMotion(): () => void {
  const html = document.documentElement;
  const apply = (): void => {
    if (document.body)
      html.classList.toggle(
        REDUCED_MOTION_CLASS,
        reducedMotionFromBodyClasses(document.body.classList),
      );
  };
  const observer = new MutationObserver(apply);
  const start = (): void => {
    if (!document.body) return;
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    apply();
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
  return () => {
    observer.disconnect();
    document.removeEventListener("DOMContentLoaded", start);
    html.classList.remove(REDUCED_MOTION_CLASS);
  };
}
