import {
  INVALID_STATUS_DELAY_MS,
  TOOLTIP_DELAY_MS,
  type Appearance,
  type ShellHost,
  type Size,
} from "../core/index.js";
import {
  afterDestroyKeyProblem,
  appearanceProblems,
  ariaProblems,
  keyReachProblem,
  leftoverProblems,
  menuClosedProblems,
  menuKeysAtDocumentProblems,
  menuOpenProblems,
  optionalIslandProblems,
  paletteShortcutProblems,
  tabSequenceProblems,
  type KeyReach,
  type PaletteShortcutFacts,
  type TabStop,
} from "./checks.js";
import {
  MODE_ROLES,
  activeStopProbe,
  appearanceProbe,
  ariaProbe,
  menuProbe,
  paletteFocusProbe,
  paletteShortcutProbe,
  zoomButtonsProbe,
  type AppearanceFacts,
  type MenuFacts,
} from "./facts.js";
import {
  DEFAULT_ROOT,
  dropdownProblems,
  geometryProblems,
  measureChrome,
  tooltipProblems,
  type ChromeMeasurement,
  type TooltipRow,
} from "./geometry.js";
import type {
  ShellCaseOutcome,
  ShellConformanceCase,
  ShellConformanceHarness,
  ShowHooks,
} from "./harness.js";
import type { PageLike } from "./page.js";
import {
  afterPressProbe,
  armCleanupProbe,
  canvasHandlesProbe,
  clearKeysProbe,
  findOverlay,
  findTarget,
  focusTarget,
  hostPageModeProbe,
  inPage,
  injectProbe,
  leftoverProbe,
  removeInjectedProbe,
  settle,
  type ChromeTarget,
  type InjectedKind,
  type TargetFacts,
} from "./page-tools.js";

/** Wide, narrow and very narrow (guide §5.15); 900 is above, 700 below the low breakpoint. */
export const DEFAULT_SIZES: readonly Size[] = [
  { width: 1280, height: 900 },
  { width: 720, height: 700 },
  { width: 420, height: 700 },
];

const LIGHT: Appearance = { theme: "light" };

/** Shown in this order, so the legend is measured without and then with the pill. */
const SHOWN_ISLANDS = ["legend", "problems", "status", "inspector"] as const satisfies ReadonlyArray<
  keyof ShowHooks
>;

/** Requested from the modeler by the appearance case (VS Code Dark, High Contrast, High Contrast Light). */
const REQUESTED_APPEARANCES: readonly Appearance[] = [
  { theme: "dark" },
  { theme: "dark", kontrast: "hoch" },
  { theme: "light", kontrast: "hoch" },
];

/** Room for the chrome tooltip's own fade after its 300ms hover delay. */
const HOVER_MARGIN_MS = 200;

/** A spot without chrome: the root's top-left corner lies outside every island (12px edge). */
const PARK = { x: 1, y: 1 } as const;

/** Every kind of text field a modeler renders: inspector and dialog fields, the label editor. */
const TEXT_FIELDS: ReadonlyArray<readonly [InjectedKind, string]> = [
  ["input", "a text field"],
  ["textarea", "a textarea"],
  ["contenteditable", "an editable label"],
];

const UNDO_REDO_PRESSES = [
  "Control+KeyZ",
  "Meta+KeyZ",
  "Control+Shift+KeyZ",
  "Meta+Shift+KeyZ",
  "Control+KeyY",
] as const;

const ONE_STEP_UP = 135;
const TWO_STEPS_UP = 182;
const ZOOM_LIMIT_MAX = 400;
const ZOOM_LIMIT_MIN = 20;

function sizeLabel(size: Size): string {
  return `${size.width} × ${size.height}`;
}

function appearanceLabel(appearance: Appearance): string {
  return appearance.kontrast ? `${appearance.theme} + ${appearance.kontrast}` : appearance.theme;
}

function fail(caseName: string, host: ShellHost, problems: readonly string[]): never {
  const unique = [...new Set(problems)];
  throw new Error(
    `@miragon/modeler-shell conformance: ${caseName} (${host} host)\n${unique.map((problem) => `- ${problem}`).join("\n")}`,
  );
}

