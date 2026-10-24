/**
 * The part of Playwright's `Page` the kit drives, typed structurally: the kit has no runtime
 * dependency on Playwright, the consumer's e2e suite passes its own `page`.
 */
export interface PageLike {
  evaluate<R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  mouse: {
    click(x: number, y: number): Promise<void>;
    dblclick(x: number, y: number): Promise<void>;
    move(x: number, y: number): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
  };
  waitForTimeout(timeout: number): Promise<void>;
  /**
   * Playwright's `page.emulateMedia`; the web-host cases need it for the system's mode and contrast
   * (`appearance`), `reducedMotion` and `forcedColors` in every host for their media features, and
   * each reports a skip with `hook: "open"` without it.
   */
  emulateMedia?(options: {
    colorScheme?: "light" | "dark" | "no-preference" | null;
    contrast?: "more" | "no-preference" | null;
    reducedMotion?: "reduce" | "no-preference" | null;
    forcedColors?: "active" | "none" | null;
  }): Promise<void>;
}
