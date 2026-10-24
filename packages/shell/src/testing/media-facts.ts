import type { MotionRecord, ToolWindow } from "./page-tools.js";

/*
 * Snapshots of the `reducedMotion` and `forcedColors` cases, judged in Node (`media-checks.ts`).
 * Each probe runs in the page and must stay self-contained (see page-tools.ts).
 */

/** Where the motion probes look: the shell root's subtree, or the whole document the modeler owns. */
export interface MotionScope {
  root: string;
  wholeDocument: boolean;
  /** Shorter transitions and animations do not move (the guide's reduced-motion rule sets 0.001ms). */
  thresholdMs: number;
}

/**
 * Every transition and animation a computed style sets for longer than `thresholdMs`, on the
 * elements in scope and their `::before` and `::after`; `null` without the shell root.
 */
export const motionStylesProbe = ({
  root,
  wholeDocument,
  thresholdMs,
}: MotionScope): MotionRecord[] | null => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const rootElement = document.querySelector(root);
  if (!rootElement) return null;
  const scope = wholeDocument ? document.documentElement : rootElement;
  const durations = (value: string): number[] =>
    value.split(",").map((part) => {
      const text = part.trim();
      const number = parseFloat(text);
      return text.endsWith("ms") ? number : number * 1000;
    });
  const found: MotionRecord[] = [];
  const read = (element: Element, pseudo: "" | "::before" | "::after") => {
    const style = getComputedStyle(element, pseudo || null);
    if (pseudo && ["none", "normal", ""].includes(style.content ?? "")) return;
    const description = `${tools.describe(element)}${pseudo}`;
    const transitionDurations = durations(style.transitionDuration || "0s");
    (style.transitionProperty || "none").split(",").forEach((property, index) => {
      const durationMs = transitionDurations[index % transitionDurations.length] ?? 0;
      const name = property.trim();
      if (name !== "none" && durationMs > thresholdMs)
        found.push({ description, kind: "transition", name, durationMs });
    });
    const animationDurations = durations(style.animationDuration || "0s");
    (style.animationName || "none").split(",").forEach((animation, index) => {
      const durationMs = animationDurations[index % animationDurations.length] ?? 0;
      const name = animation.trim();
      if (name !== "none" && durationMs > thresholdMs)
        found.push({ description, kind: "animation", name, durationMs });
    });
  };
  for (const element of [scope, ...scope.querySelectorAll("*")]) {
    if (element.closest("[data-modeler-shell-conformance]")) continue;
    read(element, "");
    if (element instanceof SVGElement) continue;
    read(element, "::before");
    read(element, "::after");
  }
  return found;
};

/**
 * Starts recording, frame by frame, every running animation in scope that lasts longer than
 * `thresholdMs`: CSS transitions and animations and `element.animate()` alike. `false` without the
 * shell root or without `document.getAnimations`.
 */
export const watchMotionProbe = ({ root, wholeDocument, thresholdMs }: MotionScope): boolean => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  tools.motionWatch?.stop();
  tools.motionWatch = undefined;
  const rootElement = document.querySelector(root);
  if (!rootElement || typeof document.getAnimations !== "function") return false;
  const seen = new Map<string, MotionRecord>();
  let watching = true;
  const sample = () => {
    if (!watching) return;
    for (const animation of document.getAnimations()) {
      if (animation.playState !== "running") continue;
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target;
      if (!effect || !target) continue;
      if (!wholeDocument && !rootElement.contains(target)) continue;
      if (target.closest("[data-modeler-shell-conformance]")) continue;
      const durationMs = Number(effect.getComputedTiming().activeDuration);
      if (!(durationMs > thresholdMs)) continue;
      const transition = (animation as Animation & { transitionProperty?: string })
        .transitionProperty;
      const keyframes = (animation as Animation & { animationName?: string }).animationName;
      const record: MotionRecord =
        transition !== undefined
          ? { description: "", kind: "transition", name: transition, durationMs }
          : keyframes !== undefined
            ? { description: "", kind: "animation", name: keyframes, durationMs }
            : { description: "", kind: "script", name: "", durationMs };
      record.description = `${tools.describe(target)}${effect.pseudoElement ?? ""}`;
      seen.set(`${record.description} ${record.kind} ${record.name}`, record);
    }
    requestAnimationFrame(sample);
  };
  sample();
  tools.motionWatch = {
    records: () => [...seen.values()],
    stop: () => {
      watching = false;
    },
  };
  return true;
};

