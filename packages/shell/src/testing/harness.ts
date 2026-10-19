import type { Appearance, ColorThemeSetting, ShellHost, Size, Theme, ToastStatus } from "../core/index.js";
import { createCases } from "./cases.js";
import type { PageLike } from "./page.js";

export interface OpenContext {
  /** The page's viewport, which is the modeler's container in an own document. */
  size: Size;
  /**
   * What the host requests before the modeler resolves it: in an IDE host the VS Code color theme
   * (`vsCodeStubSearch` hands it to a page with the VS Code stub). For an embedded host the kit
   * itself puts the foreign page's `<html>` in this mode once `open` resolved. In the web host the
   * system's preference without a stored choice: the kit emulates `prefers-color-scheme` and
   * `prefers-contrast` (`PageLike.emulateMedia`) before `open`, and `open` loads the page with an
   * empty `localStorage` entry `miragon.darstellung`.
   */
  requested: Appearance;
}

/**
 * How the kit makes the optional islands visible (`geometry`, `aria`) and puts the modeler into its
 * invalid-file state (`readOnly`).
 */
export interface ShowHooks<P extends PageLike = PageLike> {
  problems?: ((page: P) => Promise<void>) | undefined;
  status?: ((page: P) => Promise<void>) | undefined;
  legend?: ((page: P) => Promise<void>) | undefined;
  inspector?: ((page: P) => Promise<void>) | undefined;
  /**
   * Puts the modeler into its invalid-file state the way its host does (an invalid import): a
   * read-only canvas and the status box. The kit waits `INVALID_STATUS_DELAY_MS` afterwards.
   */
  invalid?: ((page: P) => Promise<void>) | undefined;
  /**
   * Web host: puts the page on its start screen, the way a fresh visit without a document shows
   * it (`shell.setEmptyState(true)`); `open` itself loads a document.
   */
  emptyState?: ((page: P) => Promise<void>) | undefined;
  /**
   * Web and embedded hosts: shows `toast` through the modeler's `shell.toast`, with
   * `{ label: toast.actionLabel, onSelect() {} }` as its action when `actionLabel` is given.
   */
  toast?: ((page: P, toast: ToastFixture) => Promise<void>) | undefined;
}

/** A toast the kit asks the `toast` hook to show (cases `toasts`, `geometry`). */
export interface ToastFixture {
  status: ToastStatus;
  text: string;
  actionLabel?: string | undefined;
}

/** A file the kit drops on the page (case `dropZone`), built in the page as `new File([text], name, { type })`. */
export interface DropFixture {
  name: string;
  type: string;
  text: string;
}

export interface DropFixtures {
  /** A file `DropZoneOptions.accept` takes; dropping it on the start screen opens it (the card goes). */
  accepted: DropFixture;
  /** A file outside `accept`; dropping it opens nothing and shows a danger toast (or the modeler's `onReject`). */
  rejected?: DropFixture | undefined;
}

/**
 * A show hook by name: the islands `legend`, `inspector`, `problems`, `status`, the state
 * `invalid`, and in the web column `emptyState` and `toast`.
 */
export type ShowHook = keyof ShowHooks;

/** What a harness can lack: a show hook, or the web app's drop zone (`drop`). */
export type AbsentFeature = ShowHook | "drop";

export interface ShellConformanceHarness<P extends PageLike = PageLike> {
  host: ShellHost;
  /** The modes the modeler declares (static); the appearance case requests dark from `["light"]`. */
  themes: readonly Theme[];
  /** Load the modeler with the shell at `size`, as the host would with `requested`; resolve once the first import is done. */
  open(page: P, context: OpenContext): Promise<void>;
  /** Tear modeler and shell down through the page's own path; `undefined` skips the cleanup case. */
  destroy?: ((page: P) => Promise<void>) | undefined;
  /** CSS selector of the shell root; default `.cd-shell`. */
  root?: string | undefined;
  /** Hooks for the islands and states the modeler has; one that is neither given nor `absent` is reported as skipped. */
  show?: ShowHooks<P> | undefined;
  /** Web host: the files the `dropZone` case drops; without them (and not `absent`) it is skipped with `hook: "drop"`. */
  drop?: DropFixtures | undefined;
  /**
   * The islands and states the modeler does not have. An absent hook is not reported as skipped,
   * and `geometry` and `aria` assert that its island is never visible. Listing a hook that `show`
   * also gives fails every case that uses it.
   */
  absent?: readonly AbsentFeature[] | undefined;
  /** Container sizes of the geometry case; default wide 1280 × 900, narrow 720 × 700, very narrow 420 × 700. */
  sizes?: readonly Size[] | undefined;
}