function finish(
  caseName: string,
  host: ShellHost,
  problems: readonly string[],
  skipped: Iterable<string>,
): ShellCaseOutcome | void {
  if (problems.length > 0) fail(caseName, host, problems);
  const reasons = [...new Set(skipped)];
  return reasons.length > 0 ? { skipped: reasons.join("; ") } : undefined;
}

function missingHooks<P extends PageLike>(harness: ShellConformanceHarness<P>, what: string): string[] {
  return SHOWN_ISLANDS.filter((island) => !harness.show?.[island]).map(
    (island) => `show.${island} is undefined: ${what} of the ${island} island not verified`,
  );
}

/** Hovers `target` long enough for its chrome tooltip; the hovered control, `null` when there is none. */
async function hover(page: PageLike, root: string, target: ChromeTarget): Promise<TargetFacts | null> {
  const anchor = await findTarget(page, root, target);
  if (!anchor) return null;
  await page.mouse.move(PARK.x, PARK.y);
  await page.mouse.move(anchor.client.x, anchor.client.y);
  await page.waitForTimeout(TOOLTIP_DELAY_MS + HOVER_MARGIN_MS);
  await settle(page);
  return anchor;
}

async function openMenuByClick(page: PageLike, root: string): Promise<boolean> {
  const trigger = await findTarget(page, root, "menu");
  if (!trigger) return false;
  await page.mouse.click(trigger.client.x, trigger.client.y);
  await settle(page);
  return true;
}

async function closeByEscape(page: PageLike): Promise<void> {
  await page.keyboard.press("Escape");
  await settle(page);
}

/** Dropdown and tooltips of one measured state (guide §5.4, §5.6). */
async function popupGeometry(
  page: PageLike,
  root: string,
  measurement: ChromeMeasurement,
): Promise<string[]> {
  const problems: string[] = [];
  if (!(await openMenuByClick(page, root))) return ["dropdown: no visible menu trigger to open it"];
  const dropdown = await findOverlay(page, root, "menu");
  if (!dropdown) problems.push('dropdown: no visible role="menu" after clicking the trigger');
  else problems.push(...dropdownProblems(dropdown.box, measurement.container));
  await closeByEscape(page);

  const rows: Array<[ChromeTarget, TooltipRow]> = [
    ["menu", "top"],
    ["palette-entry", measurement.paletteRow === "second-row" ? "second-row" : "top"],
    ["zoom-in", "bottom"],
  ];
  for (const [target, row] of rows) {
    const anchor = await hover(page, root, target);
    if (!anchor) {
      problems.push(`tooltip: no visible ${target} to hover`);
      continue;
    }
    const tooltip = await findOverlay(page, root, "tooltip");
    if (!tooltip) {
      problems.push(`tooltip: none visible ${TOOLTIP_DELAY_MS + HOVER_MARGIN_MS}ms after hovering ${target}`);
      continue;
    }
    if (tooltip.count > 1) problems.push(`tooltip: ${tooltip.count} tooltips visible at once`);
    if (anchor.label && !tooltip.text.startsWith(anchor.label)) {
      problems.push(`tooltip: hovering ${target} ("${anchor.label}") shows "${tooltip.text}"`);
    }
    problems.push(
      ...tooltipProblems(tooltip.box, anchor.box, row, measurement.container).map(
        (problem) => `${problem} (on ${target})`,
      ),
    );
  }
  await page.mouse.move(PARK.x, PARK.y);
  return problems;
}

