import {
  APPEARANCE_STORAGE_KEY,
  documentMode,
  parseAppearanceChoice,
  type AppearanceChoice,
  type Theme,
} from "../../core/index.js";
import { createElement, toggleAttribute } from "../element.js";
import type { AppearanceHandle, StorageLike, WebAppearanceOptions } from "../types.js";

export interface WebAppearanceContext {
  ownerDocument: Document;
  themes: readonly Theme[];
  /** Required when `themes` includes `"dark"`; read only then. */
  options: WebAppearanceOptions | undefined;
}

export interface WebAppearanceController extends AppearanceHandle {
  /** Stops following `prefers-contrast` and other tabs' `storage` events; leaves `<html>` as it is. */
  destroy(): void;
}

/** On `<html>` for one frame of a mode switch (guide §7); shell-dom.css turns every transition off. */
export const NO_TRANSITION_CLASS = "cd-shell-no-transition";

const CONTRAST_QUERY = "(prefers-contrast: more)";
const SCHEME_MEDIA: Readonly<Record<Theme, string>> = {
  light: "(prefers-color-scheme: light)",
  dark: "(prefers-color-scheme: dark)",
};

/** `change` on a media query list; Safari before 14 only has `addListener`. */
function onMediaChange(query: MediaQueryList, listener: () => void): () => void {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }
  query.addListener(listener);
  return () => query.removeListener(listener);
}

/**
 * The web host's mode at runtime (guide §13.3), after the head script (`webModeScript`) set it
 * before the first paint. Always: mirrors `(prefers-contrast: more)` as `data-cd-kontrast="hoch"`
 * on `<html>`, at once and on every change. With `"dark"` in `themes` (throws without `options`):
 * `choice()` is the stored choice, read once through `parseAppearanceChoice` (a blocked storage
 * reads `"system"`) and then kept by `setChoice` and other tabs' `storage` events, so a choice the
 * storage refused still holds for the page. `setChoice` writes it (`"system"` removes the key; a
 * throwing storage is ignored) and applies `documentMode` on `<html data-cd-theme>`,
 * `<meta name="color-scheme">` and both `theme-color` metas (created where missing) in one task,
 * with `cd-shell-no-transition` on `<html>` until a nested `requestAnimationFrame`; a `storage`
 * event for the key applies the same way. Light-only: `choice()` is `"system"`, `setChoice` does
 * nothing.
 */
export function connectWebAppearance(context: WebAppearanceContext): WebAppearanceController {
  const { ownerDocument, themes, options } = context;
  const darkCapable = themes.includes("dark");
  if (darkCapable && !options) {
    throw new Error(
      '@miragon/modeler-shell: a web modeler whose themes include "dark" needs the appearance option ' +
        "({ themeColors } from its vendored cd-tokens.generated.json)",
    );
  }
  const html = ownerDocument.documentElement;
  const view = ownerDocument.defaultView;
  const cleanups: (() => void)[] = [];

  const contrast =
    typeof view?.matchMedia === "function" ? view.matchMedia(CONTRAST_QUERY) : undefined;
  if (contrast) {
    const mirrorContrast = (): void =>
      toggleAttribute(html, "data-cd-kontrast", contrast.matches && "hoch");
    mirrorContrast();
    cleanups.push(onMediaChange(contrast, mirrorContrast));
  }

  function destroy(): void {
    for (const cleanup of cleanups.splice(0)) cleanup();
  }

  if (!darkCapable || !options) {
    return { choice: () => "system", setChoice() {}, destroy };
  }
  const { themeColors } = options;

  function storage(): StorageLike | undefined {
    if (options?.storage) return options.storage;
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }

  function readStored(): AppearanceChoice {
    try {
      return parseAppearanceChoice(storage()?.getItem(APPEARANCE_STORAGE_KEY));
    } catch {
      return "system";
    }
  }

  function store(choice: AppearanceChoice): void {
    try {
      const target = storage();
      if (choice === "system") target?.removeItem(APPEARANCE_STORAGE_KEY);
      else target?.setItem(APPEARANCE_STORAGE_KEY, choice);
    } catch {
      // Blocked or full: the choice still applies for this page.
    }
  }

  function nextFrame(callback: () => void): () => void {
    if (view && typeof view.requestAnimationFrame === "function") {
      const frame = view.requestAnimationFrame(() => callback());
      return () => view.cancelAnimationFrame(frame);
    }
    const timer = setTimeout(callback, 16);
    return () => clearTimeout(timer);
  }

  let cancelTransitionFrame: (() => void) | undefined;
  function allowTransitions(): void {
    cancelTransitionFrame?.();
    cancelTransitionFrame = undefined;
    html.classList.remove(NO_TRANSITION_CLASS);
  }
  cleanups.push(() => {
    if (cancelTransitionFrame) allowTransitions();
  });

  // The first frame still computes styles with the new colours; only after it may they fade again.
  function suspendTransitions(): void {
    cancelTransitionFrame?.();
    html.classList.add(NO_TRANSITION_CLASS);
    cancelTransitionFrame = nextFrame(() => {
      cancelTransitionFrame = nextFrame(allowTransitions);
    });
  }

  function metaFor(name: string, media?: string): HTMLMetaElement {
    const normalize = (value: string | null): string =>
      (value ?? "").replace(/\s+/g, "").toLowerCase();
    const existing = [
      ...ownerDocument.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`),
    ].find((meta) =>
      media === undefined ? true : normalize(meta.getAttribute("media")) === normalize(media),
    );
    if (existing) return existing;
    const created = createElement(ownerDocument, "meta", { name, media });
    (ownerDocument.head ?? html).append(created);
    return created;
  }

  function apply(choice: AppearanceChoice): void {
    const mode = documentMode(choice, themes, themeColors);
    suspendTransitions();
    html.setAttribute("data-cd-theme", mode.theme);
    metaFor("color-scheme").setAttribute("content", mode.colorScheme);
    metaFor("theme-color", SCHEME_MEDIA.light).setAttribute("content", mode.themeColor.light);
    metaFor("theme-color", SCHEME_MEDIA.dark).setAttribute("content", mode.themeColor.dark);
  }

  let current = readStored();

  const onStorage = (event: StorageEvent): void => {
    // A null key is a clear() of the whole storage: the choice is gone, so "system".
    if (event.key !== null && event.key !== APPEARANCE_STORAGE_KEY) return;
    const next = event.key === null ? "system" : parseAppearanceChoice(event.newValue);
    if (next === current) return;
    current = next;
    apply(next);
  };
  if (view) {
    view.addEventListener("storage", onStorage);
    cleanups.push(() => view.removeEventListener("storage", onStorage));
  }

  return {
    choice: () => current,
    setChoice(choice) {
      const next = parseAppearanceChoice(choice);
      current = next;
      store(next);
      apply(next);
    },
    destroy,
  };
}