/** One part of a case the harness could not feed. */
export interface ShellSkip {
  /**
   * The harness field that would feed it: a show hook, `destroy`, or `open` when the document it
   * opens lacks what the case needs (a shape on the canvas).
   */
  hook: ShowHook | "drop" | "destroy" | "open";
  reason: string;
}

export interface ShellCaseOutcome {
  /** What the case could not (fully) run, one entry per missing harness field. */
  skipped?: readonly ShellSkip[];
}

export interface ShellConformanceCase {
  name: string;
  run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>): Promise<ShellCaseOutcome | void>;
}

/**
 * The cases: `geometry` (every `data-chrome` island ±1px, per host and breakpoint), `aria`
 * (roles, names, `aria-expanded`/`-controls`/`-keyshortcuts`/`-disabled`, DOM order, no positive
 * tabindex), `keys` (each chrome key acts exactly once; in the IDE host a `keydown` listener on
 * `window` never fires for a handled key; unmodified `+`/`-` never zoom; select all acts on the
 * canvas only), `create` (Enter on the first creating palette entry places one selected element in
 * the free rectangle and focuses the canvas), `readOnly` (the invalid-file lock of guide §13.5),
 * `appearance` (dark requested from a light-only modeler: nothing turns dark, `color-scheme` light
 * everywhere, the canvas surround and the palette's tool colours from the roles) and `cleanup` (after
 * `destroy` no shell element, class, attribute or key handling remains).
 */
export function shellConformanceCases(): ShellConformanceCase[] {
  return createCases();
}

/** Playwright's `test` (or any runner whose body receives `{ page }`). */
export type ShellConformanceTest<P extends PageLike = PageLike> = (
  name: string,
  body: (fixtures: { page: P }) => Promise<void>,
) => unknown;

export interface RegisterShellConformanceOptions {
  /** Default: `console.warn`, one line per case with its skips joined by "; ". */
  onSkip?: ((caseName: string, skips: readonly ShellSkip[]) => void) | undefined;
}

/**
 * The query string for a test page that installs the VS Code stub of
 * `@miragon/modeler-shell/testing/vscode-stub` with `stubOptionsFromSearch(location.search)`:
 * `theme=dark&kontrast=hoch`, plus the `colorTheme` setting and VS Code's reduce motion.
 */
export function vsCodeStubSearch(
  requested: Appearance,
  extra: { colorTheme?: ColorThemeSetting | undefined; reduceMotion?: boolean | undefined } = {},
): string {
  const query = new URLSearchParams({ theme: requested.theme });
  if (requested.kontrast) query.set("kontrast", requested.kontrast);
  if (extra.colorTheme) query.set("colorTheme", extra.colorTheme);
  if (extra.reduceMotion) query.set("reduceMotion", "");
  return query.toString();
}

/** Registers every case as `shell conformance: <name>`. */
export function registerShellConformance<P extends PageLike>(
  harness: ShellConformanceHarness<P>,
  test: ShellConformanceTest<P>,
  options: RegisterShellConformanceOptions = {},
): void {
  const onSkip =
    options.onSkip ??
    ((caseName: string, skips: readonly ShellSkip[]) => {
      console.warn(
        `@miragon/modeler-shell conformance: SKIPPED "${caseName}" (${harness.host} host): ${skips.map((skip) => skip.reason).join("; ")}`,
      );
    });
  for (const conformanceCase of shellConformanceCases()) {
    test(`shell conformance: ${conformanceCase.name}`, async ({ page }) => {
      const outcome = await conformanceCase.run(page, harness);
      if (outcome?.skipped && outcome.skipped.length > 0) onSkip(conformanceCase.name, outcome.skipped);
    });
  }
}