const geometryCase: ShellConformanceCase = {
  name: "geometry",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    const root = harness.root ?? DEFAULT_ROOT;
    const problems: string[] = [];
    for (const size of harness.sizes ?? DEFAULT_SIZES) {
      const at = sizeLabel(size);
      await harness.open(page, { size, requested: LIGHT });
      await settle(page);
      const check = async (state: string): Promise<ChromeMeasurement> => {
        const measurement = await measureChrome(page, root);
        problems.push(
          ...geometryProblems(measurement, harness.host).map((problem) => `[${at}, ${state}] ${problem}`),
        );
        return measurement;
      };
      const opened = await check("as opened");
      problems.push(...(await popupGeometry(page, root, opened)).map((problem) => `[${at}] ${problem}`));
      for (const island of SHOWN_ISLANDS) {
        const show = harness.show?.[island];
        if (!show) continue;
        await show(page);
        await settle(page);
        await check(`after show.${island}`);
      }
    }
    return finish("geometry", harness.host, problems, missingHooks(harness, "the geometry"));
  },
};

async function menuState(page: PageLike, root: string): Promise<MenuFacts> {
  const facts = await inPage(page, menuProbe, { root });
  if (!facts) throw new Error(`@miragon/modeler-shell conformance: no element matches "${root}"`);
  return facts;
}

/** Keyboard model of the menu (guide §5.4): Enter/↓ open on the first entry, ↑ on the last, wrap, Escape. */
async function menuKeyboardProblems(page: PageLike, root: string): Promise<string[]> {
  const problems: string[] = [];
  const openWith = async (key: string, focus: "first" | "last"): Promise<MenuFacts | undefined> => {
    if (!(await focusTarget(page, root, "menu"))) {
      problems.push("menu: the trigger cannot take focus");
      return undefined;
    }
    await page.keyboard.press(key);
    await settle(page);
    const opened = await menuState(page, root);
    problems.push(...menuOpenProblems(opened, focus).map((problem) => `${key} on the trigger: ${problem}`));
    return opened;
  };
  const close = async (key: string) => {
    await closeByEscape(page);
    problems.push(
      ...menuClosedProblems(await menuState(page, root), true).map(
        (problem) => `${key}, then Escape: ${problem}`,
      ),
    );
  };

  const opened = await openWith("Enter", "first");
  if (opened && opened.items.length > 1) {
    const moves: Array<[string, (count: number) => number]> = [
      ["ArrowUp", (count) => count - 1],
      ["ArrowDown", () => 0],
      ["End", (count) => count - 1],
      ["Home", () => 0],
    ];
    await inPage(page, clearKeysProbe, null);
    for (const [key, target] of moves) {
      await page.keyboard.press(key);
      const moved = await menuState(page, root);
      const expected = target(moved.items.length);
      if (moved.active !== expected) {
        problems.push(
          `menu: ${key} moves the focus to entry ${moved.active + 1}, expected entry ${expected + 1} of ${moved.items.length}`,
        );
      }
    }
    const { documentKeys } = await inPage(page, afterPressProbe, { root });
    problems.push(
      ...menuKeysAtDocumentProblems(
        moves.map(([key]) => key),
        documentKeys,
      ),
    );
  }
  if (opened) await close("Enter");
  if (await openWith("ArrowDown", "first")) await close("ArrowDown");
  if (await openWith("ArrowUp", "last")) await close("ArrowUp");
  return problems;
}

/** Roving tabindex of the palette toolbar (guide §5.5): ← → Home End. */
async function paletteKeyboardProblems(page: PageLike, root: string): Promise<string[]> {
  const before = await inPage(page, paletteFocusProbe, { root });
  if (!before || before.entries.length < 2) return [];
  if (!(await focusTarget(page, root, "palette-tab-stop"))) {
    return ['palette: no entry with tabindex="0" takes the focus'];
  }
  const problems: string[] = [];
  const start = before.entries.indexOf(before.tabStops[0] ?? "");
  const step = start < before.entries.length - 1 ? 1 : -1;
  const moves: Array<[string, number]> = [
    [step === 1 ? "ArrowRight" : "ArrowLeft", start + step],
    ["End", before.entries.length - 1],
    ["Home", 0],
  ];
  for (const [key, index] of moves) {
    await page.keyboard.press(key);
    const after = await inPage(page, paletteFocusProbe, { root });
    const expected = before.entries[index];
    if (!after || after.active !== expected) {
      problems.push(`palette: ${key} focuses "${after?.active ?? "nothing"}", expected "${expected}"`);
    } else if (after.tabStops.length !== 1 || after.tabStops[0] !== expected) {
      problems.push(
        `palette: after ${key} tabindex="0" is on ${after.tabStops.join(", ") || "no entry"}, expected "${expected}"`,
      );
    }
  }
  return problems;
}

