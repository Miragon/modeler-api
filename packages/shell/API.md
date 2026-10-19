# @miragon/modeler-shell 0.1 — public API

The shared, framework-free implementation of everything around a Miragon diagram-js modeler: menu
button with dropdown, horizontal palette skin, chrome tooltip, zoom panel, zoom and fit keys, fit,
problems pill, status box, empty-file hint, legend and inspector slots, and the plumbing to a VS Code
webview. Planned in [Miragon/modeler-api#4](https://github.com/Miragon/modeler-api/issues/4)
(Phase 4); the first consumer is the Event Storming modeler.

- **Look and behaviour** come from the Miragon design system, guide `modeler-design-system.md`
  (skill `miragon-brand:modeler-tool-design`), §5.1 to §5.15, §6, §8, §9, §11, §12 and §13.3 to
  §13.5. Section numbers below (§x.y) refer to it.
- **Mechanics** (diagram-js services, VS Code quirks) are in
  [`docs/shell/implementation-notes.md`](../../docs/shell/implementation-notes.md).
- **Zero runtime dependencies.** The shell never imports `diagram-js`, `didi`, `vscode`, Lucide or
  React, not even for types: diagram-js services are typed structurally, the `vscode` namespace and
  Playwright's `page`/`test` are passed in.
- **Tokens are the consumer's.** The modeler vendors `cd-tokens.generated.css` unchanged; the shell
  CSS reads only `var(--cd-ui-*)` roles, `var(--cd-shell-*)` sizes and the mode-independent
  non-colour tokens `--cd-radius-*`, `--cd-shadow-*`, `--cd-motion-*`, `--cd-ease`, `--cd-ease-out`.
  It contains no colour literal and never a fixed palette token (`--cd-blau`, `--cd-schwarz`, …).
- **English by default.** Every text comes from one messages table (`ShellMessages`), every number
  goes through `Intl` in the UI language.

## Entry points

| Entry                                        | For                                                         | Needs a DOM                    |
| -------------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `@miragon/modeler-shell`                     | the chrome (`mountShell`), icons, plus all of `./core`      | yes (at call time)             |
| `@miragon/modeler-shell/core`                | fit math, keymap, zoom readout, appearance, sizes, messages | no                             |
| `@miragon/modeler-shell/diagram-js`          | `shellModule`, viewport, `connectDiagramJs`                 | yes                            |
| `@miragon/modeler-shell/vscode/extension`    | webview HTML, nonce, theme bridge (extension host)          | no                             |
| `@miragon/modeler-shell/vscode/webview`      | `mountVsCodeShell`, appearance handler, webview state       | yes                            |
| `@miragon/modeler-shell/testing`             | Playwright-driven shell conformance kit                     | runs in Node, drives a browser |
| `@miragon/modeler-shell/testing/vscode-stub` | a stand-in for VS Code around a webview test page           | yes (in the test page)         |
| `@miragon/modeler-shell/shell.css`           | every style of the shell                                    | —                              |

All JavaScript entries ship as ESM and CJS with types (`typesVersions` covers `moduleResolution:
node10`); importing any of them has no side effects. The package also ships `src/` without its tests,
the files the sourcemaps point at, so stack traces and test locations resolve to real files. Every
optional input field also accepts an explicit `undefined`, so consumers compiling with
`exactOptionalPropertyTypes` can forward optional values (`{ view: viewport.getState() }`,
`{ open: stored.legendOpen }`); the shell compiles with it too.

### Stylesheet order

The tokens come first, unless the renderer's stylesheet already imports them (Event Storming's
`event-storming.css` does, in a layer), and are loaded exactly once:

```ts
import "./theme/cd-tokens.generated.css"; // vendored, unchanged, first; left out when the renderer CSS brings it
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css"; // shortcut chips
import "diagram-js/assets/diagram-js.css"; // usually through the renderer's CSS
import "@miragon/<notation>-renderer/…css"; // the renderer
import "@miragon/modeler-shell/shell.css"; // last
```

A bundle ships the fonts as files, not as data URLs (see `./vscode/extension`).

## `./core` — DOM-free

Compiles without the DOM library (`tsconfig.core.json`), usable in the extension host and in workers.

### Geometry and shared types

```ts
interface Point {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}
// content bounds and viewboxes are in diagram coordinates
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface ScaledViewbox extends Bounds {
  scale: number;
}
// px from the edges of the modeler's container
interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type ShellHost = "ide" | "web" | "embedded";
type ChromeIsland = "menu" | "palette" | "primary" | "zoom" | "problems" | "legend" | "inspector" | "status";
const CHROME_ISLANDS: readonly ChromeIsland[];
type PaletteRow = "top" | "second-row";

interface ZoomTarget {
  zoom(): number; // 1 = 100 %
  stepZoom(direction: 1 | -1): void; // zoomScroll raster, around the container centre
  zoomToActual(): void; // 100 %, a user move
  fit(): void; // explicit fit: animated unless reduced motion; view becomes automatic
  canFit(): boolean; // false while the content bounds are empty
  onChange(listener: () => void): () => void; // every viewbox change and canFit change; unsubscribe
}

// JSON-serializable, for VS Code setState
interface ViewportState {
  viewbox: Bounds;
  userMoved: boolean; // zoomed or panned since the last fit: a resize no longer refits
}
```

`ShellHost` is the host column of §5.2: `ide` (VS Code webview, later IntelliJ), `web` (a Miragon web
app owning its page), `embedded` (a foreign page such as designIQ; geometry like `ide`).

### Sizes

```ts
const SHELL_TOKENS: {
  edge: "--cd-shell-rand";
  gap: "--cd-shell-luecke";
  row: "--cd-shell-zeile";
  target: "--cd-shell-ziel";
  entry: "--cd-shell-eintrag";
  free: "--cd-shell-frei";
  menuMinWidth: "--cd-shell-menue-breite";
  inspectorWidth: "--cd-shell-inspector-breite";
  fitInsetTop: "--cd-shell-einpassen-oben";
  fitInsetTopSecondRow: "--cd-shell-einpassen-oben-schmal";
  fitInsetSide: "--cd-shell-einpassen-seite";
  fitInsetBottom: "--cd-shell-einpassen-unten";
  fitInsetBottomWeb: "--cd-shell-einpassen-unten-web";
  narrow: "--cd-shell-schmal";
  veryNarrow: "--cd-shell-sehr-schmal";
  low: "--cd-shell-niedrig";
  layerIslands: "--cd-shell-ebene-inseln";
  layerInspector: "--cd-shell-ebene-inspector";
  layerTopRow: "--cd-shell-ebene-reihe";
  layerPopups: "--cd-shell-ebene-aufklapper";
  layerDialog: "--cd-shell-ebene-dialog";
  layerToast: "--cd-shell-ebene-toast";
};
type ShellSizeName = keyof typeof SHELL_TOKENS;
type ShellSizes = Readonly<Record<ShellSizeName, number>>;
const SHELL: ShellSizes; // edge 12, gap 8, row 40, target 32, entry 36, free 64, menuMinWidth 248,
// inspectorWidth 288, fitInsetTop 88, fitInsetTopSecondRow 140, fitInsetSide 24, fitInsetBottom 64,
// fitInsetBottomWeb 92, narrow 760, veryNarrow 440, low 820, layers 20, 25, 30, 40, 50, 60
function shellSizesFromTokens(shellGroup: Readonly<Record<string, string>>): ShellSizes;
```

`SHELL` equals `parseFloat` of the `shell` group of `cd-tokens.generated.json`; a drift test pins it
to the token fixture. `shellSizesFromTokens` reads a vendored JSON's `shell` group and throws, naming
the token, when a size is missing or neither `"<n>px"` nor a plain number (so `"12em"` fails instead
of silently becoming 12); unknown tokens are ignored.

A modeler pins its own vendored JSON the same way, in a unit test (Vitest or `node:test`), never in
its e2e suite: the check is pure data. Both expectations, because the fit math reads `SHELL` and the
stylesheet reads the tokens:

```ts
expect(SHELL).toEqual(shellSizesFromTokens(vendoredTokens.shell));
expect(Object.keys(vendoredTokens.shell)).toEqual(expect.arrayContaining(Object.values(SHELL_TOKENS)));
```

### Fit

```ts
const MAX_FIT_ZOOM = 1;
const FIT_ANIMATION_MS = 250;
const VIEW_TOLERANCE = 1e-3;

function fitViewbox(
  bounds: Bounds,
  container: Size,
  insets: Insets,
  maxZoom?: number,
): ScaledViewbox | undefined;

interface FitLayout {
  container: Size;
  host: ShellHost;
  paletteRow: PaletteRow;
  problemsVisible: boolean;
  legendWidth?: number; // open legend's rendered width, undefined when closed/absent
  inspector?: { sheetTop?: number }; // present = open; sheetTop measured when it is a bottom sheet
}
function fitInsets(layout: FitLayout): Insets;
function freeRectCenter(container: Size, insets: Insets): Point | undefined; // px from the container's top left

function sameView(
  a: Pick<ScaledViewbox, "x" | "y" | "scale">,
  b: Pick<ScaledViewbox, "x" | "y" | "scale">,
  tolerance?: number,
): boolean;
function interpolateViewbox(from: ScaledViewbox, to: ScaledViewbox, progress: number): ScaledViewbox;
function easeStandard(progress: number): number; // cubic-bezier(0.4, 0, 0.2, 1)
```

- `fitViewbox` centres `bounds` in the free rectangle (container minus insets) at the largest scale
  that fits, capped at `maxZoom`, and returns a box with the container's aspect ratio, so
  `canvas.viewbox(box)` shows exactly that view (§5.9). `undefined` for a container with a 0 side,
  for bounds without width and height, or for a non-finite result; a zero width or height scales by
  the other dimension. An axis whose insets leave no room (a container lower or narrower than its
  chrome) centres in the whole container.
- `fitInsets` (§5.9): top 88, 140 in the second row; left and right 24; bottom 64, in the `web` host
  with a visible pill 92; right 324 (12 + 288 + 24) with an open side inspector (container wider
  than 760); left 12 + legend width + 24 with an open legend in containers wider than 440
  (`legendWidth <= 0` counts as closed); bottom `container.height − sheetTop + 12` with an open
  bottom sheet (up to 760). The sheet hides zoom panel, pill and legend (§5.11), so while it is open
  neither the legend nor the web pill counts; without a measured `sheetTop` the bottom stays 64.
- `freeRectCenter` is the centre of the free rectangle, where `fitViewbox` centres the content and
  keyboard creation places an element (§5.5), in pixels from the container's top left; an axis whose
  insets leave no room centres in the whole container, as in `fitViewbox`. `undefined` for a
  container with a 0 side. `Viewport.freeRectCenter()` turns it into diagram coordinates.
- `sameView` compares `scale` and the screen translation (`x · scale`, `y · scale`) within
  `tolerance` relative to `max(1, |value|)`; width and height never count, so a resize is no move.
- `interpolateViewbox` interpolates the scale in log space and the centre linearly.

### Zoom readout

```ts
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
function canZoomOut(zoom: number): boolean; // zoom > 0.2 · 1.001
function canZoomIn(zoom: number): boolean; // zoom < 4 · 0.999
function formatPercent(zoom: number, lang: string): string; // "86%", German "86 %" (U+00A0)
function formatNumber(value: number, lang: string): string; // a tag Intl rejects ("") formats as "en"
interface ZoomReadout {
  text: string;
  ariaLabel: string;
  canZoomOut: boolean;
  canZoomIn: boolean;
}
function zoomReadout(
  zoom: number,
  lang: string,
  messages: Pick<ShellMessages, "zoomToActualNow">,
): ZoomReadout;
```

### Keymap

```ts
type ChromeKey = "zoomIn" | "zoomOut" | "zoomToActual" | "fit";
interface KeyLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}
function matchChromeKey(event: KeyLike): ChromeKey | undefined;
function isUndoRedoKey(event: KeyLike): boolean;
const TEXT_FIELD_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

interface KeyContext {
  host: ShellHost;
  inTextField: boolean; // target matches TEXT_FIELD_SELECTOR or isContentEditable
  menuOpen: boolean; // the shell's dropdown
  dialogOpen: boolean; // any shown [role="dialog"], [role="alertdialog"] or <dialog open>, modal or not
  modalOpen: boolean; // one of them with aria-modal="true" or :modal
  defaultPrevented: boolean; // the canvas or the modeler handled the key
}
type KeyAction = ChromeKey | "closeMenu";
interface KeyDecision {
  action?: KeyAction;
  preventDefault: boolean;
  stopPropagation: boolean;
}
function decideKey(event: KeyLike, context: KeyContext): KeyDecision;

type Platform = "mac" | "other";
interface NavigatorLike {
  platform?: string;
  userAgentData?: { platform?: string };
}
function detectPlatform(navigator?: NavigatorLike): Platform;
function shortcutLabel(key: ChromeKey, platform: Platform, keyNames: ShellMessages["keyNames"]): string;
function ariaKeyShortcuts(key: ChromeKey, platform: Platform): string;
function ariaKeyShortcutsFromLabel(label: string): string | undefined;
```