/** Stops the motion recorder; what it saw (nothing after a navigation dropped it). */
export const motionWatchProbe = (_: null): MotionRecord[] => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const watch = tools.motionWatch;
  tools.motionWatch = undefined;
  watch?.stop();
  return watch?.records() ?? [];
};

/**
 * Starts recording the canvas's view (the viewport layer's matrix, as `labelEditorProbe` reads it)
 * whenever a frame shows a new one; `false` without a canvas.
 */
export const watchViewProbe = ({ root }: { root: string }): boolean => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  tools.viewWatch?.stop();
  tools.viewWatch = undefined;
  const viewport = document
    .querySelector(root)
    ?.querySelector<SVGGraphicsElement>(".djs-container > svg > .viewport");
  if (!viewport) return false;
  const read = (): string => {
    const matrix = viewport.transform?.baseVal?.consolidate?.()?.matrix;
    return matrix
      ? [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
          .map((value) => Math.round(value * 1000) / 1000)
          .join(" ")
      : (viewport.getAttribute("transform") ?? "");
  };
  const views = [read()];
  let watching = true;
  const sample = () => {
    if (!watching) return;
    const view = read();
    if (view !== views[views.length - 1]) views.push(view);
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  tools.viewWatch = {
    views,
    stop: () => {
      watching = false;
    },
  };
  return true;
};

/** Stops the view recorder; the views it saw, the one it started on first. */
export const viewWatchProbe = (_: null): string[] => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const watch = tools.viewWatch;
  tools.viewWatch = undefined;
  watch?.stop();
  return watch ? [...watch.views] : [];
};

/** Puts VS Code's `workbench.reduceMotion` on the host page (the body class VS Code sets), or takes it off. */
export const hostReduceMotionProbe = (reduceMotion: boolean): void => {
  document.body.classList.toggle("vscode-reduce-motion", reduceMotion);
};

/** One side of a border as computed. */
export interface BorderSideFacts {
  width: number;
  style: string;
  color: string;
}

export interface BorderFacts {
  top: BorderSideFacts;
  right: BorderSideFacts;
  bottom: BorderSideFacts;
  left: BorderSideFacts;
}

/** The system colours of forced colours, resolved to computed colours inside the root. */
export interface SystemColorFacts {
  canvas: string;
  canvasText: string;
  highlight: string;
  buttonText: string;
}

/** A visible chrome part: an island by its `data-chrome`, or the open dropdown as `dropdown`. */
export interface BorderedPartFacts {
  name: string;
  description: string;
  border: BorderFacts;
}

/** A visible palette entry under forced colours. */
export interface ForcedEntryFacts {
  action: string;
  group: string | null;
  pressed: boolean;
  disabled: boolean;
  boxShadow: string;
  /** The entry's `<svg>`, else its `::before` when that has content; `null` for an image or a text entry. */
  icon: { kind: "svg" | "::before"; color: string } | null;
}

export interface ForcedColorsFacts {
  system: SystemColorFacts;
  parts: BorderedPartFacts[];
  entries: ForcedEntryFacts[];
  /** The status box's bar (its `::before`); `null` without a visible status box. */
  statusBar: { width: number; color: string } | null;
}