/** Every palette entry by keyboard: a shortcut its tooltip shows is named in `aria-keyshortcuts`. */
async function paletteShortcutWalk(page: PageLike, root: string): Promise<string[]> {
  const before = await inPage(page, paletteFocusProbe, { root });
  if (!before || before.entries.length === 0) return [];
  if (!(await focusTarget(page, root, "palette-tab-stop"))) return [];
  if (before.entries.length > 1) await page.keyboard.press("End");
  await page.keyboard.press("Home");
  const seen: PaletteShortcutFacts[] = [];
  for (let index = 0; index < before.entries.length; index++) {
    const facts = await inPage(page, paletteShortcutProbe, { root });
    if (facts) seen.push(facts);
    await page.keyboard.press("ArrowRight");
  }
  return paletteShortcutProblems(seen);
}

/** Tab from the menu trigger: the palette's one stop, then the canvas (guide §5.14). */
async function tabSequenceFromMenu(page: PageLike, root: string): Promise<string[]> {
  if (!(await focusTarget(page, root, "menu"))) return [];
  const stops: TabStop[] = [];
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("Tab");
    const stop = await inPage(page, activeStopProbe, { root });
    stops.push({ description: stop.description, kind: stop.kind as TabStop["kind"] });
  }
  return tabSequenceProblems(stops);
}

/** `aria-disabled` at 400 % and 20 % (guide §5.8), reached by clicking the buttons. */
async function zoomLimitProblems(page: PageLike, root: string): Promise<string[]> {
  const problems: string[] = [];
  const limits: Array<["in" | "out", ChromeTarget, number, number, "in" | "out"]> = [
    ["in", "zoom-in", ZOOM_LIMIT_MAX, 12, "out"],
    ["out", "zoom-out", ZOOM_LIMIT_MIN, 16, "in"],
  ];
  for (const [button, target, limit, maxClicks, other] of limits) {
    const control = await findTarget(page, root, target);
    if (!control) continue;
    let buttons = await inPage(page, zoomButtonsProbe, { root });
    for (
      let click = 0;
      click < maxClicks && buttons[button]?.attributes["aria-disabled"] !== "true";
      click++
    ) {
      await page.mouse.click(control.client.x, control.client.y);
      await settle(page);
      buttons = await inPage(page, zoomButtonsProbe, { root });
    }
    const { zoom } = await inPage(page, afterPressProbe, { root });
    const reached = buttons[button];
    if (reached?.attributes["aria-disabled"] !== "true") {
      problems.push(
        `zoom: [data-zoom="${button}"] is not aria-disabled after ${maxClicks} clicks (readout ${zoom ?? "?"}%)`,
      );
    } else {
      if (zoom !== limit) {
        problems.push(`zoom: [data-zoom="${button}"] is disabled at ${zoom ?? "?"}%, expected at ${limit}%`);
      }
      if (reached.disabled) problems.push(`zoom: [data-zoom="${button}"] is natively disabled at the limit`);
    }
    if (buttons[other]?.attributes["aria-disabled"] === "true") {
      problems.push(`zoom: [data-zoom="${other}"] is aria-disabled at ${zoom ?? "?"}%`);
    }
    if (buttons.actual?.attributes["aria-disabled"] === "true") {
      problems.push("zoom: the readout is disabled at a limit");
    }
  }
  await page.mouse.move(PARK.x, PARK.y);
  return problems;
}

