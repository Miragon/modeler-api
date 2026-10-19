import type { ShellConformanceCase } from "./harness.js";

/**
 * The web column's cases (0.2), in this order after the 0.1 cases of `createCases`:
 *
 * - `webChrome`: primary action (top 12 / right 12, 40 high, layer 30, label collapse before the
 *   palette moves, tooltip only while collapsed, tab order after the menu trigger), legal line
 *   (left 12 / bottom 12, 20 high, links, Impressum and Datenschutz `lang="de"`), the menu's File
 *   group first and the Appearance group (dark-capable only) between Export and Help, the raised
 *   zoom row; in IDE and embedded hosts none of them shows.
 * - `emptyState`: after `show.emptyState`, the card centred (`centerX`, `centerY`), 400 /
 *   `100cqw − 24px` wide, the work chrome hidden, the canvas `inert`, the chrome keys prevented
 *   and inert, Tab reaching only the card's buttons and the legal links; "New diagram" hides it
 *   and shows the chrome with the focus on the canvas.
 * - `toasts`: through `show.toast`, bottom centre at `toastStackBottom`, at most three (a fourth
 *   evicts per `toastToEvict`), the newest at the bottom, `role="status"` / `role="alert"`, Close
 *   named `messages.close`, auto-dismiss after `toastLifetime` (paused while hovered or focused),
 *   never with an action, above a `showModal()` stand-in in the web host; nothing in the IDE host.
 * - `problemsList`: web (embedded when the pill opens it): the pill's `aria-haspopup="dialog"`,
 *   `aria-expanded`, `aria-controls`; the popover's role, title, geometry (left 12, 8px above the
 *   pill, `min(320px, 100cqw − 24px)` wide, at most 320 high), Escape returning the focus to the
 *   pill, an outside click closing without moving it, rows at least 36px with the pill's icons.
 * - `dropZone`: with `harness.drop`, synthetic file drags (`DataTransfer` built in the page):
 *   drag-over styles (`--cd-ui-hover`, 2px dashed `--cd-ui-interaktion`, 12px inset, chip on
 *   `--cd-ui-flaeche-hoch`), forbidden for two files and under a modal stand-in (`--cd-ui-danger`
 *   border, `dropEffect` `none`), the accepted file opening (start screen gone), the rejected one
 *   opening nothing and showing a danger toast; non-file drags (a palette drag) untouched.
 *
 * `geometry` and `aria` of `createCases` learn the new islands as well (`chromeExpectations`:
 * `primary`, `legal`, `toasts`, `empty-state`, `drop-zone`, `problems-popover`; the web bottom
 * row with `open.zoomRaised`), and `appearance` the web host's mode (`emulateMedia`, the stored
 * choice, the Appearance group).
 */
export function createWebCases(): ShellConformanceCase[] {
  // TODO(kit-demo): the five cases above; register them in createCases once they run green.
  return [];
}
