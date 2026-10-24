let context: CanvasRenderingContext2D | null | undefined;

/** One detached 2D canvas context for measuring text and reading colours; null outside a browser. */
export function canvasContext(): CanvasRenderingContext2D | null {
  // jsdom has no canvas and logs an error for every getContext call: ask only a real browser.
  context ??=
    typeof document !== "undefined" && typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  return context;
}