const ariaCase: ShellConformanceCase = {
  name: "aria",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    const root = harness.root ?? DEFAULT_ROOT;
    const size = (harness.sizes ?? DEFAULT_SIZES)[0] ?? DEFAULT_SIZES[0]!;
    await harness.open(page, { size, requested: LIGHT });
    await settle(page);
    const facts = await inPage(page, ariaProbe, { root });
    if (!facts) fail("aria", harness.host, [`no element matches the shell root selector "${root}"`]);
    const problems = ariaProblems(facts, harness.host);
    problems.push(...(await menuKeyboardProblems(page, root)));
    problems.push(...(await paletteKeyboardProblems(page, root)));
    problems.push(...(await paletteShortcutWalk(page, root)));
    problems.push(...(await tabSequenceFromMenu(page, root)));
    problems.push(...(await zoomLimitProblems(page, root)));

    const shown = new Set<string>();
    for (const island of SHOWN_ISLANDS) {
      const show = harness.show?.[island];
      if (!show) continue;
      await show(page);
      shown.add(island);
    }
    if (shown.size > 0) {
      await settle(page);
      const withIslands = await inPage(page, ariaProbe, { root });
      if (withIslands) {
        problems.push(...optionalIslandProblems(withIslands, shown));
        const known = new Set(problems);
        problems.push(
          ...ariaProblems(withIslands, harness.host)
            .filter((problem) => !known.has(problem))
            .map((problem) => `with every island shown: ${problem}`),
        );
      }
    }
    return finish("aria", harness.host, problems, missingHooks(harness, "the roles and names"));
  },
};

