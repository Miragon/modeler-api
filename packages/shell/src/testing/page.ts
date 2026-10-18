/**
 * The part of Playwright's `Page` the kit drives, typed structurally: the kit has no runtime
 * dependency on Playwright, the consumer's e2e suite passes its own `page`.
 */
export interface PageLike {
  evaluate<R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  mouse: { click(x: number, y: number): Promise<void>; move(x: number, y: number): Promise<void> };
  waitForTimeout(timeout: number): Promise<void>;
}