`matchChromeKey` (§5.8) — Cmd/Ctrl is `metaKey || ctrlKey` on every platform, nothing matches with
`altKey` (AltGr):

| Chrome key     | Matches                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `zoomIn`       | Cmd/Ctrl + `key` `+` or `=` (with or without Shift), or `code` `NumpadAdd` |
| `zoomOut`      | Cmd/Ctrl + `key` `-` or `_`, or `code` `NumpadSubtract`                    |
| `zoomToActual` | Cmd/Ctrl + `key` `0`, or `code` `Numpad0` (also with NumLock off)          |
| `fit`          | `code` `Digit1` with Shift, without Cmd, Ctrl and Alt (every layout)       |

`decideKey` holds every key rule of §5.8 and §13.5; the shell's one `keydown` listener only applies
it. `stopPropagation` is only ever `true` in the `ide` host.

| Case                                                      | Action      | preventDefault | stopPropagation (`ide`) |
| --------------------------------------------------------- | ----------- | -------------- | ----------------------- |
| Escape (no modifier), menu open, not composing            | `closeMenu` | yes            | yes                     |
| Escape, popover or dialog open, or menu open while IME    | —           | no             | yes                     |
| zoom key, not composing, not in a text field, no modal    | the key     | yes            | yes                     |
| zoom key while composing, in a text field or with a modal | —           | no             | yes                     |
| Shift+1, not composing, not in a text field, no modal     | `fit`       | yes            | yes                     |
| Shift+1 otherwise                                         | —           | no             | no (types "!")          |
| undo/redo key in a text field                             | —           | no             | yes                     |
| any other key with `defaultPrevented`                     | —           | no             | yes                     |
| everything else                                           | —           | no             | no                      |