const keysCase: ShellConformanceCase = {
  name: "keys",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    const root = harness.root ?? DEFAULT_ROOT;
    const host = harness.host;
    const size = (harness.sizes ?? DEFAULT_SIZES)[0] ?? DEFAULT_SIZES[0]!;
    await harness.open(page, { size, requested: LIGHT });
    await settle(page);
    const problems: string[] = [];

    if (!(await focusTarget(page, root, "canvas"))) {
      fail("keys", host, ["canvas: the diagram-js <svg> (.djs-container > svg) cannot take focus"]);
    }
    await inPage(page, clearKeysProbe, null);
    let current = (await inPage(page, afterPressProbe, { root })).zoom;
    if (current === null) fail("keys", host, ['zoom: no readout [data-zoom="actual"] showing a percentage']);

    const press = async (
      key: string,
      reach: KeyReach | undefined,
      zoom: number | "unchanged" | undefined,
      context = "on the canvas",
    ) => {
      const before = current;
      await page.keyboard.press(key);
      let after = await inPage(page, afterPressProbe, { root });
      const where = `${key} ${context}`;
      if (reach) {
        const problem = keyReachProblem(where, reach, host, after);
        if (problem) problems.push(problem);
      }
      if (zoom === undefined) return;
      const expected = zoom === "unchanged" ? before : zoom;
      // a readout that has not moved yet may still be waiting for its frame; a wrong one stays wrong
      for (let poll = 0; after.zoom === before && expected !== before && poll < 10; poll++) {
        await page.waitForTimeout(50);
        after = await inPage(page, afterPressProbe, { root });
      }
      if (after.zoom !== expected) {
        problems.push(
          zoom === "unchanged"
            ? `${where} changed the zoom from ${before}% to ${after.zoom ?? "?"}%; it must not act`
            : `${where} zoomed to ${after.zoom ?? "?"}% from ${before}%, expected ${expected}% (exactly one step)`,
        );
      }
      current = after.zoom ?? current;
    };
    const inside = async (kind: InjectedKind, context: string, steps: () => Promise<void>) => {
      if (await inPage(page, injectProbe, { root, kind })) await steps();
      else problems.push(`cannot focus ${context} stand-in inside the root`);
      await inPage(page, removeInjectedProbe, null);
    };

    await press("Control+Digit0", "handled", 100);
    const pairs: Array<[string, string]> = [
      ["Control+Equal", "Control+Minus"],
      ["Control+Shift+Equal", "Control+Shift+Minus"],
      ["Meta+Equal", "Meta+Minus"],
      ["Meta+Shift+Equal", "Meta+Shift+Minus"],
      ["Control+NumpadAdd", "Control+NumpadSubtract"],
      ["Meta+NumpadAdd", "Meta+NumpadSubtract"],
    ];
    for (const [zoomIn, zoomOut] of pairs) {
      await press(zoomIn, "handled", ONE_STEP_UP);
      await press(zoomOut, "handled", 100);
    }
    for (const zoomToActual of ["Meta+Digit0", "Control+Numpad0"]) {
      await press("Control+Equal", "handled", ONE_STEP_UP);
      await press(zoomToActual, "handled", 100);
    }
    for (const key of ["Equal", "Minus", "Shift+Equal", "Shift+Minus", "NumpadAdd", "NumpadSubtract"]) {
      await press(key, "free", "unchanged", "on the canvas without Cmd/Ctrl");
    }
    for (const key of ["Digit0", "Control+Alt+Equal", "Control+Alt+Minus", "Control+Shift+Digit1"]) {
      await press(key, undefined, "unchanged");
    }
    await press("F1", "free", undefined);
    await press("Escape", "free", undefined, "on the canvas without a menu or dialog");
    if (await inPage(page, canvasHandlesProbe, { root, key: "F9" })) {
      await press("F9", "canvas", undefined, "handled by the canvas");
    }
    await inPage(page, removeInjectedProbe, null);
    if (host === "ide") {
      // Guide §13.5: on the canvas, undo and redo use the document's history, never the canvas's.
      for (const key of UNDO_REDO_PRESSES) {
        await press(key, "free", undefined, "on the canvas (undo and redo belong to the VS Code document)");
      }
    }

    await press("Control+Equal", "handled", ONE_STEP_UP);
    for (const [kind, field] of TEXT_FIELDS) {
      await inside(kind, field, async () => {
        await press("Control+Equal", "blocked", "unchanged", `in ${field}`);
        await press("Control+Minus", "blocked", "unchanged", `in ${field}`);
        await press("Shift+Digit1", "free", "unchanged", `in ${field}`);
        await press("Control+KeyZ", "blocked", undefined, `in ${field}`);
        await press("Meta+Shift+KeyZ", "blocked", undefined, `in ${field}`);
        await press("Control+KeyY", "blocked", undefined, `in ${field}`);
      });
    }
    await inside("modal", "a modal dialog", async () => {
      await press("Control+Equal", "blocked", "unchanged", "with a modal dialog open");
      await press("Shift+Digit1", "free", "unchanged", "with a modal dialog open");
      await press("Escape", "blocked", undefined, "with a modal dialog open");
    });
    await inside("popover", "a popover", async () => {
      await press("Control+Minus", "handled", 100, "in a popover");
      await press("Control+Equal", "handled", ONE_STEP_UP, "in a popover");
      await press("Escape", "blocked", undefined, "with a popover open");
    });

    if (await openMenuByClick(page, root)) {
      await inPage(page, clearKeysProbe, null);
      await press("Escape", "handled", undefined, "with the menu open");
      if (await findOverlay(page, root, "menu")) problems.push("Escape with the menu open did not close it");
    }

    await focusTarget(page, root, "canvas");
    await press("Control+Equal", "handled", TWO_STEPS_UP);
    await page.keyboard.press("Shift+Digit1");
    let fitted = await inPage(page, afterPressProbe, { root });
    const reachProblem = keyReachProblem("Shift+Digit1 on the canvas", "handled", host, fitted);
    if (reachProblem) problems.push(reachProblem);
    for (let poll = 0; (fitted.zoom === null || fitted.zoom > 100) && poll < 20; poll++) {
      await page.waitForTimeout(50);
      fitted = await inPage(page, afterPressProbe, { root });
    }
    if (fitted.zoom === null || fitted.zoom > 100) {
      problems.push(
        `Shift+Digit1 on the canvas left the zoom at ${fitted.zoom ?? "?"}%, expected a fit (at most 100%)`,
      );
    }
    return finish("keys", host, problems, []);
  },
};

