import type { Appearance, ColorThemeSetting, ShellHost, Size, Theme } from "../core/index.js";
import { createCases } from "./cases.js";
import type { PageLike } from "./page.js";

export interface OpenContext {
  /** The page's viewport, which is the modeler's container in an own document. */
  size: Size;
  /**
   * What the host requests before the modeler resolves it: in an IDE host the VS Code color theme
   * (`vsCodeStubSearch` hands it to a page with the VS Code stub). For an embedded host the kit
   * itself puts the foreign page's `<html>` in this mode once `open` resolved.
   */
  requested: Appearance;
}

/** How the kit makes the optional islands visible for the geometry case. */
export interface ShowHooks<P extends PageLike = PageLike> {
  problems?: ((page: P) => Promise<void>) | undefined;
  status?: ((page: P) => Promise<void>) | undefined;
  legend?: ((page: P) => Promise<void>) | undefined;
  inspector?: ((page: P) => Promise<void>) | undefined;
}

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
  /** Hooks for the islands the modeler has; an island without a hook is reported as skipped. */
  show?: ShowHooks<P> | undefined;
  /** Container sizes of the geometry case; default wide 1280 × 900, narrow 720 × 700, very narrow 420 × 700. */
  sizes?: readonly Size[] | undefined;
}

export interface ShellCaseOutcome {
  /** The case could not (fully) run; the reason names the missing harness field. */
  skipped?: string;
}

export interface ShellConformanceCase {
  name: string;
  run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>): Promise<ShellCaseOutcome | void>;
}

/**
 * The cases: `geometry` (every `data-chrome` island ±1px, per host and breakpoint), `aria`
 * (roles, names, `aria-expanded`/`-controls`/`-keyshortcuts`/`-disabled`, DOM order, no positive
 * tabindex), `keys` (each chrome key acts exactly once; in the IDE host a `keydown` listener on
 * `window` never fires for a handled key; unmodified `+`/`-` never zoom), `appearance` (dark
 * requested from a light-only modeler: nothing turns dark, `color-scheme` light everywhere) and
 * `cleanup` (after `destroy` no shell element, class, attribute or key handling remains).
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
  /** Default: `console.warn`. */
  onSkip?: ((caseName: string, reason: string) => void) | undefined;
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
    ((caseName: string, reason: string) => {
      console.warn(
        `@miragon/modeler-shell conformance: SKIPPED "${caseName}" (${harness.host} host): ${reason}`,
      );
    });
  for (const conformanceCase of shellConformanceCases()) {
    test(`shell conformance: ${conformanceCase.name}`, async ({ page }) => {
      const outcome = await conformanceCase.run(page, harness);
      if (outcome?.skipped) onSkip(conformanceCase.name, outcome.skipped);
    });
  }
}