- "No modifier" means no Meta, Ctrl, Alt or Shift. During IME composition Escape belongs to the IME.
- Zoom keys act whatever `defaultPrevented` says (diagram-js's keyboard prevents every key a listener
  answered, the shell's own guard included); a blocked Shift+1 is never stopped.
- `isUndoRedoKey` (Cmd/Ctrl + Z, Shift+Z, Y) decides by the typed character when it is ASCII, so
  QWERTZ and Dvorak work, and falls back to `code` `KeyZ`/`KeyY` only for non-ASCII layouts
  (Cyrillic, Greek). Cmd/Ctrl+Shift+Y is not redo: VS Code toggles its Debug Console with it.

Shortcut labels (§5.8): macOS `⌘+`, `⌘−` (U+2212), `⌘0`, `⇧1`; elsewhere `Ctrl+Plus`, `Ctrl+Minus`,
`Ctrl+0`, `Shift+1` from `keyNames`. `aria-keyshortcuts`: `Meta+= Meta+Plus`, `Meta+-`, `Meta+0`,
`Shift+1`; outside macOS `Control` for `Meta`. The platform is read in the page itself
(`detectPlatform(navigator)`, `userAgentData.platform || platform`, so an empty `userAgentData`
platform falls back), never in the extension host (VS Code Remote).

`ariaKeyShortcutsFromLabel` turns a shortcut chip label into `aria-keyshortcuts` (§5.6) for palette
entries and menu actions: `"L"` → `"L"`, `"⇧L"` → `"Shift+L"`, `"⌘⇧Z"` → `"Meta+Shift+Z"`,
`"Ctrl+Shift+E"` → `"Control+Shift+E"`, `"Del"` → `"Delete"`, `"Ctrl++"` → `"Control+Plus"`; a label
that is not one key combination (`"G then D"`, `"1–9"`) gives `undefined`.

### Appearance

```ts
type Theme = "light" | "dark";
type Kontrast = "hoch";
interface Appearance {
  theme: Theme;
  kontrast?: Kontrast;
}
function resolveAppearance(requested: Appearance, themes: readonly Theme[]): Appearance;
function appearanceFromColorThemeKind(kind: number): Appearance;
type ColorThemeSetting = "automatic" | "light" | "dark";
function requestedAppearance(kind: number, setting?: ColorThemeSetting): Appearance;
function appearanceFromBodyClasses(classes: Iterable<string>): Appearance | undefined;
function reducedMotionFromBodyClasses(classes: Iterable<string>): boolean; // vscode-reduce-motion
const REDUCED_MOTION_CLASS = "cd-shell-reduce-motion"; // on <html>, mirrored by mountVsCodeShell
interface AppearanceAttributes {
  "data-cd-theme": Theme;
  "data-cd-kontrast"?: Kontrast;
}
function appearanceAttributes(appearance: Appearance): AppearanceAttributes;
```

- `resolveAppearance` is the one decision of §13.5: a theme outside `themes` becomes `themes[0]`, so
  a modeler declaring `["light"]` is never half-dark; `kontrast: "hoch"` always passes (VS Code High
  Contrast on a light-only modeler gives `{ theme: "light", kontrast: "hoch" }`), any other value is
  dropped, since appearances arrive by `postMessage`. Throws for empty `themes`. `themes` is a static
  value of the modeler package, known before the first paint.
- `appearanceFromColorThemeKind`: 1 → light, 2 → dark, 3 → dark + hoch, 4 → light + hoch, other →
  light. `requestedAppearance` lets the setting's theme win unless it is `automatic`; the contrast
  always comes from the kind.
- `appearanceFromBodyClasses` checks `vscode-high-contrast-light` before `vscode-high-contrast`.
- `reducedMotionFromBodyClasses` reads VS Code's `workbench.reduceMotion` from the body class
  `vscode-reduce-motion`; while `<html>` carries `REDUCED_MOTION_CLASS`, the shell's animations stop
  and an explicit fit jumps, as under `prefers-reduced-motion`.

### Messages

```ts
interface ShellMessages {
  menu: string; // "Menu"
  tools: string; // "Tools"
  canvas: string; // "Diagram": aria-label of the focusable canvas <svg>, name the notation
  zoom: string; // "Zoom"
  zoomOut: string; // "Zoom out"
  zoomIn: string; // "Zoom in"
  zoomToActual(percent: string): string; // "Zoom to 100%"
  zoomToActualNow(percent: string, now: string): string; // "Zoom to 100% (now 86%)"
  fit: string; // "Fit to view"
  legend: string; // "Legend"
  closeLegend: string; // "Close legend"
  problems(count: number, formattedCount: string): string; // "1 problem", "2 problems"
  problemsLabel(count: number, errors: number, formattedCount: string, formattedErrors: string): string;
  // "2 problems, 1 error", "2 problems, no errors"
  showProblems: string; // "Show in Problems view"
  emptyHint: string; // "Pick a tool from the palette to start."
  insertExample: string; // "Insert example"
  invalidFile(diagram: string): string;
  // "This file isn't a valid <diagram> right now. The diagram shows the last valid version and is read-only until you fix the text."
  keyNames: { ctrl: string; shift: string; plus: string; minus: string }; // Ctrl, Shift, Plus, Minus
}
// every key optional; an undefined value keeps the default
type ShellMessageOverrides = {
  [Key in Exclude<keyof ShellMessages, "keyNames">]?: ShellMessages[Key] | undefined;
} & { keyNames?: { [Key in keyof ShellMessages["keyNames"]]?: string | undefined } | undefined };
const defaultMessages: ShellMessages;
function resolveMessages(overrides?: ShellMessageOverrides): ShellMessages;
```

A localized modeler overrides the whole table (guide §2: one language per tool) and passes `lang`.

### Layout decisions

```ts
const PALETTE_CLEARANCE = 16;
const TOOLTIP_DELAY_MS = 300;
const INVALID_STATUS_DELAY_MS = 800;
interface PaletteRowInput {
  containerWidth: number;
  paletteWidth: number;
  menuRight: number;
  primaryLeft?: number;
}
function decidePaletteRow(input: PaletteRowInput): PaletteRow;
function legendStartsOpen(containerHeight: number): boolean; // > 820
interface TooltipPlacementInput {
  anchor: Bounds;
  island: Bounds;
  tooltip: Size;
  container: Size;
}
function placeTooltip(input: TooltipPlacementInput): Point;
```

`decidePaletteRow` (§5.15): `second-row` up to 760px container width, or when the centred palette
would keep less than 16px to the menu trigger (or to the primary action); `paletteWidth` is the
intrinsic border-box width (`offsetWidth − clientWidth + scrollWidth`: the content including the
borders), so the decision does not flip once the palette scrolls in the second row.

`placeTooltip` (§5.6): below an island in the upper half at `island.bottom + 8` (top row 60, second
row 112), above one in the lower half ending 8px above it (bottom row: `bottom: 60px`), centred on
`anchor`, shifted to keep 12px to the sides.

## `.` — the chrome

Exports everything of `./core` plus:

```ts
function mountShell(root: HTMLElement, options: ShellOptions): ShellHandle;

interface ShellOptions {
  host: ShellHost;
  canvas?: HTMLElement; // diagram-js's container; omitted: the shell creates it (handle.canvas)
  lang?: string; // see below; the embedded root carries lang itself
  messages?: ShellMessageOverrides;
  platform?: Platform; // default detectPlatform(navigator)
  keyScope?: "document" | "root"; // default "document", "root" for embedded
  themes?: readonly Theme[]; // default ["light"]; read in the embedded host only, see below
  menu?: MenuGroups;
  problems?: ProblemsOptions;
  legend?: LegendOptions;
  inspector?: InspectorOptions;
  emptyHint?: EmptyHintOptions;
}
```

`mountShell` turns `root` into the shell: class `cd-shell`, `container: cd-shell / size`,
`isolation: isolate`. `root` must be sized from outside, otherwise size containment collapses it to 0:
in an own document a root that is a direct child of `<body>` gets `height: 100%` from `shell.css`
(a zero-specificity rule), any other root and an embedded one need an explicit size. In the `ide` and
`web` hosts `<html>` gets `cd-shell-document` (own-document reset). The shell observes the root and
the registered palette with a `ResizeObserver` (palette row, legend start state; 0 × 0 is skipped)
and installs exactly one `keydown` listener (bubble phase) on `document` or on the root.

`lang` is the tool's UI language for `Intl` (guide §2: one language per tool). Default in an own
document (`ide`, `web`): the closest `[lang]` of the root (the `<html lang>` the host wrote), else
`"en"`. In the `embedded` host the page's language is not the tool's, so the default is the root's
own `lang` attribute, else `"en"`; the embedded root carries `lang` itself. A localized modeler
passes `lang` together with its messages.

**The embedded root's mode** (§13.3). The token CSS resolves the roles on the nearest
`[data-cd-theme]`, so a root without one would take the mode of a themed host page (designIQ, a web
app on `system` under a dark OS) and be half-dark against its light-drawn diagram. The `embedded`
root therefore carries `data-cd-theme="<themes[0]>"` itself (until contract 1.1 there is no channel
to ask an embedded modeler for another mode, so it stays in its first one), and mirrors the host's
`data-cd-kontrast` from the nearest mode carrier above it for as long as it lives (a
`MutationObserver` on the document's `data-cd-theme`/`data-cd-kontrast` attributes), because its own
`data-cd-theme` would otherwise drop the host's high contrast. In an own document (`ide`, `web`) the
host writes the mode on `<html>` and `themes` is not read. An empty `themes` throws before anything
is mounted.

**Order with document listeners.** Listeners on one target run in registration order. A modeler
whose own keyboard listens on `document` (Event Storming does) constructs its diagram **before**
`mountShell`, so the shell's listener runs after it and sees `defaultPrevented`; a renderer that
creates its diagram lazily (Event Storming's `Modeler` on the first `get`) calls
`modeler.get("canvas")` first. Listeners on the canvas `<svg>` (diagram-js `keyboard`) have no
ordering constraint. Such a document keyboard must leave alone what is not meant for the canvas:
keys with `defaultPrevented` and keys whose target lies outside the canvas container (the menu
stops the keys it consumes, the palette its own, but the zoom panel's buttons do not); in the IDE
host it binds no undo or redo, and on the canvas it handles Cmd/Ctrl+A (see `./diagram-js`,
Keyboard).

### Menu (§5.4)

```ts
interface MenuGroups {
  model?: readonly MenuEntry[];
  export?: readonly MenuEntry[];
  help?: readonly MenuEntry[];
}
type MenuEntry = MenuActionEntry | MenuDialogEntry | MenuCheckboxEntry | MenuRadioGroup;

interface MenuItemBase {
  id: string;
  label: string;
  icon?: ShellIconName;
  disabled?: () => boolean;
  keepEnabledWhenReadOnly?: boolean; // a Model entry that is pure view state; default false
}
interface MenuActionEntry extends MenuItemBase {
  kind: "action";
  shortcut?: string;
  ariaKeyShortcuts?: string; // default ariaKeyShortcutsFromLabel(shortcut); "" sets none
  danger?: boolean;
  onSelect(): void;
}
interface MenuDialogEntry extends MenuItemBase {
  kind: "dialog";
  onSelect(): void;
}
interface MenuCheckboxEntry extends MenuItemBase {
  kind: "checkbox";
  checked(): boolean;
  onToggle(checked: boolean): void;
}
interface MenuRadioGroup {
  kind: "radio";
  id: string;
  label: string;
  options: readonly MenuRadioOption[];
  value(): string | undefined;
  onSelect(value: string): void;
  disabled?: () => boolean;
  keepEnabledWhenReadOnly?: boolean;
}
interface MenuRadioOption {
  value: string;
  label: string;
}
```

- Groups render in the fixed order Model, Export, Help with separators; empty groups collapse. The
  File and Appearance groups of the web app are not part of 0.1. With a legend (and
  `legend.menuEntry !== false`) the shell appends the checkbox "Legend" to the Model group.
- `action` and `dialog`: the menu closes, focus returns to the trigger, then `onSelect` runs (a host
  dialog then hands focus back to a visible control). `dialog` adds `aria-haspopup="dialog"`; its
  label ends with "…" (U+2026), and in 0.1 the modeler renders the dialog itself (see
  [Modeler dialogs](#modeler-dialogs)).
- `checkbox` and `radio` toggle and keep the menu open. State is read through `checked()`, `value()`
  and `disabled()` whenever the menu opens and on `menu.refresh()`.
- Icons only from the common set and only where the guide gives one; the icon column stays 16px wide
  without an icon. An action with a `shortcut` carries `aria-keyshortcuts`.
- On a read-only canvas (`setReadOnly(true)`, §13.5) every Model entry is `aria-disabled` unless it
  sets `keepEnabledWhenReadOnly`; disabled entries stay focusable and do nothing. View toggles stay
  usable on a read-only canvas: the shell's Legend checkbox carries `keepEnabledWhenReadOnly` itself,
  and a modeler sets it on its own pure view state (Event Storming's "Type captions"), never on an
  entry that changes the document (Level, "Map size…"). Export and Help entries are never locked.
  Product decision, guide update pending in Miragon/corporate-identity: §13.5 still lists every Model
  entry as `aria-disabled`.
- The trigger is `hidden` while no group has an entry (no menu groups and no Legend entry).
- Keys: Enter, Space and ↓ on the trigger open on the first entry, ↑ on the last; ↑/↓ wrap, Home/End
  jump, a letter jumps to the next entry starting with it; Escape and Tab close (Escape returns focus
  to the trigger). Every key the menu consumes (those, plus Enter, Space, Delete and Backspace in the
  dropdown) is stopped at the menu in every host, so a modeler's keyboard on `document` never acts
  on it (Event Storming would move the selection on ↓); Escape, Tab, modified keys and the chrome
  keys go on (Shift+1 fits, Cmd/Ctrl + `+` zooms with the menu open).
- A `pointerdown` outside (capture phase on `document`) closes without moving focus and without
  stopping the event, so it still acts on its target. So does the window losing the focus (a click
  into the VS Code workbench or another iframe).

### Modeler dialogs

0.1 has no dialog component (a 0.2 candidate, see [Out of scope for 0.1](#out-of-scope-for-01)), so a
modeler renders its dialogs, the "Keyboard shortcuts…" dialog of the Help group (§5.4) first among
them, and meets §8 on its own:

- **Layer.** `z-index: var(--cd-shell-ebene-dialog)` (50) applies only to a dialog outside the top
  layer, inside `shell.root`. A `<dialog>` opened with `showModal()` or an element of the popover API
  lies in the browser's top layer above everything, whatever its `z-index`. The shell's keys count it
  either way: any shown `<dialog>`, `[role="dialog"]` or `[role="alertdialog"]` in the document
  (embedded: in the root) is open, and a modal one blocks the zoom keys.
- **Panel and backdrop** (§8): panel `--cd-ui-flaeche-hoch` with 1px `--cd-ui-linie`, radius `md`,
  `shadow-3`, `width: min(560px, 100cqw - 32px)`, `max-height: calc(100cqh - 32px)` with a scrolling
  body; header (padding `16px 16px 8px 24px`, title 21px/600) with Close as a 32 × 32 ghost icon
  button (Lucide `x` 16px, `aria-label` "Close"); backdrop
  `background: var(--cd-ui-backdrop); backdrop-filter: blur(3px) grayscale(1)` in both modes. The
  shortcut chips look like the tooltip's (§5.6).
- **High contrast** (`[data-cd-kontrast="hoch"]`, §6, §5.14): no shadow, border `--cd-ui-kontur`,
  focus ring 3px.
- **Forced colours** (`@media (forced-colors: active)`): border `CanvasText`, focus ring `Highlight`.
  The shell's own high-contrast and forced-colours rules match only `cd-shell-*` classes, so they
  do not reach a modeler's dialog.
- **Focus** (§8): it moves into the dialog and stays there, Escape and a click on the backdrop close
  it, and it returns to the control that opened it (the menu trigger after a menu entry).
- **Read-only:** the shortcuts dialog stays usable on a read-only canvas (§13.5).
- **Teardown:** the dialog is the modeler's content in `shell.root`, removed by the modeler (see
  `destroy()` below).

### Problems, legend, inspector, empty-file hint

```ts
interface ProblemsOptions {
  onActivate(): void; // the IDE host opens its Problems view
}
interface LegendOptions {
  render(body: HTMLElement): void; // once; a throw unwinds the whole mount
  open?: boolean; // remembered start state; default (also undefined) legendStartsOpen(container height)
  onToggle?(open: boolean): void; // every change (close button, checkbox, setOpen, toggle); persist it
  menuEntry?: boolean; // default true
}
interface InspectorOptions {
  label: string; // aria-label of the <aside>
}
interface EmptyHintOptions {
  onInsertExample?(): void; // shows "Insert example"; the modeler writes the example as one edit
}
```

### Handle

```ts
interface ShellHandle {
  readonly root: HTMLElement;
  readonly canvas: HTMLElement;
  readonly host: ShellHost;
  readonly lang: string;
  readonly platform: Platform;
  readonly messages: ShellMessages;
  readonly menu: MenuHandle;
  readonly tooltip: TooltipHandle;
  readonly legend: LegendHandle | undefined;
  readonly inspector: InspectorHandle | undefined;
  setZoomTarget(target: ZoomTarget | null): void;
  fitInsets(): Insets;
  registerPalette(palette: PaletteRegistration): () => void;
  setProblems(summary: ProblemSummary): void;
  setStatus(status: StatusMessage | null, options?: { delayMs?: number }): void;
  setEmptyHint(visible: boolean): void;
  setReadOnly(readOnly: boolean, options?: { delayMs?: number }): void;
  isReadOnly(): boolean;
  destroy(): void;
}
interface MenuHandle {
  readonly trigger: HTMLButtonElement;
  readonly dropdown: HTMLElement;
  isOpen(): boolean;
  open(focus?: "first" | "last"): void;
  close(options?: { restoreFocus?: boolean }): void;
  refresh(): void;
  setGroups(groups: MenuGroups): void;
}
interface TooltipContent {
  label: string;
  shortcut?: string;
}
interface TooltipHandle {
  attach(control: HTMLElement, content: TooltipContent | (() => TooltipContent | null)): () => void;
  hide(): void;
}
interface LegendHandle {
  readonly element: HTMLElement;
  readonly body: HTMLElement;
  isOpen(): boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}
interface InspectorHandle {
  readonly element: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
}
interface PaletteRegistration {
  element: HTMLElement; // .djs-palette
  entryTooltip(entry: HTMLElement): TooltipContent | null;
  setReadOnly(state: PaletteReadOnlyState): void; // on registration and on every change
}
interface PaletteReadOnlyState {
  locked: boolean; // veto every entry but Lasso and Hand, from the invalid import on
  shown: boolean; // mark them aria-disabled and muted, once the delay has passed
}
interface ProblemSummary {
  count: number;
  errors: number;
}
type StatusSeverity = "danger" | "warning";
interface StatusMessage {
  severity: StatusSeverity;
  text: string;
}
```

- `setZoomTarget` binds zoom panel, readout and chrome keys; the readout reads `zoom()` at most once
  per animation frame after `onChange`. With `null` the three buttons are `aria-disabled`; the readout
  never is (§5.8), its click does nothing then. Buttons and keys never call `stepZoom` past a limit
  (zoom out at or below 20 % never zooms in), never `zoomToActual` at exactly 100 % and never `fit`
  while `canFit()` is false.
- `fitInsets()` is `fitInsets(layout)` of `./core` for what is open and measured right now (palette
  row, pill, legend width, side inspector or measured sheet top).
- `registerPalette` is the adapter's API (`connectDiagramJs` calls it, possibly from inside
  diagram-js's `palette.create`, before any entry exists); a later registration replaces the
  earlier one, and the returned unregister function is safe to call twice and after `destroy()`.
- `setProblems`: the pill shows for `count > 0` with `Intl` numbers in `lang` and the icon by severity;
  its tooltip "Show in Problems view" exists only in the `ide` host (`aria-describedby`, since it
  says more than the label).
- `setStatus(status, { delayMs })`: shows after `delayMs` (an invalid file: `INVALID_STATUS_DELAY_MS`,
  so typing does not flicker and `role="alert"` does not re-announce), hides at once with `null`.
  Repeated calls while the delay runs keep the first timer (the box appears once the text stayed
  invalid for 800ms), `null` drops it, and an unchanged text is not written again.
- `setReadOnly(true, { delayMs })` (invalid file, §13.5) locks at once: `isReadOnly()`, the palette
  veto (every entry but Lasso and Hand) and the Model entries of the menu without
  `keepEnabledWhenReadOnly`. The marks follow after `delayMs` (pass `INVALID_STATUS_DELAY_MS`, as for
  the status box): `data-readonly` on the root and the palette entries `aria-disabled`, muted,
  previews in `grayscale(1)`. Repeated calls keep the first timer; `setReadOnly(false)` unlocks and
  hides at once. The legend is a view toggle: its Legend checkbox and its close button keep working
  under the lock (product decision, guide update pending in Miragon/corporate-identity).
- The canvas is the modeler's to lock, from the same invalid import on (§13.5, what the read-only
  state blocks): no context pad, no move, resize, delete or paste, and no label editor (also not on
  a double-click). Selection, zoom, pan, the export of the last valid state and the "Keyboard
  shortcuts…" dialog stay. The modeler reads `isReadOnly()` or keeps a lock of its own next to
  `setReadOnly` (Event Storming's `eventStormingReadOnly` service); the kit's `readOnly` case checks
  each of these.
- `setEmptyHint` shows or hides the hint; `connectDiagramJs` keeps it in sync with the diagram. When
  the hint (its "Insert example") or the closing inspector holds the focus, the focus moves to the
  canvas `<svg>` (else the menu trigger) instead of falling to `<body>`.
- `tooltip.attach` shows the chrome tooltip after `TOOLTIP_DELAY_MS` hover or at once on keyboard
  focus (`:focus-visible`, also on `aria-disabled` buttons); after a hover-hide a neighbour shows at
  once for the same delay. It hides on click (until the pointer leaves), Escape, leave, blur and menu
  open, never on touch. It sets `aria-describedby` only when its text says more than the control's
  name, which a shortcut chip does unless the control names its keys in `aria-keyshortcuts`. The
  shell attaches it to its own buttons; the palette gets it through `registerPalette`.
- The legend's start state comes from `legend.open` or, at the first non-zero container size, from
  `legendStartsOpen`; that automatic decision does not call `onToggle`. Its close button returns the
  focus to the menu trigger.
- `destroy()` removes every element, class, attribute, listener, observer and timer the shell added
  and restores what was there before the mount: a passed `canvas` stays where it is, without
  `cd-shell-canvas`, and a `cd-shell-document` class or a `lang` the page already had stays (the
  class `renderWebviewHtml` writes on `<html>` included). A second call and every later handle call
  are no-ops. A mount that throws (a modeler's `legend.render`) undoes the same before the error
  propagates. Content a modeler adds to `shell.root` (a dialog, a popover) is the modeler's: it
  removes it in its own teardown, before or with `shell.destroy()`, for example on `diagram.destroy`,
  because the shell removes only what it added.
- Element ids (`cd-shell-menu-N`, `cd-shell-tooltip-N`, `cd-shell-legend-title-N`) count on one
  page-global counter (`Symbol.for("@miragon/modeler-shell.mounts")`), so two modelers that each
  bundle the shell never share an id on one foreign page.

### Icons

```ts
type IconNode = ReadonlyArray<readonly [tag: string, attributes: Readonly<Record<string, string>>]>;
type ShellIconName =
  | "menu"
  | "minus"
  | "plus"
  | "maximize"
  | "check"
  | "x"
  | "file-plus"
  | "folder-open"
  | "import"
  | "file-image"
  | "file-code-corner"
  | "keyboard"
  | "share-2"
  | "circle-x"
  | "triangle-alert"
  | "square-dashed-mouse-pointer"
  | "hand"
  | "spline"
  | "unfold-horizontal"
  | "workflow";
const ICONS: Readonly<Record<ShellIconName, IconNode>>; // lucide-static 1.59.0, unchanged (ISC)
interface IconOptions {
  size?: number; // default 16
  strokeWidth?: number; // default 2.5
  className?: string;
}
const PALETTE_TOOL_ICON: Readonly<IconOptions>; // { size: 20, strokeWidth: 2 }
function iconMarkup(icon: ShellIconName | IconNode, options?: IconOptions): string;
function iconElement(icon: ShellIconName | IconNode, options?: IconOptions): SVGSVGElement;
```

`iconMarkup` renders decorative SVG (`aria-hidden="true"`, `focusable="false"`, `fill="none"`,
`stroke="currentColor"`, round caps and joins) and lets only Lucide's elements and geometry
attributes pass, so palette providers can put it into an entry's `html`.

The geometry is Lucide's (ISC, © Lucide Icons and Contributors); `check`, `circle-x`, `maximize`,
`minus`, `plus`, `triangle-alert` and `x` derive from Feather (MIT, © Cole Bemis), as Lucide's
LICENSE lists them (two by their Feather names, `x-circle` and `alert-triangle`). `src/dom/icons.ts`
opens with a legal comment (`/*! … @license … */`) naming both, which esbuild keeps in the `dist`
chunk that carries the icons (ESM and CJS). A consumer's bundler may drop or move legal comments (its
`legalComments` setting), so a VSIX or a web bundle that contains the shell carries the Lucide and
Feather notices of `THIRD_PARTY_NOTICES.md` itself.

### DOM, `data-chrome` and classes

```html
<html class="cd-shell-document" lang="en" data-cd-theme="light">  <!-- own document: ide, web -->
<div class="cd-shell" data-cd-shell-host="ide" data-palette="top"
     data-legend="open" data-inspector="open" data-problems="shown" data-readonly>  <!-- state attributes only while true -->
     <!-- embedded: lang="en" data-cd-theme="light" [data-cd-kontrast="hoch"] on the root itself -->
  <button class="cd-shell-menu-trigger" data-chrome="menu" aria-label="Menu" aria-haspopup="menu"
          aria-expanded="false" aria-controls="cd-shell-menu-1">…</button>
  <div class="cd-shell-canvas">                         <!-- diagram-js container -->
    <div class="djs-container">
      <div class="djs-palette" data-chrome="palette">   <!-- moved before the <svg> -->
        <div class="djs-palette-entries" role="toolbar" aria-label="Tools">
          <div class="group" data-group="tools">
            <div class="entry" data-action="lasso-tool" role="button" aria-label="…" tabindex="0" aria-pressed="false" aria-keyshortcuts="L">…</div>
      <svg tabindex="0" role="application" aria-label="Diagram">…</svg>
  <div class="cd-shell-status" data-chrome="status" data-severity="danger" role="alert">…</div>
  <div class="cd-shell-hint"><p class="cd-shell-hint-text">…</p><button class="cd-shell-hint-action">…</button></div>
  <aside class="cd-shell-inspector" data-chrome="inspector" aria-label="…">…</aside>
  <button class="cd-shell-problems" data-chrome="problems" aria-label="2 problems, 1 error">…</button>
  <section class="cd-shell-legend" data-chrome="legend" aria-labelledby="…">…</section>
  <div class="cd-shell-zoom" data-chrome="zoom" role="group" aria-label="Zoom">
    <button data-zoom="out"> <button class="cd-shell-zoom-readout" data-zoom="actual"> <button data-zoom="in">
    <span class="cd-shell-zoom-separator"> <button data-zoom="fit">
  </div>
  <div class="cd-shell-layer">                           <!-- z 40: dropdown and tooltip -->
    <div class="cd-shell-menu" id="cd-shell-menu-1" role="menu" aria-label="Menu">…</div>
    <div class="cd-shell-tooltip" role="tooltip"><span class="cd-shell-tooltip-label">Zoom in</span><kbd class="cd-shell-kbd">⌘+</kbd></div>
  </div>
</div>
```

The DOM order is the tab order of §5.14 (menu trigger, palette, canvas, status box, hint, inspector,
pill, legend, zoom panel); nothing has a positive `tabindex`, and a renderer adds no tab stop of its
own around the canvas (no `tabindex` on `.djs-container`). Islands that are not shown are `hidden`.

| `data-chrome` | Element                        | Notes                                      |
| ------------- | ------------------------------ | ------------------------------------------ |
| `menu`        | menu trigger                   | icon only, Lucide `menu`                   |
| `palette`     | diagram-js `.djs-palette`      | set by `shellModule`                       |
| `primary`     | reserved for the web app (0.2) | never rendered in 0.1                      |
| `zoom`        | zoom panel                     | `[−][NN%][+] \| [Fit]`                     |
| `problems`    | problems pill                  | `hidden` at 0                              |
| `legend`      | legend card                    | only with `legend`                         |
| `inspector`   | inspector `<aside>`            | only with `inspector`                      |
| `status`      | status box under the palette   | `role="alert"` (danger) or `role="status"` |

| Class                                                                                                                                                                                                                      | Part                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `cd-shell`, `cd-shell-document`, `cd-shell-canvas`, `cd-shell-layer`                                                                                                                                                       | root, own document, canvas slot, layer     |
| `cd-shell-island`, `cd-shell-target`                                                                                                                                                                                       | glass island, 32px target in an island     |
| `cd-shell-menu-trigger`, `cd-shell-menu`, `cd-shell-menu-item`, `cd-shell-menu-item-icon`, `cd-shell-menu-item-label`, `cd-shell-menu-item-end`, `cd-shell-menu-separator`, `cd-shell-menu-heading`, `cd-shell-menu-group` | menu                                       |
| `cd-shell-menu-shortcut`, `cd-shell-menu-check`                                                                                                                                                                            | shortcut text and check mark of an entry   |
| `cd-shell-tooltip`, `cd-shell-tooltip-label`, `cd-shell-kbd`                                                                                                                                                               | tooltip and shortcut chip                  |
| `cd-shell-zoom`, `cd-shell-zoom-readout`, `cd-shell-zoom-separator`                                                                                                                                                        | zoom panel                                 |
| `cd-shell-problems`, `cd-shell-problems-icon`, `cd-shell-problems-text`                                                                                                                                                    | pill                                       |
| `cd-shell-status`, `cd-shell-status-icon`, `cd-shell-status-text`                                                                                                                                                          | status box (bar as `::before`)             |
| `cd-shell-hint`, `cd-shell-hint-text`, `cd-shell-hint-action`                                                                                                                                                              | empty-file hint                            |
| `cd-shell-legend`, `cd-shell-legend-header`, `cd-shell-legend-title`, `cd-shell-legend-close`, `cd-shell-legend-body`                                                                                                      | legend card                                |
| `cd-shell-legend-row`, `cd-shell-legend-preview`, `cd-shell-legend-separator`                                                                                                                                              | rows the modeler renders into the body     |
| `cd-shell-inspector`                                                                                                                                                                                                       | inspector                                  |
| `cd-shell-no-transition`                                                                                                                                                                                                   | on `<html>` for one frame of a mode switch |

Internal attributes: `data-severity` on pill and status box, `data-danger` on a dangerous menu
entry, `data-menu-id` on entries and radio groups (the shell's Legend entry is `data-menu-id="legend"`,
so a modeler does not use the id `legend`), `data-menu-group` (`model`, `export`, `help`) on entries
and radio groups, which the kit's `readOnly` case reads, `data-menu-value` on radio options,
`data-zoom` on the zoom buttons.

Modelers style only their own content (legend rows, inspector fields); every other class is
internal to the shell CSS and may change in a minor release.

### Geometry

Relative to the shell root's padding box (a border a foreign page gives the root does not count),
±1px (§5.2 to §5.15). `ide` and `embedded` share the IDE column.

| Island      | Box                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `menu`      | 40 × 40 at `top: 12px; left: 12px`                                                                                                                    |
| `palette`   | 40 high at `top: 12px`, horizontally centred; second row `top: 64px`, at most `100cqw − 24px` wide                                                    |
| `zoom`      | 173 × 40 (56px readout) at `right: 12px; bottom: 12px`                                                                                                |
| `problems`  | 40 high at `left: 12px; bottom: 12px` (web `40px`)                                                                                                    |
| `legend`    | `left: 12px`, `bottom: 12px` without pill, `60px` with pill (web `40px`, `88px`); up to 440px width at least `60px`                                   |
| `inspector` | 288 wide at `top: 64px; right: 12px`; up to 760px width a bottom sheet with 12px left, right and bottom                                               |
| `status`    | centred at `top: 64px` (second row `116px`); with an open side inspector centred in the strip left of it; 1px border and 4px bar in the status colour |
| dropdown    | `top: 60px; left: 12px`, at least 248px wide                                                                                                          |
| tooltip     | top row `top: 60px`, second row `top: 112px`, bottom row `bottom: 60px`                                                                               |

Layers (§5.13): the canvas slot is layer 0 with `isolation: isolate` (palette `z-index: 110` above
context pad and label editor at 100); islands `--cd-shell-ebene-inseln` (20), inspector 25, menu
trigger 30, layer 40, modeler dialogs 50. The 50 holds only outside the top layer; a `showModal()`
`<dialog>` or a popover-API element lies above everything (see [Modeler dialogs](#modeler-dialogs)).

Inside the canvas slot, persistent overlays a modeler adds (element toolbars, its own context pad,
the label editor) stay at `z-index` 100 or below, under the palette at 110. Transient popups the user
opens from them (diagram-js's popup menu at 200, a colour picker) may cover the palette while they are
open. All of them stay inside `.djs-container`, so they never cover an island. This is the shell's
reading of §5.13 (product decision, guide update pending in Miragon/corporate-identity).

## `./diagram-js`

```ts
// a Diagram, a renderer's Modeler, a didi injector
interface InjectorLike {
  get<T>(name: string): T;
}
interface ModuleDeclarationLike {
  __init__?: string[];
  __depends__?: ModuleDeclarationLike[];
  [name: string]: unknown;
}
type DiagramEventListener = (event: never) => unknown;
interface EventBusLike {
  on(events: string | string[], priority: number, listener: DiagramEventListener): void;
  on(events: string | string[], listener: DiagramEventListener): void;
  off(events: string | string[], listener?: DiagramEventListener): void;
}
interface DiagramViewbox extends ScaledViewbox {
  inner: Bounds;
  outer: Size;
}
interface CanvasLike {
  getContainer(): HTMLElement;
  getSize(): Size;
  viewbox(): DiagramViewbox;
  viewbox(box: Bounds): void;
  zoom(): number;
  zoom(scale: number, center?: Point): number;
  resized(): void;
}
interface ZoomScrollLike {
  stepZoom(delta: number, position?: Point): void;
}
interface KeyboardLike {
  addListener(priority: number, listener: (context: { keyEvent: KeyboardEvent }) => unknown): void;
}
interface PaletteLike {
  getEntries(): Record<
    string,
    { title?: string; shortcut?: string; ariaKeyShortcuts?: string; group?: string }
  >;
}

const shellModule: ModuleDeclarationLike;

interface ConnectOptions {
  contentBounds(): Bounds | undefined; // tight, no padding: the fit insets are the only margin (§5.9)
  isEmpty?(): boolean; // §13.5 empty file (no element); default: the content bounds are empty
  prefersReducedMotion?(): boolean;
}
interface DiagramJsConnection {
  readonly viewport: Viewport;
  destroy(): void;
}
function connectDiagramJs(
  shell: ShellHandle,
  diagram: InjectorLike,
  options: ConnectOptions,
): DiagramJsConnection;

interface ViewportOptions {
  contentBounds(): Bounds | undefined;
  insets(): Insets;
  prefersReducedMotion?(): boolean;
}
interface Viewport extends ZoomTarget {
  fit(options?: { animate?: boolean }): void;
  freeRectCenter(): Point | undefined; // diagram coordinates; undefined at 0 × 0 and after destroy
  afterImport(): void;
  restore(viewbox: Bounds): void;
  getViewbox(): Bounds | undefined;
  isAutomatic(): boolean;
  getState(): ViewportState | undefined;
  setState(state: ViewportState): void;
  destroy(): void;
}
function createViewport(diagram: InjectorLike, options: ViewportOptions): Viewport;
```

**`shellModule`** goes into the modeler's modules after the renderer's own (`additionalModules`). It
registers one internal didi service named `modelerShell` (a modeler does not reuse the name):

- `paletteTooltip: ["value", null]` replaces diagram-js's (and a renderer's) palette tooltip; the
  chrome tooltip takes over with `title` and `shortcut` from `palette.getEntries()`.
- Palette skin: on `palette.create` it sets `data-chrome="palette"` and moves the container in front
  of the canvas `<svg>` (`canvas.getContainer()`'s child), so tab order puts the palette first. After
  every `palette.changed` it re-applies `role="toolbar"` and `aria-label` (`messages.tools`) on
  `.djs-palette-entries`, `role="button"` on every entry, `aria-keyshortcuts` from the entry's
  `ariaKeyShortcuts` or `ariaKeyShortcutsFromLabel(shortcut)` (§5.6; split the shortcut off the
  title: `title: "Domain event", shortcut: "E"`), roving `tabindex` (the last focused entry keeps the
  tab stop across rebuilds) and `aria-pressed` for the tool of the last
  `tool-manager.update` (group `tools`, `data-action="<tool>-tool"`), styled through
  `[aria-pressed="true"]`: diagram-js's `highlighted-entry` goes stale after a rebuild, and its
  `two-column` class is ignored. `separator` entries become vertical rules.
- Palette keys, without modifiers: ← and → move and wrap, Home and End jump, Enter and Space trigger
  the entry once (repeats ignored). They are stopped at the palette, so a modeler's document listener
  and VS Code never see them; chrome keys still bubble to the shell.
- Enter and Space trigger through a synthetic `click`, and that click is a contract: a `MouseEvent`
  with `detail === 0` (a pointer click has 1 or more), `clientX`/`clientY` at the entry's centre,
  bubbling and cancelable, dispatched on the entry. It goes through diagram-js's click delegate and
  `palette.trigger` like a pointer click, so under the read-only lock it is vetoed the same way. A
  provider tells the keyboard apart by `detail === 0` (see Palette keyboard creation below).
- Read-only (§13.5): only `lasso-tool` and `hand-tool` stay active. Every other entry, also tools of
  group `tools` such as draw, space or connect, is vetoed on `palette.trigger` from the lock on (a
  vetoed `dragstart` is `preventDefault`-ed) and marked `aria-disabled` once the shell shows the
  read-only state; an entry's own `aria-disabled` comes back afterwards. Without an entry element
  in the event only group `tools` passes.
- Keyboard: `keyboard.addListener(2000, …)` returns `true` for every `matchChromeKey` hit, so
  `KeyboardBindings` and the modeler's keyboard modules (priority 1000) never act on them; the
  shell's `keydown` listener executes them exactly once. It returns `false` (stops them without
  `preventDefault`) for a chrome key from a text field inside the `<svg>`, which stays the field's,
  and, while the attached shell's host is `ide`, for undo and redo (`isUndoRedoKey`): the canvas
  `commandStack` never takes them, VS Code undoes the document (§13.5). A modeler's own DOM undo
  binding must go in the IDE host as well; the kit's `keys` case checks it.
- Keys the canvas uses beyond the chrome keys are the modeler's (§13.5). Cmd/Ctrl+A on the focused
  canvas selects every element, or is at least `preventDefault`-ed: diagram-js 15 binds no select
  all, and an unprevented key reaches VS Code, whose Select All then selects the chrome's text. The
  shell stops a prevented key in the IDE host; the kit's `keys` case presses Control+A and Meta+A on
  the canvas.
- While a shell is attached, the canvas `<svg>` is `role="application"` with `aria-label`
  `messages.canvas` (WCAG 4.1.2; screen readers switch to focus mode, so single-key commands reach the
  canvas); a role or name the modeler set stays, and both are restored on detach.
- It buffers the palette until `connectDiagramJs`, so the diagram may exist before the shell.

**`connectDiagramJs`** creates the viewport with `insets: shell.fitInsets`, binds it
(`shell.setZoomTarget`), registers the palette and calls `canvas.resized()` (the canvas element has
moved). After every `import.done` and `elements.changed` it calls `shell.setEmptyHint(isEmpty())`,
so the first element the user creates on the canvas hides the hint (and its "Insert example").
`isEmpty` defaults to empty content bounds; a notation whose bounds are never empty (Wardley's plot)
passes its own. It throws when `shellModule` is missing. A later connection to another shell takes
the palette over; `destroy()` (idempotent, also run on `diagram.destroy`) unregisters the palette,
unbinds the zoom target and the hint sync and destroys the viewport, while the keyboard guard stays
until `diagram.destroy`. `contentBounds` returns the tight bounds of the content, without a padding
of its own (Event Storming: `boardBounds.contentBounds(0)`, not its default of 120px): the shell's fit
insets are the only margin (§5.9), and a padding would add to them.

**`Viewport`** (§5.8, §5.9):

- `stepZoom` is `zoomScroll.stepZoom(±1)` (the wheel's raster, snapping to the nearest step);
  `zoomToActual` is `canvas.zoom(1)`; both around the container centre. No rounding of its own. A
  step past a limit is refused (`canZoomOut`/`canZoomIn`), so zoom out never zooms in, whatever the
  caller checks; without a `zoomScroll` service it steps on the same raster itself.
- `fit()` uses `fitViewbox(contentBounds(), canvas.getSize(), insets())` and `canvas.viewbox(box)`,
  never `canvas.zoom("fit-viewport")`; animated over 250ms in `requestAnimationFrame` with
  `easeStandard` unless `animate: false` or reduced motion (`prefers-reduced-motion`, or
  `REDUCED_MOTION_CLASS` on `<html>`); a `wheel`, `pointerdown` or zoom key cancels the animation. A
  no-op when the bounds are empty.
- `canFit()` reads `contentBounds()` once per content change (`elements.changed`, `shape.added`,
  `shape.removed`, `connection.added`, `connection.removed`, `diagram.clear`, `import.done` and the
  viewport's own `afterImport`, `restore`, `setState`), not on every frame the zoom panel renders.
- `afterImport()` jump-fits the first import whose bounds are non-empty (also after an empty file got
  its first content), unless the user moved the view or a stored view was set with `setState` while
  there was content. `restore` does not block it: a modeler restores on every re-import, and an
  empty file must still fit its first content ("Insert example"). Content the user creates on the
  canvas does (§5.9: an element created on the canvas never fits): an `elements.changed` outside an
  import window after the first import, with content, ends the wait for the first fit, so the next
  external change keeps the view. A renderer that changes elements through the command stack while
  it imports therefore fires `import.parse.start` or `import.render.start` first.
- An empty file shows 100 %, whatever zoom the renderer's import left: on the first import with
  empty bounds, without a stored view (`setState`) and without a user move, `afterImport()` zooms to
  1 around the centre of the free rectangle (at 0 × 0 once the container has a size). That write is
  the viewport's own, not a user move, so the first content still fits; later re-imports and
  `restore`s of the empty file keep the view. Product decision, guide update pending in
  Miragon/corporate-identity (§5.9, §13.5).
- `freeRectCenter()` is the centre of the free rectangle (the container minus `insets()`, as fit
  uses them) in diagram coordinates, for the current viewbox; `undefined` while the container is
  0 × 0 and after `destroy`. It is where keyboard creation places an element.
- A `ResizeObserver` on `canvas.getContainer()`, coalesced per frame, skips 0 × 0 (hidden tab) and
  compares with the size the view was last set for, so a tab coming back at the same size neither
  refits nor calls `resized()`. On a real change it calls `canvas.resized()` and refits while the view
  is automatic. A `restore` or `setState` made at 0 × 0 waits for a size and is not refitted then.
- User moves: every `canvas.viewbox.changed` (and `canvas.viewbox.changing` for the readout under
  `deferUpdate`) is compared with the last view the viewport set (`sameView`; during an animation
  also with the last written frame); a difference is a user move. Changes between
  `import.parse.start`/`import.render.start` and `import.done` are not (renderers set the viewbox
  while importing); that window also ends on `afterImport`, `restore`, `setState` and user input.
  Fit makes the view automatic again; `restore` updates the reference without resetting it.
- `getViewbox()` takes width and height from the fresh container size; `getState()` is `undefined`
  before the first `afterImport`, `restore` or `setState`. `onChange` fires on
  `canvas.viewbox.changing`/`.changed`, `elements.changed` (so Fit enables with the first element),
  `import.done` and the viewport's own calls.
- The viewport destroys itself on `diagram.destroy`; afterwards `zoom()` returns the last zoom,
  `canFit()` false and `getViewbox()`/`getState()` `undefined`, so a shell still bound to it never
  calls into a destroyed canvas.
- diagram-js events used: `canvas.init`, `palette.create`, `palette.changed`, `tool-manager.update`,
  `palette.trigger`, `keyboard.keydown` (through `keyboard.addListener`), `canvas.viewbox.changing`,
  `canvas.viewbox.changed`, `elements.changed`, `shape.added`, `shape.removed`, `connection.added`,
  `connection.removed`, `diagram.clear`, `import.parse.start`, `import.render.start`, `import.done`,
  `diagram.destroy`. The shell fires no events of its own.

**Palette keyboard creation** (§5.5). Enter or Space on an entry that creates something places the
element in the centre of the free rectangle, selects it, opens the label editor where the notation
has labels and puts the focus on the canvas; tool entries only switch the tool. diagram-js's create
tool follows the pointer and never ends without one, so the provider branches on the synthetic click
and asks the viewport for the point. The provider exists before `connectDiagramJs`, so it gets a
function and reads the viewport only when the entry fires:

```ts
// the renderer's palette provider, given freeRectCenter: () => viewport.freeRectCenter()
const create = (event: Event) => {
  const shape = elementFactory.createShape({ type: "domain-event" });
  const keyboard = event.type === "click" && (event as MouseEvent).detail === 0;
  const center = keyboard ? freeRectCenter() : undefined;
  if (!center) return createTool.start(event, shape); // a pointer: the shape follows it
  const created = modeling.createShape(shape, center, canvas.getRootElement());
  selection.select(created);
  canvas.focus();
  directEditing.activate(created); // where the notation has labels
};
entries["create.domain-event"] = {
  group: "events",
  title: "Domain event",
  shortcut: "E",
  action: { click: create, dragstart: create },
};
```

When the centre is already taken, the provider steps 24px diagonally until it is free (§5.5); a
shared helper for that is a 0.2 candidate. The kit's `create` case presses Enter on the first
creating entry and expects exactly one new, selected shape inside the free rectangle.

## `./vscode/extension`

```ts
interface DisposableLike {
  dispose(): unknown;
}
interface ColorThemeLike {
  readonly kind: number;
}
interface VsCodeLike {
  readonly window: {
    readonly activeColorTheme: ColorThemeLike;
    onDidChangeActiveColorTheme(listener: (theme: ColorThemeLike) => unknown): DisposableLike;
  };
  readonly workspace: {
    getConfiguration(section?: string): { get<T>(key: string): T | undefined };
    onDidChangeConfiguration(
      listener: (event: { affectsConfiguration(section: string): boolean }) => unknown,
    ): DisposableLike;
  };
}
interface WebviewPanelLike {
  readonly webview: { postMessage(message: unknown): unknown };
  readonly visible: boolean;
  onDidChangeViewState(
    listener: (event: { readonly webviewPanel: { readonly visible: boolean } }) => unknown,
  ): DisposableLike;
  onDidDispose(listener: () => unknown): DisposableLike;
}

interface WebviewHtmlOptions {
  cspSource: string;
  scriptUri: string;
  styleUris?: readonly string[];
  title: string;
  lang: string;
  appearance: Appearance;
  body?: string;
  nonce?: string;
  inlineStyles?: boolean; // default true: style-src … 'unsafe-inline'
}
function createNonce(): string;
function renderWebviewHtml(options: WebviewHtmlOptions): string;

interface ThemeBridgeOptions {
  themes: readonly Theme[];
  settingKey?: string;
}
function currentAppearance(vscode: VsCodeLike, options: ThemeBridgeOptions): Appearance;
function connectThemeBridge(
  vscode: VsCodeLike,
  panel: WebviewPanelLike,
  options: ThemeBridgeOptions,
): DisposableLike;

function revealFileLabel(platform: string): string;

const APPEARANCE_MESSAGE_TYPE = "modelerShell.appearance";
interface AppearanceMessage {
  type: typeof APPEARANCE_MESSAGE_TYPE;
  appearance: Appearance;
}
function appearanceMessage(appearance: Appearance): AppearanceMessage;
function isAppearanceMessage(value: unknown): value is AppearanceMessage;
```

- The real `vscode` namespace is assignable to `VsCodeLike` and a `WebviewPanel` to
  `WebviewPanelLike` (pinned by a type test against `@types/vscode` 1.96).
- The entry needs a global `crypto` (Node 20 or later, so VS Code 1.90 or later; the types are tested
  against 1.96). A modeler declares `engines.vscode` accordingly and targets `node20` in its
  extension-host bundle. There is no `node:crypto` fallback: the entry imports nothing, so a web
  extension host (vscode.dev) can bundle it as well, and `createNonce` stays synchronous.
- `createNonce()`: 32 characters `[A-Za-z0-9]` from `crypto.getRandomValues`, unbiased.
- `renderWebviewHtml` writes the appearance attributes on `<html>` before the first paint, always
  (also `light`), and the CSP (`default-src 'none'`, the nonce'd script, fonts from `cspSource` and
  `data:`). Its `style-src` allows `'unsafe-inline'` by default because renderers write
  `style` attributes into markup (palette entries, SVG strings); the shell and diagram-js themselves
  style only through the CSSOM and run without it, so a modeler whose renderer does too passes
  `inlineStyles: false`. `lang` is the tool's UI language: English modelers pass `"en"`, not
  `vscode.env.language`. Title and attribute values are escaped, `body` is inserted as markup; the
  script is a classic `<script nonce src>` (an IIFE bundle). It throws for a `nonce` that is not a
  CSP base64 value.

  ```text
  <html lang="en" class="cd-shell-document" data-cd-theme="light" data-cd-kontrast="hoch">
  Content-Security-Policy: default-src 'none'; img-src {cspSource} data: blob:;
    style-src {cspSource} 'unsafe-inline'; font-src {cspSource} data:; script-src 'nonce-{nonce}'
  ```

- `currentAppearance` resolves `requestedAppearance(kind, setting)` against `themes`; a setting value
  outside `automatic | light | dark` counts as `automatic`.
- `connectThemeBridge` posts nothing on connect (the HTML carries the appearance) and then
  `appearanceMessage(currentAppearance(…))` on `onDidChangeActiveColorTheme`, on
  `onDidChangeConfiguration` affecting `settingKey` (no configuration listener without one), and on
  `onDidChangeViewState` when the panel goes from hidden to visible (not on active or column
  changes). It disposes itself with the panel (`onDidDispose`) and throws for empty `themes`. The
  returned disposable only ends it earlier (twice is safe), or goes into a panel-scoped list that is
  disposed with the panel; never into `context.subscriptions`, which keeps one dead bridge per
  opened editor until the extension deactivates.
- `revealFileLabel(process.platform)`: "Reveal in Finder" (`darwin`), "Reveal in File Explorer"
  (`win32`), "Open Containing Folder" (other), for the export notification (§13.5); English, the
  labels of VS Code itself (a localized modeler translates them with `vscode.l10n`).

What the webview bundle needs under this CSP:

- **Fonts as files.** Bundle Geist and Geist Mono as files next to the bundle, not as data URLs:
  esbuild `loader: { ".woff2": "file", ".woff": "file" }` with `assetNames: "fonts/[name]-[hash]"`.
  The browser then fetches only the subsets a page's `unicode-range` needs (Geist Mono alone brings
  six, which inlined roughly double the webview CSS), `font-src {cspSource}` allows them, and `dist`
  must be in the panel's `localResourceRoots`. `data:` stays allowed for renderers that inline
  fonts.
- **zod 4 without eval.** `script-src` admits only the nonce'd script, so eval and `new Function` are
  blocked (correctly, there is no `'unsafe-eval'`). zod 4 probes for eval while it builds object
  schemas and catches the error, but the browser still reports every probe as a
  `securitypolicyviolation`. A webview that bundles zod 4 runs `z.config({ jitless: true })` in a
  module it imports before any schema module (Event Storming: `import "./zod-jitless"`, the first
  line of `main.ts`).
- **A smoke test of the production bundle.** A test page served by Vite runs the webview from source
  without a CSP, so a loader or CSP mistake of the shipped bundle shows only behind the real HTML.
  Build the bundle as shipped, serve it under a fake origin behind `renderWebviewHtml`, and fail on
  any CSP violation, page error or missing font:

  ```ts
  const ORIGIN = "https://webview.test";
  const NONCE = "c21va2V0ZXN0bm9uY2Uw"; // fixed, so the stub's script can carry it
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      const html = renderWebviewHtml({
        cspSource: ORIGIN,
        nonce: NONCE,
        scriptUri: `${ORIGIN}/webview.js`,
        styleUris: [`${ORIGIN}/webview.css`],
        title: "Event Storming Board",
        lang: "en",
        appearance: { theme: "light" },
        // runs before the webview: installs the VS Code stub and records every violation
        body: `<div id="app"></div><script nonce="${NONCE}" src="${ORIGIN}/stub.js"></script>`,
      });
      return route.fulfill({ contentType: "text/html", body: html });
    }
    if (pathname === "/stub.js") return route.fulfill({ contentType: "text/javascript", body: stubIife });
    return route.fulfill({ path: join(dist, pathname) }); // webview.js, webview.css, fonts/
  });
  await page.goto(`${ORIGIN}/`);
  // post the document's init message, wait for the first shape and open the menu, then:
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  ```

  `stubIife` is the esbuild IIFE bundle of a small entry that adds a `securitypolicyviolation`
  listener on `document` (pushing `violatedDirective` and `blockedURI` into `window.cspViolations`)
  and then calls `installVsCodeWebviewStub(…)`.

## `./vscode/webview`

```ts
function applyAppearance(appearance: Appearance, element?: HTMLElement): void; // default <html>
interface AppearanceListenerOptions {
  themes: readonly Theme[];
}
function connectAppearance(options: AppearanceListenerOptions): () => void;
function connectReducedMotion(): () => void;

interface VsCodeShellOptions
  extends Omit<ShellOptions, "host" | "keyScope" | "themes">, AppearanceListenerOptions {}
function mountVsCodeShell(root: HTMLElement, options: VsCodeShellOptions): ShellHandle;

interface WebviewStateApi {
  getState(): unknown;
  setState(state: unknown): void;
}
interface ShellWebviewState {
  legendOpen?: boolean;
  view?: ViewportState;
}
const SHELL_STATE_KEY = "modelerShell";
function readShellState(api: WebviewStateApi): ShellWebviewState;
function writeShellState(api: WebviewStateApi, patch: ShellWebviewState): void;
interface PersistableView {
  onChange(listener: () => void): () => void;
  getState(): ViewportState | undefined;
}
interface PersistViewOptions {
  delayMs?: number; // default 250
}
function persistView(
  api: WebviewStateApi,
  viewport: PersistableView,
  options?: PersistViewOptions,
): () => void;

// re-exported from the shared protocol, as in ./vscode/extension:
// APPEARANCE_MESSAGE_TYPE, AppearanceMessage, appearanceMessage, isAppearanceMessage
```

- `applyAppearance` sets `data-cd-theme` and `data-cd-kontrast` in one task, with
  `cd-shell-no-transition` on `<html>` until a nested `requestAnimationFrame` (no colour fades; after
  several quick switches only the last one lifts it).
- `connectAppearance` applies every `AppearanceMessage` arriving on `window`, resolved against its own
  `themes` once more (what this bundle can show wins over what the extension passed); a message that
  changes nothing leaves `<html>` alone. A page whose `<html>` has no `data-cd-theme` at connect (no
  `renderWebviewHtml`) falls back to the body classes until the first message: a `MutationObserver`
  applies `resolveAppearance(appearanceFromBodyClasses(…), themes)`, at once and on every change.
  With the attributes of `renderWebviewHtml` there is no fallback: the bridge knows the `colorTheme`
  setting, the body classes do not, and VS Code changes them before the bridge's message arrives from
  the extension host, which would flash the mode without the setting. The body classes are never
  used for styling. Throws for empty `themes`.
- `connectReducedMotion` mirrors the body class `vscode-reduce-motion` (VS Code's
  `workbench.reduceMotion`, kept up to date by VS Code) as `REDUCED_MOTION_CLASS` on `<html>` for the
  whole session; its disconnect removes the class.
- `mountVsCodeShell` is `mountShell` with `host: "ide"` and `keyScope: "document"` (both always win)
  plus `connectAppearance(options)` and `connectReducedMotion()`, connected first, so empty `themes`
  throw before anything mounts (and disconnected again if `mountShell` throws). It returns a handle
  that passes every member through and whose `destroy()` disconnects both too. This wires the IDE
  key interception: handled keys are stopped on `document`, before VS Code's listener on `window`
  forwards them to the workbench.
- `readShellState`/`writeShellState` keep the shell's part (legend state, view) under
  `SHELL_STATE_KEY` of `vscode.getState()`. `readShellState` returns `{}` for a missing or malformed
  part and only valid fields (a view with finite `x`/`y`, positive width and height and a boolean
  `userMoved`), as copies. `writeShellState` merges: every other top-level key and unknown keys in its
  own part stay, an `undefined` or malformed value leaves the stored one alone (so
  `{ view: viewport.getState() }` before the first import erases nothing), and nothing is written
  when nothing changed. The modeler owns `acquireVsCodeApi()` (callable once) and passes its API
  object.
- `persistView(api, viewport)` writes `{ view: viewport.getState() }` once the view has rested for
  `delayMs` (trailing), instead of one `vscode.setState` IPC message per frame of a pan, a wheel zoom
  or a fit animation; the returned stop function writes a pending change at once. The legend state
  is written from `legend.onToggle` (see the usage below).
- The custom editor is registered with `webviewOptions: { retainContextWhenHidden: true }`: a hidden
  tab keeps document, view and selection, reports a 0 × 0 container and neither fits nor measures.

## `./testing`

```ts
// Playwright's Page satisfies it
interface PageLike {
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
}

interface OpenContext {
  size: Size; // the shell container's size (grow the page by any frame around an embedded root)
  requested: Appearance; // what the host requests; the harness opens the page with it (embedded: see below)
}
interface ShowHooks<P extends PageLike = PageLike> {
  problems?(page: P): Promise<void>;
  status?(page: P): Promise<void>;
  legend?(page: P): Promise<void>;
  inspector?(page: P): Promise<void>;
  invalid?(page: P): Promise<void>; // the invalid-file state, caused the way the host causes it
}
type ShowHook = keyof ShowHooks; // "problems" | "status" | "legend" | "inspector" | "invalid"
interface ShellConformanceHarness<P extends PageLike = PageLike> {
  host: ShellHost;
  themes: readonly Theme[];
  open(page: P, context: OpenContext): Promise<void>;
  destroy?(page: P): Promise<void>;
  root?: string; // default ".cd-shell"
  show?: ShowHooks<P>;
  absent?: readonly ShowHook[]; // islands and states the modeler does not have
  sizes?: readonly Size[]; // default 1280 × 900, 720 × 700, 420 × 700
}
interface ShellSkip {
  hook: ShowHook | "destroy" | "open"; // the harness field that would feed the skipped part
  reason: string;
}
interface ShellCaseOutcome {
  skipped?: readonly ShellSkip[];
}
interface ShellConformanceCase {
  name: string;
  run<P extends PageLike>(page: P, harness: ShellConformanceHarness<P>): Promise<ShellCaseOutcome | void>;
}
function shellConformanceCases(): ShellConformanceCase[];
type ShellConformanceTest<P extends PageLike = PageLike> = (
  name: string,
  body: (fixtures: { page: P }) => Promise<void>,
) => unknown;
interface RegisterShellConformanceOptions {
  onSkip?(caseName: string, skips: readonly ShellSkip[]): void; // default: console.warn, joined by "; "
}
function registerShellConformance<P extends PageLike>(
  harness: ShellConformanceHarness<P>,
  test: ShellConformanceTest<P>,
  options?: RegisterShellConformanceOptions,
): void;
// "theme=dark&kontrast=hoch[&colorTheme=…][&reduceMotion]" for a page with the VS Code stub
function vsCodeStubSearch(
  requested: Appearance,
  extra?: { colorTheme?: ColorThemeSetting; reduceMotion?: boolean },
): string;

const GEOMETRY_TOLERANCE_PX = 1;
interface IslandBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface ChromeMeasurement {
  container: Size;
  paletteRow: PaletteRow;
  islands: Partial<Record<ChromeIsland, IslandBox>>;
  open: { legend: boolean; inspector: boolean; problems: boolean };
}
interface ExpectedBox {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  centerX?: number;
}
function measureChrome(page: PageLike, root?: string): Promise<ChromeMeasurement>;
function expectedChromeBoxes(
  measurement: ChromeMeasurement,
  host: ShellHost,
): Partial<Record<ChromeIsland, ExpectedBox>>;
```

`IslandBox` and `ExpectedBox` are relative to the root's padding box (`getBoundingClientRect()` minus
the root's box and border), where the islands anchor.

Cases (each named `shell conformance: <name>`; failures throw plain `Error`s listing every problem):

| Case         | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry`   | per size, as opened and after each show hook in turn (legend, problems, status, inspector): every visible `data-chrome` island against the geometry table, ±1px; the palette row decision (second row up to 760px, 16px clearance); the guide's limits (legend ≥ 184px, status ≤ `min(560px, 100cqw − 24px)`, side inspector ≥ 64px above the bottom, sheet ≤ 45 %, second-row palette ≤ `100cqw − 24px`); root state attributes against what is visible; zoom, pill and legend hidden under a bottom sheet; the dropdown at 60/12 and 248 to `min(320px, 100cqw − 24px)` wide; tooltips on the menu trigger, a palette entry and zoom in at 60, 112 and bottom 60, centred and 12px from the sides; an `absent` island is never visible                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `aria`       | trigger `aria-haspopup`/`-expanded`/`-controls` → `role="menu"`; the menu keyboard (Enter and ↓ open on the first entry, ↑ on the last, wrap, Home/End, Escape returns focus), whose keys never reach a `keydown` listener on `document`; named items, `aria-checked`, labelled radio groups, dialog entries ending in "…"; palette `role="toolbar"` with roving tabindex driven by ←/→/Home/End, `aria-pressed` on tools and `aria-keyshortcuts` on every entry whose tooltip shows a shortcut (each entry focused by keyboard); Tab from the menu trigger lands on the palette's one stop, then on the canvas `<svg>`, nothing in between; the canvas `<svg>` has an accessible name; zoom `role="group"`, readout `aria-label` with the shown percentage, `aria-keyshortcuts` for the page's platform, `aria-disabled` (never native `disabled`) at 400 % and 20 % reached by clicking; roles of pill, status, legend and inspector (an `absent` one is never visible); DOM order; no positive `tabindex`; no native `title`; `lang` on `<html>` or on an embedded root                                                                                                                          |
| `keys`       | on the canvas, each chrome key changes the zoom exactly once (Ctrl, Meta, Shift and numpad variants 100 % → 135 % → 100 %, 0 and Numpad0 to 100 %, Shift+1 fits at most 100 %); unmodified `+`/`-` and Alt combinations do nothing; Escape without menu or dialog passes untouched; input, textarea and editable-label stand-ins block the zoom keys and keep undo/redo (stopped, not prevented), modal and popover stand-ins block, Escape with the open menu closes it; Control+A and Meta+A on the focused canvas are handled by the canvas (select all, or at least prevented). `ide`: a `keydown` listener on `window` never sees a handled or blocked key (select all included) while F1 still arrives, a `document` listener registered after the shell's sees handled keys prevented and blocked ones (Cmd/Ctrl+Z in a text field) not, and Cmd/Ctrl+Z, Shift+Z and Ctrl+Y on the canvas reach `window` once and unprevented (the document's history undoes, §13.5); other hosts: every key reaches `window`, the handled ones prevented                                                                                                                                                    |
| `create`     | §5.5: the palette focused by keyboard and walked with →/Home to the first entry that is not a tool (outside group `tools`, `data-action` not ending in `-tool`), then Enter: exactly one new `.djs-shape[data-element-id]`, selected, its centre inside the free rectangle (the container minus the fit insets recomputed from the measured chrome), the focus on the canvas (its `<svg>` or a label-editor field); Escape afterwards. A notation without a creating entry passes with nothing to verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `readOnly`   | §13.5, after `show.invalid` and `INVALID_STATUS_DELAY_MS`: `data-readonly` on the root, the status box visible with `role="alert"`; every palette entry but `lasso-tool` and `hand-tool` `aria-disabled`, those two not, and the disabled tool entries and their icons in `--cd-ui-text-leise`; Enter on a creating entry adds no shape; the shell's Legend checkbox and every Export and Help entry that was enabled before stay enabled; on a shape a pointer reaches: no `.djs-context-pad` entry after a click, a 40px drag changes neither its position nor its size, a double-click opens no text field inside `.djs-container`, Delete and Backspace on the canvas keep it. Skips with `hook: "invalid"` without the hook (unless `absent` lists it) and with `hook: "open"` when the opened document shows no such shape                                                                                                                                                                                                                                                                                                                                                                    |
| `appearance` | the harness opens with dark, dark + high contrast and light + high contrast requested. Own document: the mode on `<html>` is `resolveAppearance(requested, themes)`, recomputed by the kit (a light-only modeler stays light, `hoch` passes). Embedded: the kit puts the foreign page's `<html>` in the requested mode, and the root carries its own `data-cd-theme="<themes[0]>"` with the page's `data-cd-kontrast` (§13.3). Both: no themed descendant; `cd-shell-document` on `<html>` in `ide`/`web`, never in a foreign page; tokens loaded; `color-scheme` and four `--cd-ui-*` roles equal on root, canvas, every island, the open dropdown and the visible tooltip; the painted surround, the first non-transparent `background-color` from `.djs-container` out through `.cd-shell-canvas` to the root, equals `--cd-ui-grund` (§10.1); every palette tool entry (group `tools` or `data-action` ending in `-tool`) and its icon (`<svg>` or `::before`) compute to `--cd-ui-text` at rest and pressed and to `--cd-ui-interaktion` hovered, each tool hovered in turn and Lasso armed by a click, which sets `aria-pressed="true"`; notation previews are exempt (§5.5). Never half-dark |
| `cleanup`    | with a tooltip timer pending: after `destroy` and 800ms, a resize and chrome keys that must arrive unprevented, no `cd-shell*` class or element, no `data-chrome`, no root state attribute (embedded: also no `data-cd-theme`/`data-cd-kontrast`) and no page error is left; skips with `hook: "destroy"` without a `destroy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

- **Skips.** A case the harness cannot feed reports what it skipped as `ShellSkip`s, one per missing
  harness field, through `onSkip` (default `console.warn`). A hook that is neither in `show` nor in
  `absent` is skipped with `hook` set to its name, a missing `destroy` with `hook: "destroy"`, and a
  document that lacks what a case needs (a shape a pointer reaches, for `readOnly`) with
  `hook: "open"`. `absent` lists what the modeler does not have (an island or the `invalid` state),
  which is then never reported, while `geometry` and `aria` assert that the island never shows. Listing a hook in both `show` and `absent` fails every case that uses
  it. A suite that lists what it lacks can fail on every remaining skip:
  `onSkip(name, skips) { throw new Error(…) }`.
- **`show.invalid`** makes the file invalid the way the host does (in a webview: a document update
  the parser rejects), not by calling `shell.setReadOnly` alone: the `readOnly` case also checks the
  modeler's own canvas lock, which its invalid-import path sets. The case waits
  `INVALID_STATUS_DELAY_MS` and a margin itself.
- For the `embedded` host the kit writes `data-cd-theme` and `data-cd-kontrast` on the page's
  `<html>` itself after `open`: every consumer suite then proves that the modeler stays in its own
  mode inside a dark host page, the case a foreign page meets in practice (designIQ, a web app on
  `system` under a dark OS).
- The second-row tooltip of the `geometry` case may stand centred on its entry or in the container:
  guide §5.15 says "mittig im Container", and which of the two it means is an open question; the
  shell centres it on its entry.
- The kit never imports Playwright; a modeler's suite passes its `page` and `test`
  (`registerShellConformance(harness, test)` from `@playwright/test`). It installs one page global,
  `__modelerShellConformance`, with `keydown` recorders on `window` and `document`, and briefly
  injects stand-ins marked `data-modeler-shell-conformance` (an input, a textarea, an editable label,
  a modal dialog, a popover, a focus target) into the shell root.
- `geometry` takes about 10s per host; wrap the registration in
  `test.describe.configure({ timeout: 60_000 })`.
- `registerShellConformance` calls `test` inside the kit, so a runner reports every case at the
  kit's source (the package ships `src/`, so that location resolves). For locations in the suite's
  own spec file, register the cases there:

  ```ts
  for (const conformanceCase of shellConformanceCases()) {
    test(`shell conformance: ${conformanceCase.name}`, async ({ page }) => {
      const outcome = await conformanceCase.run(page, harness);
      if (outcome?.skipped?.length) onSkip(conformanceCase.name, outcome.skipped);
    });
  }
  ```

### `./testing/vscode-stub` — the `ide` host without VS Code

```ts
type ColorThemeKind = 1 | 2 | 3 | 4;
function colorThemeKindOf(appearance: Appearance): ColorThemeKind;
const STUB_SETTING_KEY = "miragon.modeler.colorTheme";
interface VsCodeWebviewStubOptions {
  requested: Appearance; // VS Code's color theme
  themes: readonly Theme[]; // what the modeler's extension passes to the bridge
  lang?: string; // default "en"
  colorTheme?: ColorThemeSetting;
  settingKey?: string; // default STUB_SETTING_KEY
  reduceMotion?: boolean; // workbench.reduceMotion
  state?: unknown; // what acquireVsCodeApi().getState() returns at first
}
interface StubbedVsCodeApi {
  getState(): unknown;
  setState(state: unknown): void;
  postMessage(message: unknown): void;
}
interface VsCodeWebviewStub {
  readonly kind: ColorThemeKind;
  setColorThemeKind(kind: ColorThemeKind): void; // body classes first, then the bridge posts
  setColorTheme(setting: ColorThemeSetting | undefined): void;
  setReduceMotion(reduceMotion: boolean): void;
  pendingMessages(): number; // posted by the bridge, not yet delivered
  readonly posted: readonly unknown[]; // what the webview posted
  state(): unknown;
}
type StubWindow = Window & {
  __modelerShellVsCodeStub?: VsCodeWebviewStub;
  acquireVsCodeApi?: () => StubbedVsCodeApi;
};
function stubOptionsFromSearch(
  search: string,
): Pick<VsCodeWebviewStubOptions, "requested" | "colorTheme" | "reduceMotion">;
function installVsCodeWebviewStub(options: VsCodeWebviewStubOptions): VsCodeWebviewStub;
```

Runs in a test page, before the modeler's webview code: VS Code's default webview stylesheet in
`@layer vscode-default` (with foreign values, so a leak shows), `<html>` with the attributes
`renderWebviewHtml` writes, `<body>` with the host page's theme and reduce-motion classes,
`acquireVsCodeApi()` (once, as in VS Code) and the real `connectThemeBridge` against a fake `vscode`
namespace whose panel posts to the window. The stub is also `window.__modelerShellVsCodeStub`, so a
Playwright suite switches the color theme or the setting at runtime.

A modeler's e2e suite serves `e2e/webview/` as the root of a Vite server, with the test page
`e2e/webview/webview-test.html` (`<div id="app">` and `<script type="module" src="./webview-test.ts">`)
and this entry:

```ts
// e2e/webview/webview-test.ts
import { installVsCodeWebviewStub, stubOptionsFromSearch } from "@miragon/modeler-shell/testing/vscode-stub";

// before the webview runs, which calls acquireVsCodeApi() and mounts the shell
installVsCodeWebviewStub({ ...stubOptionsFromSearch(location.search), themes: ["light"] });
const { webview } = await import("../../src/webview/main"); // exports { shell, modeler, connection, ready }

// for the harness only: the shipped bundle publishes nothing on window
window.shell = webview.shell;
window.modeler = webview.modeler;
window.connection = webview.connection;
void webview.ready.then(() => (window.webviewReady = true)); // the first import settled

// there is no extension host: post the document the way the extension would
window.postMessage({ type: "init", text: EXAMPLE_BOARD }, "*");
```

The harness opens it with ``page.goto(`/webview-test.html?${vsCodeStubSearch(requested)}`)`` and waits
for `window.webviewReady`. `ready`, `webviewReady` and the window globals are the modeler's, not the
shell's: its webview module exports `ready`, resolved once the first `init` import settled, and the
test page turns it into the flag (the Event Storming `main.ts` below exports it).

## `./shell.css`

One stylesheet for everything above, loaded last. Containment: `.cd-shell { container: cd-shell /
size }`; breakpoints are `@container cd-shell (max-width: 760px)`, `(max-width: 440px)` with literal
values (custom properties are not allowed in container conditions), sizes inside are `cqw`/`cqh`,
never viewport units, and no element inside gets a `container-type` of its own. It covers glass
islands (`color-mix(in srgb, var(--cd-ui-flaeche-hoch) var(--cd-ui-chrome-deckkraft), transparent)`
with `backdrop-filter: blur(8px)`), opaque popups, focus rings (inset in dense containers),
`[data-cd-kontrast="hoch"]` (no shadows, 3px focus), `@media (forced-colors: active)` (rings in
`Highlight`, status bar and island borders in `CanvasText`), `prefers-reduced-motion` and
`html.cd-shell-reduce-motion`, `html.cd-shell-no-transition` (no transitions for the frame of a mode
switch), the canvas `<svg>`'s focus ring (2px, 3px in high contrast, inside the slot), and under
`html.cd-shell-document` the own-document reset: no body padding, `--cd-ui-grund` background, Geist
13px/1.5, own `kbd`, `code`, links, focus and scrollbars, never `var(--vscode-*)`. The reset is
unlayered, so it wins over VS Code's `@layer vscode-default`; its button and field font reset has
zero specificity, so the chrome's own rules (the readout's 13px/600) win over it. In a foreign page
the chrome's own islands, controls and texts reset font, colour, letter spacing and text transform
at class specificity, so the page's element rules (`button { text-transform: uppercase }`,
`p { font-size: 18px }`) do not reach them. The canvas slot's layout (`.cd-shell >
.cd-shell-canvas`: absolute, `inset: 0`, layer 0, `isolation: isolate`) wins over a renderer's own
container class, its paint (`background-color: var(--cd-ui-grund)`) has zero specificity, so a
renderer's paper (Event Storming's dot grid) shows. The paper's colour stays `--cd-ui-grund` in
every mode, the dot grid being a background image in `--cd-ui-linie` (§10.1); the kit's `appearance`
case checks the painted colour. Palette tool entries set their colour in every
state (rest and pressed `--cd-ui-text`, hovered `--cd-ui-interaktion`, read-only
`--cd-ui-text-leise`), and their icons (`> svg`, `::before`) inherit it, so a renderer's or
diagram-js's rule on the icon or on the stale `highlighted-entry` does not leak in; notation
previews keep their own colours (§5.5). Private helper properties are named `--modeler-shell-*`.

The shell bundles no font: the modeler loads Geist and Geist Mono (`@fontsource-variable/geist`,
`@fontsource-variable/geist-mono`), as the stylesheet order above shows, as font files (see
`./vscode/extension`).

## Usage: Event Storming in VS Code

The Event Storming extension, the pilot of 0.1. Extension host
(`EventStormingEditorProvider.resolveCustomTextEditor`):

```ts
import * as vscode from "vscode";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
  revealFileLabel,
} from "@miragon/modeler-shell/vscode/extension";

const THEMES = ["light"] as const; // until the shared dark-mode release of all modelers

// activate(): a hidden tab keeps document, view and selection (and reports 0 × 0 meanwhile)
vscode.window.registerCustomEditorProvider(viewType, provider, {
  webviewOptions: { retainContextWhenHidden: true },
});

// resolveCustomTextEditor():
const dist = vscode.Uri.joinPath(extensionUri, "dist");
webview.options = { enableScripts: true, localResourceRoots: [dist] }; // webview.js, webview.css, fonts/
const asset = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(dist, file)).toString();
webview.html = renderWebviewHtml({
  cspSource: webview.cspSource,
  scriptUri: asset("webview.js"),
  styleUris: [asset("webview.css")],
  title: "Event Storming Board",
  lang: "en",
  appearance: currentAppearance(vscode, { themes: THEMES }),
});
connectThemeBridge(vscode, webviewPanel, { themes: THEMES }); // disposes itself with the panel

// after an export (exportImage.ts):
const reveal = revealFileLabel(process.platform);
if ((await vscode.window.showInformationMessage(`Exported ${name}.`, reveal)) === reveal) {
  void vscode.commands.executeCommand("revealFileInOS", target);
}
```

The two bundles (`esbuild.config.mjs`):

```js
const host = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20", // VS Code 1.90 or later: the global crypto of createNonce
  external: ["vscode"],
};
const web = {
  entryPoints: ["src/webview/main.ts"],
  outfile: "dist/webview.js", // and dist/webview.css
  bundle: true,
  platform: "browser",
  format: "iife", // renderWebviewHtml writes a classic <script nonce>
  loader: { ".woff2": "file", ".woff": "file" }, // font files: a page loads only the subsets it needs
  assetNames: "fonts/[name]-[hash]",
};
```

Webview (`src/webview/main.ts`):

```ts
import "./zod-jitless"; // first: z.config({ jitless: true }) before any schema module (CSP)
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
// the renderer's stylesheet brings diagram-js.css and the tokens, so they are not imported again
import {
  createCollaborativeModeler,
  type BoardBounds,
  type EventStormingReadOnly,
  type EventStormingViewOptions,
} from "@miragon/event-storming-renderer";
import "./style.css"; // the modeler's own content: the "Keyboard shortcuts…" dialog
import "@miragon/modeler-shell/shell.css";
import { INVALID_STATUS_DELAY_MS } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";
import { mountVsCodeShell, persistView, readShellState } from "@miragon/modeler-shell/vscode/webview";
import { createShortcutsDialog } from "./shortcutsDialog";

const vscode = acquireVsCodeApi();
const stored = readShellState(vscode);

// 1. The diagram first: Event Storming's keyboard listens on document and must run before the
//    shell's, and the renderer builds its diagram lazily, so get() a service. width/height: the
//    shell's slot sizes it.
const collaborative = createCollaborativeModeler({
  additionalModules: [shellModule],
  // VS Code's document history owns Cmd/Ctrl+Z (§13.5); the kit's keys case checks it
  undoRedoKeys: false,
  // where Enter or Space on a creating palette entry places the element (§5.5): the renderer takes
  // the fit insets and computes the centre of the free rectangle itself, the same point as
  // viewport.freeRectCenter(); a renderer may take that function instead
  freeRectInsets: () => shell.fitInsets(),
});
const modeler = collaborative.diagram;
modeler.get("canvas");
const viewOptions = modeler.get<EventStormingViewOptions>("eventStormingViewOptions");
const levels = modeler.get<{ getLevel(): string; setLevel(level: string): void }>("eventStormingModeling");
// the canvas lock of an invalid file: context pad, move, resize, delete, paste, label editor
const canvasLock = modeler.get<EventStormingReadOnly>("eventStormingReadOnly");
const boardBounds = modeler.get<BoardBounds>("boardBounds");

// 2. The chrome around it.
const shell = mountVsCodeShell(document.getElementById("app")!, {
  themes: ["light"],
  canvas: modeler.container,
  messages: { canvas: "Event Storming board" },
  menu: {
    model: [
      {
        kind: "radio",
        id: "level",
        label: "Level",
        options: [
          { value: "big-picture", label: "Big picture" },
          { value: "process", label: "Process modeling" },
          { value: "design", label: "Software design" },
        ],
        value: () => levels.getLevel(),
        onSelect: (level) => levels.setLevel(level),
      },
      {
        kind: "checkbox",
        id: "type-captions",
        label: "Type captions",
        keepEnabledWhenReadOnly: true, // a view toggle, not board content: usable while read-only
        checked: () => viewOptions.typeCaptionsVisible(),
        onToggle: (visible) => viewOptions.setTypeCaptionsVisible(visible),
      },
    ],
    export: [
      {
        kind: "action",
        id: "export-png",
        label: "Export as PNG",
        icon: "file-image",
        onSelect: () => void exportPng(),
      },
      {
        kind: "action",
        id: "export-svg",
        label: "Export as SVG",
        icon: "file-code-corner",
        onSelect: () => void exportSvg(),
      },
    ],
    help: [
      {
        kind: "dialog",
        id: "keyboard-shortcuts",
        label: "Keyboard shortcuts…",
        icon: "keyboard",
        onSelect: () => shortcutsDialog.open(),
      },
    ],
  },
  problems: { onActivate: () => vscode.postMessage({ type: "showProblems" }) },
  emptyHint: { onInsertExample: () => vscode.postMessage({ type: "insertExample" }) },
});
// The modeler's own dialog in shell.root (see Modeler dialogs); it goes with the diagram.
const shortcutsDialog = createShortcutsDialog(shell);
modeler.on("diagram.destroy", () => shortcutsDialog.destroy());

// 3. Viewport, palette, keys and the empty-file hint. Cheap tests only: canFit() is cached, but
//    exportMap() validates the whole board.
const registry = modeler.get<{ getAll(): Array<{ parent?: unknown; waypoints?: unknown }> }>(
  "elementRegistry",
);
const isEmpty = () => !registry.getAll().some((element) => element.parent && !element.waypoints); // §13.5
const connection = connectDiagramJs(shell, modeler, {
  isEmpty,
  // no padding of its own (the default pads by 120px): the fit insets are the only margin (§5.9)
  contentBounds: () => (isEmpty() ? undefined : boardBounds.contentBounds(0)),
});
const { viewport } = connection;
persistView(vscode, viewport); // vscode.setState once the view rested, not on every frame
modeler.on("commandStack.changed", () => shell.menu.refresh()); // level undo/redo

// 4. Every import from the document (init and external updates), strictly one after another.
async function importText(text: string, first: boolean): Promise<void> {
  const keep = first ? undefined : viewport.getViewbox();
  try {
    await collaborative.importText(text); // silent: no change event comes from an import
    canvasLock.setReadOnly(false);
    shell.setReadOnly(false);
    shell.setStatus(null);
    if (keep) viewport.restore(keep);
    else if (first && stored.view) viewport.setState(stored.view);
    viewport.afterImport(); // first content fits, an empty file shows 100 %, the hint follows import.done
    shell.menu.refresh();
  } catch {
    // locked at once, the canvas included; marks and status box show after 800ms without a valid import
    canvasLock.setReadOnly(true);
    shell.setReadOnly(true, { delayMs: INVALID_STATUS_DELAY_MS });
    shell.setStatus(
      { severity: "danger", text: shell.messages.invalidFile("Event Storming board") },
      { delayMs: INVALID_STATUS_DELAY_MS },
    );
  }
}
let imports = Promise.resolve();
const enqueueImport = (text: string, first = false) =>
  (imports = imports.then(() => importText(text, first)));

// 5. Messages from the extension: the document, the diagnostics and the Command Palette commands,
//    which run the same handlers as the menu.
let firstImportSettled = () => {};
const ready = new Promise<void>((resolve) => (firstImportSettled = resolve));
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "init") void enqueueImport(message.text, true).then(firstImportSettled);
  if (message?.type === "update") void enqueueImport(message.text);
  if (message?.type === "problems") shell.setProblems({ count: message.count, errors: message.errors });
  if (message?.type === "command" && message.name === "fitView") viewport.fit();
});
vscode.postMessage({ type: "ready" });

// For the e2e test page (see ./testing/vscode-stub); the bundle publishes nothing on window.
export const webview = { shell, modeler: collaborative, connection, ready };
```

`zod-jitless.ts` is one line, `config({ jitless: true })` from `zod`, in a module of its own so that
it runs before any module that builds a schema.

A modeler with a legend persists it the same way: `legend: { render, open: stored.legendOpen,
onToggle: (open) => writeShellState(vscode, { legendOpen: open }) }`.

What the Event Storming renderer changes for the shell (the kit's `aria`, `keys`, `create` and
`readOnly` cases check each one):

- palette entries carry `title` and `shortcut` separately (`title: "Domain event", shortcut: "E"`),
  not `"Domain event — E"`;
- Enter or Space on a creating entry (a click with `detail === 0`) creates the sticky at the
  centre of the free rectangle (from `freeRectInsets`, the point `viewport.freeRectCenter()`
  returns), 24px further diagonally while that spot is taken, selects it, focuses the canvas and
  opens the label editor;
- no `tabindex` on `canvas.getContainer()` (an extra, unnamed tab stop before the palette); its
  keyboard listens on `document` anyway;
- the document keyboard returns early on `event.defaultPrevented` and for targets outside the canvas
  container (the zoom panel's buttons, the inspector), selects every element on Cmd/Ctrl+A, and in
  the webview binds no Cmd/Ctrl+Z, Shift+Z or Y (`undoRedoKeys: false`): VS Code's document history
  owns undo (§13.5), the shell only keeps diagram-js's `KeyboardBindings` off them;
- `eventStormingReadOnly` locks every edit rule (move, resize, create, connect, delete), and the
  keyboard, context pad, label editor and drawing handles consult it;
- its own overlays inside the canvas (the note toolbar, the colour picker) stay at `z-index` 100 or
  below, so the palette at 110 covers them (see Layers above);
- `boardBounds.contentBounds(0)`: the tight bounds of the board, since the fit insets are the margin.

Document sync, echo suppression, minimal edits and undo stay in the modeler for 0.1 (see below).

## Out of scope for 0.1

0.2 candidates unless noted:

- **VS Code document plumbing**: two-way sync with echo suppression, minimal `WorkspaceEdit`s,
  undo/redo through the document's history, "Insert example" as one edit, diagnostics to the
  Problems view (the pill only means something with a `DiagnosticCollection`), shared webview→host
  messages for the pill ("Show in Problems view") and "Insert example" with their host handlers,
  export save dialog. The modelers keep their own code; the shell keeps diagram-js's
  `KeyboardBindings` off undo/redo in the IDE host, stops undo/redo keys in text fields and stops
  keys the canvas handled.
- An ES-module webview bundle (`renderWebviewHtml` writes a classic script; a `scriptType` option).
- **Web-app chrome**: primary action (`data-chrome="primary"`) with label collapse, legal line,
  File and Appearance menu groups, problems popover, toasts, empty-state card, drop zone, the
  `localStorage` mode script. `host: "web"` in 0.1 covers keys (page zoom), fit insets and the
  pill/legend offsets only.
- **Dialog component and the shared shortcuts dialog** (§5.4, §8): an exported `cd-shell-dialog`
  class (panel, header with Close, body, backdrop with `grayscale(1)`, the high-contrast and
  forced-colours rules, the top layer through `showModal()`, focus trap and focus return), and on
  it `shell.showShortcutsDialog(groups: ShortcutGroup[])` with one table per group and the chips of
  the tooltip's `kbd`. The shell fills the View group itself from the chrome keys. New
  `ShellMessages`: `shortcutsTitle` ("Keyboard shortcuts"), `close` ("Close") and the group names
  "View", "Edit" and "Tools". Popovers (§5.4) follow on the same class. Until then a modeler meets
  the rules of [Modeler dialogs](#modeler-dialogs) itself; one component lets every modeler migrate
  once.
- **Placement helper** for palette keyboard creation: the 24px diagonal steps when the centre of the
  free rectangle is taken (§5.5), next to `Viewport.freeRectCenter()`.
- `appearance` surface of the modeler-api contract 1.1 for embedded hosts and the
  `miragon.<modeler>.colorTheme` setting UI (the bridge already honours `settingKey`).
- **Kit**:
  - cases for reduced motion and forced colours (they need `page.emulateMedia`, which `PageLike`
    does not have yet); the shell's CSS covers both, the e2e suite checks VS Code's reduce motion;
  - a CSP helper: serve the production bundle under `renderWebviewHtml`'s CSP inside the VS Code
    stub, record every `securitypolicyviolation` and fail on any (until then the recipe under
    `./vscode/extension`);
  - a harness field `documents?: readonly string[]` that hands `open` a document key (for example
    `["example", "style-dark", "empty"]`), so `appearance` runs per document; until then a modeler
    registers a second harness whose `open` loads the variant;
  - on those documents, a check that an empty one opens at 100 % with the empty-file hint;
  - a check that selects an element and reports positioned descendants of `.djs-container` above
    `z-index` 100 that are neither the palette, diagram-js's popup menu nor `.djs-hover-tooltip`.
- IntelliJ/JCEF hosts, Electron, Tauri, Theia.
- Canvas theming (`cd-canvas.css`, `cd-c-*` classes), light-only export, the token files themselves.