async function appearanceFacts(page: PageLike, root: string): Promise<AppearanceFacts | null> {
  const probe = () => inPage(page, appearanceProbe, { root, roles: MODE_ROLES });
  await hover(page, root, "zoom-in");
  const withTooltip = await probe();
  const opened = await openMenuByClick(page, root);
  const withMenu = await probe();
  if (opened) await closeByEscape(page);
  await page.mouse.move(PARK.x, PARK.y);
  if (!withTooltip || !withMenu) return withTooltip ?? withMenu;
  const names = new Set(withTooltip.parts.map((part) => part.name));
  return {
    ...withMenu,
    parts: [...withTooltip.parts, ...withMenu.parts.filter((part) => !names.has(part.name))],
  };
}

const appearanceCase: ShellConformanceCase = {
  name: "appearance",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    const root = harness.root ?? DEFAULT_ROOT;
    const size = (harness.sizes ?? DEFAULT_SIZES)[0] ?? DEFAULT_SIZES[0]!;
    const problems: string[] = [];
    for (const requested of REQUESTED_APPEARANCES) {
      const at = `[requested ${appearanceLabel(requested)}]`;
      await harness.open(page, { size, requested });
      if (harness.host === "embedded") {
        // The foreign page itself in that mode: a themed page around the modeler (guide §13.3).
        await inPage(page, hostPageModeProbe, {
          theme: requested.theme,
          kontrast: requested.kontrast ?? null,
        });
      }
      await settle(page);
      const facts = await appearanceFacts(page, root);
      if (!facts) {
        problems.push(`${at} no element matches the shell root selector "${root}"`);
        continue;
      }
      const verdict = appearanceProblems(facts, harness.host, requested, harness.themes);
      problems.push(...verdict.problems.map((problem) => `${at} ${problem}`));
    }
    return finish("appearance", harness.host, problems, []);
  },
};

const cleanupCase: ShellConformanceCase = {
  name: "cleanup",
  async run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>) {
    if (!harness.destroy) {
      return { skipped: "harness.destroy is undefined: the cleanup after destroy was not verified" };
    }
    const root = harness.root ?? DEFAULT_ROOT;
    const size = (harness.sizes ?? DEFAULT_SIZES)[0] ?? DEFAULT_SIZES[0]!;
    await harness.open(page, { size, requested: LIGHT });
    await settle(page);
    const armed = await inPage(page, armCleanupProbe, { root });
    if (!armed) fail("cleanup", harness.host, [`no element matches the shell root selector "${root}"`]);
    const problems: string[] = [];

    // A hover leaves the tooltip timer pending, so a timer that outlives destroy shows up below.
    const zoomIn = await findTarget(page, root, "zoom-in");
    if (zoomIn) {
      await page.mouse.move(PARK.x, PARK.y);
      await page.mouse.move(zoomIn.client.x, zoomIn.client.y);
    }
    try {
      await harness.destroy(page);
    } catch (error) {
      problems.push(`destroy threw: ${error instanceof Error ? error.message : String(error)}`);
    }
    await page.waitForTimeout(Math.max(INVALID_STATUS_DELAY_MS, TOOLTIP_DELAY_MS) + HOVER_MARGIN_MS);
    await page.mouse.move(PARK.x, PARK.y);
    await page.setViewportSize({ width: size.width - 40, height: size.height - 40 });
    await settle(page);

    await inPage(page, injectProbe, { root, kind: "focus-target" });
    await inPage(page, clearKeysProbe, null);
    for (const key of ["Control+Equal", "Control+Minus", "Control+Digit0", "Shift+Digit1"]) {
      await page.keyboard.press(key);
      const { keys } = await inPage(page, afterPressProbe, { root });
      const problem = afterDestroyKeyProblem(key, keys);
      if (problem) problems.push(problem);
    }
    await inPage(page, removeInjectedProbe, null);
    problems.push(...leftoverProblems(await inPage(page, leftoverProbe, null), harness.host));
    return finish("cleanup", harness.host, problems, []);
  },
};

export function createCases(): ShellConformanceCase[] {
  return [geometryCase, ariaCase, keysCase, appearanceCase, cleanupCase];
}