/** What forced colours leave of the chrome: borders, the palette's entries and icons, the status bar. */
export const forcedColorsProbe = ({ root }: { root: string }): ForcedColorsFacts | null => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const rootElement = document.querySelector<HTMLElement>(root);
  if (!rootElement) return null;
  const resolve = (color: string): string => {
    const probe = document.createElement("span");
    probe.setAttribute("data-modeler-shell-conformance", "color-probe");
    probe.style.cssText = `position:absolute;visibility:hidden;color:${color};`;
    rootElement.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };
  const border = (element: Element): BorderFacts => {
    const style = getComputedStyle(element);
    const side = (name: "Top" | "Right" | "Bottom" | "Left"): BorderSideFacts => ({
      width: parseFloat(style.getPropertyValue(`border-${name.toLowerCase()}-width`)) || 0,
      style: style.getPropertyValue(`border-${name.toLowerCase()}-style`),
      color: style.getPropertyValue(`border-${name.toLowerCase()}-color`),
    });
    return { top: side("Top"), right: side("Right"), bottom: side("Bottom"), left: side("Left") };
  };
  const parts: BorderedPartFacts[] = [...rootElement.querySelectorAll("[data-chrome]")]
    .filter((element) => tools.visible(element))
    .map((element) => ({
      name: element.getAttribute("data-chrome") ?? "",
      description: tools.describe(element),
      border: border(element),
    }));
  const dropdown = [...rootElement.querySelectorAll('[role="menu"]')].find((element) =>
    tools.visible(element),
  );
  if (dropdown)
    parts.push({
      name: "dropdown",
      description: tools.describe(dropdown),
      border: border(dropdown),
    });
  const iconOf = (entry: Element): ForcedEntryFacts["icon"] => {
    const svg = entry.querySelector("svg");
    if (svg) return { kind: "svg", color: getComputedStyle(svg).color };
    const before = getComputedStyle(entry, "::before");
    if (before.content && before.content !== "none" && before.content !== "normal")
      return { kind: "::before", color: before.color };
    return null;
  };
  const palette = rootElement.querySelector('[data-chrome="palette"]');
  const entries = palette
    ? [...palette.querySelectorAll("[data-action]")]
        .filter((entry) => tools.visible(entry))
        .map((entry) => ({
          action: entry.getAttribute("data-action") ?? "",
          group: entry.closest("[data-group]")?.getAttribute("data-group") ?? null,
          pressed: entry.getAttribute("aria-pressed") === "true",
          disabled: entry.getAttribute("aria-disabled") === "true",
          boxShadow: getComputedStyle(entry).boxShadow,
          icon: iconOf(entry),
        }))
    : [];
  const status = rootElement.querySelector('[data-chrome="status"]');
  const bar = status && tools.visible(status) ? getComputedStyle(status, "::before") : null;
  return {
    system: {
      canvas: resolve("Canvas"),
      canvasText: resolve("CanvasText"),
      highlight: resolve("Highlight"),
      buttonText: resolve("ButtonText"),
    },
    parts,
    entries,
    statusBar: bar ? { width: parseFloat(bar.width) || 0, color: bar.backgroundColor } : null,
  };
};

/** The focused element and its outline (the focus ring of guide §8). */
export interface FocusRingFacts {
  focused: string;
  /** The focused element lies inside the shell root. */
  inRoot: boolean;
  outline: BorderSideFacts;
}

export const focusRingProbe = ({ root }: { root: string }): FocusRingFacts => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const active = document.activeElement;
  if (!active || active === document.body) {
    return { focused: "<body>", inRoot: false, outline: { width: 0, style: "none", color: "" } };
  }
  const style = getComputedStyle(active);
  return {
    focused: tools.describe(active),
    inRoot: document.querySelector(root)?.contains(active) ?? false,
    outline: {
      width: parseFloat(style.outlineWidth) || 0,
      style: style.outlineStyle,
      color: style.outlineColor,
    },
  };
};

/**
 * The panel of every visible dialog: an open `<dialog>`, `role="dialog"` or `role="alertdialog"`,
 * in the root or, where the modeler owns the document, anywhere in it. The panel is the dialog
 * itself, or the first element down its first children that draws a border (a `<dialog>` that only
 * frames its panel).
 */
export const dialogPanelsProbe = ({
  root,
  wholeDocument,
}: {
  root: string;
  wholeDocument: boolean;
}): BorderedPartFacts[] => {
  const tools = (window as ToolWindow).__modelerShellConformance!;
  const scope = wholeDocument ? document : document.querySelector(root);
  if (!scope) return [];
  const bordered = (element: Element): boolean => {
    const style = getComputedStyle(element);
    return ["top", "right", "bottom", "left"].some(
      (side) =>
        (parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0) > 0 &&
        !["none", "hidden"].includes(style.getPropertyValue(`border-${side}-style`)),
    );
  };
  const dialogs = new Set(
    [...scope.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].filter(
      (element) => tools.visible(element) && !element.closest("[data-modeler-shell-conformance]"),
    ),
  );
  return [...dialogs].map((dialog) => {
    let panel: Element = dialog;
    for (let candidate: Element | null = dialog, depth = 0; candidate && depth < 3; depth++) {
      if (bordered(candidate)) {
        panel = candidate;
        break;
      }
      candidate = candidate.firstElementChild;
    }
    const style = getComputedStyle(panel);
    const side = (name: string): BorderSideFacts => ({
      width: parseFloat(style.getPropertyValue(`border-${name}-width`)) || 0,
      style: style.getPropertyValue(`border-${name}-style`),
      color: style.getPropertyValue(`border-${name}-color`),
    });
    return {
      name: "dialog",
      description: tools.describe(panel),
      border: {
        top: side("top"),
        right: side("right"),
        bottom: side("bottom"),
        left: side("left"),
      },
    };
  });
};
