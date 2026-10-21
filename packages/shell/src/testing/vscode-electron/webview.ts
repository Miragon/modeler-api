/*
 * Everything here that is handed to `evaluate` runs in a VS Code document (the webview or the
 * workbench): Playwright serializes the function source, so these functions must not reference
 * anything outside their own body. Probes for the webview take the `<html>` locator's element first,
 * because they run through `locator.evaluate`.
 */

/** What the driver compares before the edit and after the undo. */
export interface CanvasFacts {
  shapes: number;
  connections: number;
  /** Every shape's translation, rounded to whole pixels and sorted. */
  positions: string[];
}

export interface WebviewThemeFacts {
  theme: string | null;
  kontrast: string | null;
  /** VS Code's theme classes on `<body>`, sorted. */
  bodyClasses: string[];
  /** The shell's one-frame transition stop of a mode switch is still on `<html>`. */
  switching: boolean;
}

export const canvasFactsProbe = (): CanvasFacts => {
  const shapes = [...document.querySelectorAll<SVGGraphicsElement>(".djs-element.djs-shape")];
  const positions = shapes
    .map((shape) => {
      const matrix = shape.transform.baseVal.consolidate()?.matrix;
      return matrix ? `${Math.round(matrix.e)},${Math.round(matrix.f)}` : "0,0";
    })
    .sort();
  return {
    shapes: shapes.length,
    connections: document.querySelectorAll(".djs-element.djs-connection").length,
    positions,
  };
};

export const chromeProbe = (_html: Element, islands: readonly string[]): Record<string, boolean> => {
  const presence: Record<string, boolean> = {};
  for (const island of islands) {
    const element = document.querySelector(`[data-chrome="${island}"]`);
    const rect = element?.getBoundingClientRect();
    presence[island] =
      element !== null &&
      rect !== undefined &&
      rect.width > 0 &&
      rect.height > 0 &&
      (typeof element.checkVisibility !== "function" ||
        element.checkVisibility({ visibilityProperty: true }));
  }
  return presence;
};

export const webviewThemeProbe = (_html: Element, themeClasses: readonly string[]): WebviewThemeFacts => {
  const html = document.documentElement;
  return {
    theme: html.getAttribute("data-cd-theme"),
    kontrast: html.getAttribute("data-cd-kontrast"),
    bodyClasses: [...document.body.classList].filter((name) => themeClasses.includes(name)).sort(),
    switching: html.classList.contains("cd-shell-no-transition"),
  };
};

export const workbenchThemeProbe = (themeClass: string): boolean =>
  document.querySelector(".monaco-workbench")?.classList.contains(themeClass) ?? false;

export const workbenchWebviewsProbe = (): string[] =>
  [...document.querySelectorAll("iframe.webview")].map((frame) => frame.getAttribute("src") ?? "");

/** The active editor is VS Code's text editor (a custom editor shows a webview instead). */
export const activeTextEditorProbe = (): boolean =>
  document.querySelector(".editor-group-container.active .editor-instance .monaco-editor") !== null;

export const activeEditorDirtyProbe = (): boolean =>
  document.querySelector(".tabs-container .tab.active.dirty") !== null;

/** Two frames, then the running finite animations (at most one second); frames time out when throttled. */
export const settleProbe = async (): Promise<void> => {
  const frame = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 100);
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  await frame();
  await frame();
  const running = document.getAnimations().filter((animation) => {
    const end = animation.effect?.getComputedTiming().endTime;
    return animation.playState === "running" && typeof end === "number" && Number.isFinite(end);
  });
  if (running.length > 0) {
    await Promise.race([
      Promise.all(running.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  }
  await frame();
};

/**
 * Focuses the first enabled palette entry that creates something (outside the tools group, not a
 * `-tool`); returns its `data-action`, undefined when there is none.
 */
export const focusCreatingEntryProbe = (): string | undefined => {
  const entries = [
    ...document.querySelectorAll<HTMLElement>('.djs-palette[data-chrome="palette"] .entry[data-action]'),
  ];
  const creating = entries.find((entry) => {
    const action = entry.getAttribute("data-action") ?? "";
    const group = entry.closest(".group")?.getAttribute("data-group");
    return group !== "tools" && !action.endsWith("-tool") && entry.getAttribute("aria-disabled") !== "true";
  });
  if (!creating) return undefined;
  creating.focus();
  return creating.getAttribute("data-action") ?? undefined;
};

export const blurProbe = (): void => {
  const active = document.activeElement;
  if (active instanceof HTMLElement || active instanceof SVGElement) active.blur();
};
