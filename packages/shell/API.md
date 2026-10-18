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

| Entry                                     | For                                                         | Needs a DOM                    |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `@miragon/modeler-shell`                  | the chrome (`mountShell`), icons, plus all of `./core`      | yes (at call time)             |
| `@miragon/modeler-shell/core`             | fit math, keymap, zoom readout, appearance, sizes, messages | no                             |
| `@miragon/modeler-shell/diagram-js`       | `shellModule`, viewport, `connectDiagramJs`                 | yes                            |
| `@miragon/modeler-shell/vscode/extension` | webview HTML, nonce, theme bridge (extension host)          | no                             |
| `@miragon/modeler-shell/vscode/webview`   | `mountVsCodeShell`, appearance handler, webview state       | yes                            |
| `@miragon/modeler-shell/testing`          | Playwright-driven shell conformance kit                     | runs in Node, drives a browser |
| `@miragon/modeler-shell/shell.css`        | every style of the shell                                    | —                              |

All JavaScript entries ship as ESM and CJS with types; importing any of them has no side effects.

### Stylesheet order

```ts
import "./theme/cd-tokens.generated.css"; // vendored, unchanged, first
import "@fontsource-variable/geist/wght.css";
import "diagram-js/assets/diagram-js.css"; // usually through the renderer's CSS
import "@miragon/<notation>-renderer/…css"; // the renderer
import "@miragon/modeler-shell/shell.css"; // last
```

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
to the token fixture. `shellSizesFromTokens` reads a vendored JSON's `shell` group (throws on a
missing or non-numeric size).

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
  `canvas.viewbox(box)` shows exactly that view (§5.9). `undefined` for a 0 × 0 container or bounds
  without width and height; a zero width or height scales by the other dimension.
- `fitInsets` (§5.9): top 88, 140 in the second row; left and right 24; bottom 64, in the `web` host
  with a visible pill 92; right 324 (12 + 288 + 24) with an open side inspector (container wider
  than 760); left 12 + legend width + 24 with an open legend in containers wider than 440; bottom
  `container.height − sheetTop + 12` with an open bottom sheet (up to 760).
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
function formatNumber(value: number, lang: string): string;
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
  dialogOpen: boolean; // any [role="dialog"], modal or not (popovers)
  modalOpen: boolean; // [role="dialog"][aria-modal="true"]
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
| Escape (no modifier), menu open                           | `closeMenu` | yes            | yes                     |
| Escape, popover or dialog open                            | —           | no             | yes                     |
| zoom key, not composing, not in a text field, no modal    | the key     | yes            | yes                     |
| zoom key while composing, in a text field or with a modal | —           | no             | yes                     |
| Shift+1, not composing, not in a text field, no modal     | `fit`       | yes            | yes                     |
| Shift+1 otherwise                                         | —           | no             | no (types "!")          |
| undo/redo key in a text field                             | —           | no             | yes                     |
| any other key with `defaultPrevented`                     | —           | no             | yes                     |
| everything else                                           | —           | no             | no                      |

Shortcut labels (§5.8): macOS `⌘+`, `⌘−` (U+2212), `⌘0`, `⇧1`; elsewhere `Ctrl+Plus`, `Ctrl+Minus`,
`Ctrl+0`, `Shift+1` from `keyNames`. `aria-keyshortcuts`: `Meta+= Meta+Plus`, `Meta+-`, `Meta+0`,
`Shift+1`; outside macOS `Control` for `Meta`. The platform is read in the page itself
(`detectPlatform(navigator)`), never in the extension host (VS Code Remote).

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
interface AppearanceAttributes {
  "data-cd-theme": Theme;
  "data-cd-kontrast"?: Kontrast;
}
function appearanceAttributes(appearance: Appearance): AppearanceAttributes;
```

- `resolveAppearance` is the one decision of §13.5: a theme outside `themes` becomes `themes[0]`, so
  a modeler declaring `["light"]` is never half-dark; `kontrast` always passes (VS Code High
  Contrast on a light-only modeler gives `{ theme: "light", kontrast: "hoch" }`). Throws for empty
  `themes`. `themes` is a static value of the modeler package, known before the first paint.
- `appearanceFromColorThemeKind`: 1 → light, 2 → dark, 3 → dark + hoch, 4 → light + hoch, other →
  light. `requestedAppearance` lets the setting's theme win unless it is `automatic`; the contrast
  always comes from the kind.
- `appearanceFromBodyClasses` checks `vscode-high-contrast-light` before `vscode-high-contrast`.

### Messages

```ts
interface ShellMessages {
  menu: string; // "Menu"
  tools: string; // "Tools"
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
type ShellMessageOverrides = Partial<Omit<ShellMessages, "keyNames">> & {
  keyNames?: Partial<ShellMessages["keyNames"]>;
};
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
intrinsic `scrollWidth`, so the decision does not flip once the palette moved.

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
  lang?: string; // default closest [lang], else "en"; the embedded root gets lang itself
  messages?: ShellMessageOverrides;
  platform?: Platform; // default detectPlatform(navigator)
  keyScope?: "document" | "root"; // default "document", "root" for embedded
  menu?: MenuGroups;
  problems?: ProblemsOptions;
  legend?: LegendOptions;
  inspector?: InspectorOptions;
  emptyHint?: EmptyHintOptions;
}
```

`mountShell` turns `root` into the shell: class `cd-shell`, `container: cd-shell / size`,
`isolation: isolate`. `root` must be sized from outside (`height: 100%` in an own document, an
explicitly sized element in a foreign page), otherwise size containment collapses it to 0. In the
`ide` and `web` hosts `<html>` gets `cd-shell-document` (own-document reset). The shell observes the
root with a `ResizeObserver` (palette row, legend start state; 0 × 0 is skipped) and installs exactly
one `keydown` listener (bubble phase) on `document` or on the root.

**Order with document listeners.** Listeners on one target run in registration order. A modeler
whose own keyboard listens on `document` (Event Storming does) constructs its diagram **before**
`mountShell`, so the shell's listener runs after it and sees `defaultPrevented`. Listeners on the
canvas `<svg>` (diagram-js `keyboard`) have no ordering constraint.

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
}
interface MenuActionEntry extends MenuItemBase {
  kind: "action";
  shortcut?: string;
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
  label ends with "…" (U+2026) and the modeler renders the dialog (§8) inside `shell.root` at
  `z-index: var(--cd-shell-ebene-dialog)`.
- `checkbox` and `radio` toggle and keep the menu open. State is read through `checked()`, `value()`
  and `disabled()` whenever the menu opens and on `menu.refresh()`.
- Icons only from the common set and only where the guide gives one; the icon column stays 16px wide
  without an icon. With `setReadOnly(true)` every Model entry is `aria-disabled`.
- Keys: Enter, Space and ↓ on the trigger open on the first entry, ↑ on the last; ↑/↓ wrap, Home/End
  jump, a letter jumps to the next entry starting with it; Escape and Tab close (Escape returns focus
  to the trigger). A `pointerdown` outside (capture phase on `document`) closes without moving focus
  and without stopping the event, so it still acts on its target.

### Problems, legend, inspector, empty-file hint

```ts
interface ProblemsOptions {
  onActivate(): void; // the IDE host opens its Problems view
}
interface LegendOptions {
  render(body: HTMLElement): void; // once
  open?: boolean; // remembered start state; default legendStartsOpen(container height)
  onToggle?(open: boolean): void; // persist it
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
  setReadOnly(readOnly: boolean): void;
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
  setReadOnly(readOnly: boolean): void;
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
  per animation frame after `onChange`. With `null` the buttons are `aria-disabled`.
- `fitInsets()` is `fitInsets(layout)` of `./core` for what is open and measured right now.
- `setStatus(status, { delayMs })`: shows after `delayMs` (an invalid file: `INVALID_STATUS_DELAY_MS`,
  so typing does not flicker and `role="alert"` does not re-announce), hides at once with `null`.
- `setReadOnly(true)` (invalid file, §13.5): `data-readonly` on the root, Model entries and creating
  palette entries `aria-disabled`; Lasso and Hand stay active. Blocking context pad, moves, deletes
  and the label editor stays the modeler's job.
- `tooltip.attach` shows the chrome tooltip after `TOOLTIP_DELAY_MS` hover or at once on keyboard
  focus (a neighbour's at once while one is shown), hides it on click, Escape, leave and menu open,
  never on touch. The shell attaches it to its own buttons; the palette gets it through
  `registerPalette`.
- `destroy()` removes every element, class, attribute, listener, observer and timer the shell added
  (a passed `canvas` stays where it is, without `cd-shell-canvas`); a second call is a no-op.

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

### DOM, `data-chrome` and classes

```html
<html class="cd-shell-document" lang="en" data-cd-theme="light">  <!-- own document: ide, web -->
<div class="cd-shell" data-cd-shell-host="ide" data-palette="top"
     data-legend="open" data-inspector="open" data-problems="shown" data-readonly>  <!-- state attributes only while true -->
  <button class="cd-shell-menu-trigger" data-chrome="menu" aria-label="Menu" aria-haspopup="menu"
          aria-expanded="false" aria-controls="cd-shell-menu-1">…</button>
  <div class="cd-shell-canvas">                         <!-- diagram-js container -->
    <div class="djs-container">
      <div class="djs-palette" data-chrome="palette">   <!-- moved before the <svg> -->
        <div class="djs-palette-entries" role="toolbar" aria-label="Tools">
          <div class="group" data-group="tools">
            <div class="entry" data-action="lasso-tool" role="button" aria-label="…" tabindex="0" aria-pressed="false">…</div>
      <svg tabindex="0">…</svg>
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
    <div class="cd-shell-tooltip" role="tooltip">Zoom in <kbd class="cd-shell-kbd">⌘+</kbd></div>
  </div>
</div>
```

The DOM order is the tab order of §5.14 (menu trigger, palette, canvas, status box, hint, inspector,
pill, legend, zoom panel); nothing has a positive `tabindex`. Islands that are not shown are
`hidden`.

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
| `cd-shell-tooltip`, `cd-shell-kbd`                                                                                                                                                                                         | tooltip and shortcut chip                  |
| `cd-shell-zoom`, `cd-shell-zoom-readout`, `cd-shell-zoom-separator`                                                                                                                                                        | zoom panel                                 |
| `cd-shell-problems`                                                                                                                                                                                                        | pill                                       |
| `cd-shell-status`, `cd-shell-status-icon`, `cd-shell-status-text`                                                                                                                                                          | status box (bar as `::before`)             |
| `cd-shell-hint`, `cd-shell-hint-text`, `cd-shell-hint-action`                                                                                                                                                              | empty-file hint                            |
| `cd-shell-legend`, `cd-shell-legend-header`, `cd-shell-legend-title`, `cd-shell-legend-close`, `cd-shell-legend-body`                                                                                                      | legend card                                |
| `cd-shell-legend-row`, `cd-shell-legend-preview`, `cd-shell-legend-separator`                                                                                                                                              | rows the modeler renders into the body     |
| `cd-shell-inspector`                                                                                                                                                                                                       | inspector                                  |
| `cd-shell-no-transition`                                                                                                                                                                                                   | on `<html>` for one frame of a mode switch |

Modelers style only their own content (legend rows, inspector fields); every other class is
internal to the shell CSS and may change in a minor release.

### Geometry

Relative to the shell root, ±1px (§5.2 to §5.12). `ide` and `embedded` share the IDE column.

| Island      | Box                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `menu`      | 40 × 40 at `top: 12px; left: 12px`                                                                                  |
| `palette`   | 40 high at `top: 12px`, horizontally centred; second row `top: 64px`, at most `100cqw − 24px` wide                  |
| `zoom`      | 173 × 40 (56px readout) at `right: 12px; bottom: 12px`                                                              |
| `problems`  | 40 high at `left: 12px; bottom: 12px` (web `40px`)                                                                  |
| `legend`    | `left: 12px`, `bottom: 12px` without pill, `60px` with pill (web `40px`, `88px`); up to 440px width at least `60px` |
| `inspector` | 288 wide at `top: 64px; right: 12px`; up to 760px width a bottom sheet with 12px left, right and bottom             |
| `status`    | centred at `top: 64px` (second row `116px`); with an open side inspector centred in the strip left of it            |
| dropdown    | `top: 60px; left: 12px`, at least 248px wide                                                                        |
| tooltip     | top row `top: 60px`, second row `top: 112px`, bottom row `bottom: 60px`                                             |

Layers (§5.13): the canvas slot is layer 0 with `isolation: isolate` (palette `z-index: 110` above
context pad and label editor at 100); islands `--cd-shell-ebene-inseln` (20), inspector 25, menu
trigger 30, layer 40, modeler dialogs 50.

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
  getEntries(): Record<string, { title?: string; shortcut?: string; group?: string }>;
}

const shellModule: ModuleDeclarationLike;

interface ConnectOptions {
  contentBounds(): Bounds | undefined;
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

**`shellModule`** goes into the modeler's modules after the renderer's own (`additionalModules`):

- `paletteTooltip: ["value", null]` replaces diagram-js's (and a renderer's) palette tooltip; the
  chrome tooltip takes over with `title` and `shortcut` from `palette.getEntries()`.
- Palette skin: on `palette.create` it sets `data-chrome="palette"` and moves the container in front
  of the canvas `<svg>` (`canvas.getContainer()`'s child), so tab order puts the palette first. After
  every `palette.changed` it re-applies `role="toolbar"` and `aria-label` on `.djs-palette-entries`,
  roving `tabindex` (← → Home End, Enter and Space trigger), and `aria-pressed` for the tool of the
  last `tool-manager.update` (group `tools`, `data-action="<tool>-tool"`), styled through
  `[aria-pressed="true"]`: diagram-js's `highlighted-entry` goes stale after a rebuild, and its
  `two-column` class is ignored. In read-only it marks the entries outside group `tools`
  `aria-disabled` and vetoes them on `palette.trigger`.
- Keyboard: `keyboard.addListener(2000, …)` returns `true` for every `matchChromeKey` hit, so
  `KeyboardBindings` and the modeler's keyboard modules (priority 1000) never act on them; the
  shell's `keydown` listener executes them exactly once.
- It buffers the palette until `connectDiagramJs`, so the diagram may exist before the shell.

**`connectDiagramJs`** creates the viewport with `insets: shell.fitInsets`, binds it
(`shell.setZoomTarget`), registers the palette and calls `canvas.resized()` (the canvas element has
moved). It throws when `shellModule` is missing.

**`Viewport`** (§5.8, §5.9):

- `stepZoom` is `zoomScroll.stepZoom(±1)` (the wheel's raster, snapping to the nearest step);
  `zoomToActual` is `canvas.zoom(1)`; both around the container centre. No rounding of its own.
- `fit()` uses `fitViewbox(contentBounds(), canvas.getSize(), insets())` and `canvas.viewbox(box)`,
  never `canvas.zoom("fit-viewport")`; animated over 250ms in `requestAnimationFrame` with
  `easeStandard` unless `animate: false` or reduced motion; a `wheel`, `pointerdown` or zoom key
  cancels the animation. A no-op when the bounds are empty.
- `afterImport()` jump-fits the first import whose bounds are non-empty (also after an empty file got
  its first content), unless the view was restored (`restore`, `setState`) or the user moved it.
- A `ResizeObserver` on `canvas.getContainer()`, coalesced per frame, skips 0 × 0 (hidden tab), calls
  `canvas.resized()` and refits while the view is automatic.
- User moves: every `canvas.viewbox.changed` (and `canvas.viewbox.changing` for the readout under
  `deferUpdate`) is compared with the last box the viewport set (`sameView`); a difference is a user
  move. Fit makes the view automatic again; `restore` updates the reference without resetting it.
- diagram-js events used: `palette.create`, `palette.changed`, `tool-manager.update`,
  `palette.trigger`, `canvas.viewbox.changing`, `canvas.viewbox.changed`, `canvas.resized`,
  `keyboard.keydown`, `diagram.destroy`. The shell fires no events of its own.

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
  `WebviewPanelLike` (pinned by a type test against `@types/vscode`).
- `renderWebviewHtml` writes the appearance attributes on `<html>` before the first paint, always
  (also `light`), and a strict CSP (`data:` fonts for the bundled Geist). `lang` is the tool's UI
  language: English modelers pass `"en"`, not `vscode.env.language`.

  ```text
  <html lang="en" class="cd-shell-document" data-cd-theme="light" data-cd-kontrast="hoch">
  Content-Security-Policy: default-src 'none'; img-src {cspSource} data: blob:;
    style-src {cspSource} 'unsafe-inline'; font-src {cspSource} data:; script-src 'nonce-{nonce}'
  ```

- `currentAppearance` resolves `requestedAppearance(kind, setting)` against `themes`.
  `connectThemeBridge` posts `appearanceMessage(currentAppearance(…))` on
  `onDidChangeActiveColorTheme`, on `onDidChangeConfiguration` affecting `settingKey`, and on
  `onDidChangeViewState` when the panel becomes visible; it disposes with the panel.
- `revealFileLabel(process.platform)`: "Reveal in Finder" (`darwin`), "Reveal in File Explorer"
  (`win32`), "Open Containing Folder" (other), for the export notification (§13.5).

## `./vscode/webview`

```ts
function applyAppearance(appearance: Appearance, element?: HTMLElement): void; // default <html>
interface AppearanceListenerOptions {
  themes: readonly Theme[];
}
function connectAppearance(options: AppearanceListenerOptions): () => void;

interface VsCodeShellOptions extends Omit<ShellOptions, "host" | "keyScope">, AppearanceListenerOptions {}
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

// re-exported from the shared protocol, as in ./vscode/extension:
// APPEARANCE_MESSAGE_TYPE, AppearanceMessage, appearanceMessage, isAppearanceMessage
```

- `applyAppearance` sets `data-cd-theme` and `data-cd-kontrast` in one task, with
  `cd-shell-no-transition` on `<html>` until a nested `requestAnimationFrame` (no colour fades).
- `connectAppearance` applies every `AppearanceMessage` arriving on `window`. Until the first one
  arrives it watches the body classes with a `MutationObserver` and applies
  `resolveAppearance(appearanceFromBodyClasses(…), themes)`; from the first message on, messages
  win. The body classes are never used for styling.
- `mountVsCodeShell` is `mountShell` with `host: "ide"`, `keyScope: "document"` and
  `connectAppearance(options)`; its `destroy()` disconnects the appearance listener too. This wires
  the IDE key interception: handled keys are stopped on `document`, before VS Code's listener on
  `window` forwards them to the workbench.
- `readShellState`/`writeShellState` keep the shell's part (legend state, view) under
  `SHELL_STATE_KEY` of `vscode.getState()`, merging and leaving every other key alone. The modeler
  owns `acquireVsCodeApi()` (callable once) and passes its API object.

## `./testing`

```ts
interface PageLike {
  evaluate<R, Arg>(pageFunction: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  mouse: { click(x: number, y: number): Promise<void>; move(x: number, y: number): Promise<void> };
  waitForTimeout(timeout: number): Promise<void>;
}

interface OpenContext {
  size: Size;
  requested: Appearance;
}
interface ShowHooks<P extends PageLike = PageLike> {
  problems?(page: P): Promise<void>;
  status?(page: P): Promise<void>;
  legend?(page: P): Promise<void>;
  inspector?(page: P): Promise<void>;
}
interface ShellConformanceHarness<P extends PageLike = PageLike> {
  host: ShellHost;
  themes: readonly Theme[];
  open(page: P, context: OpenContext): Promise<void>;
  destroy?(page: P): Promise<void>;
  root?: string; // default ".cd-shell"
  show?: ShowHooks<P>;
  sizes?: readonly Size[]; // default 1280 × 900, 720 × 700, 420 × 700
}
interface ShellCaseOutcome {
  skipped?: string;
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
  onSkip?(caseName: string, reason: string): void;
}
function registerShellConformance<P extends PageLike>(
  harness: ShellConformanceHarness<P>,
  test: ShellConformanceTest<P>,
  options?: RegisterShellConformanceOptions,
): void;

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

Cases (each named `shell conformance: <name>`, failures throw plain `Error`s, a case the harness
cannot feed reports `skipped` through `onSkip`, default `console.warn`):

| Case         | Checks                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry`   | every visible `data-chrome` island against the geometry table, ±1px, per size (top row and second row, side inspector and sheet)                                                                                                                               |
| `aria`       | trigger `aria-haspopup`/`-expanded`/`-controls` → `role="menu"`; palette `role="toolbar"` with roving tabindex; zoom `role="group"`, readout `aria-label`, `aria-keyshortcuts`, `aria-disabled` at the limits; DOM order; no positive `tabindex`               |
| `keys`       | each chrome key changes the zoom exactly once (100 % → 135 % → 100 %, fit); unmodified `+`/`-` do nothing; in the `ide` host a `keydown` listener on `window` never fires for a handled key (zoom keys incl. Shift and numpad, Shift+1, Escape with open menu) |
| `appearance` | the harness requests dark (and high contrast): a light-only modeler keeps `data-cd-theme="light"` (with `hoch`), and `color-scheme` is light on root, palette, islands, dropdown and tooltip — never half-dark                                                 |
| `cleanup`    | after `destroy`: no `.cd-shell*` element, class or attribute left, chrome keys do nothing, no error                                                                                                                                                            |

The kit never imports Playwright; a modeler's suite passes its `page` and `test`
(`registerShellConformance(harness, test)` from `@playwright/test`).

## `./shell.css`

One stylesheet for everything above, loaded last. Containment: `.cd-shell { container: cd-shell /
size }`; breakpoints are `@container cd-shell (max-width: 760px)`, `(max-width: 440px)` with literal
values (custom properties are not allowed in container conditions), sizes inside are `cqw`/`cqh`,
never viewport units, and no element inside gets a `container-type` of its own. It covers glass
islands (`color-mix(in srgb, var(--cd-ui-flaeche-hoch) var(--cd-ui-chrome-deckkraft), transparent)`
with `backdrop-filter: blur(8px)`), opaque popups, focus rings (inset in dense containers),
`[data-cd-kontrast="hoch"]` (no shadows, 3px focus), `@media (forced-colors: active)` (rings in
`Highlight`, status bar and island borders in `CanvasText`), `prefers-reduced-motion`, and under
`html.cd-shell-document` the own-document reset: no body padding, `--cd-ui-grund` background, Geist
13px/1.5, own `kbd`, `code`, links, focus and scrollbars, never `var(--vscode-*)`.

## Usage: Event Storming in VS Code

Extension host (`EventStormingEditorProvider.resolveCustomTextEditor`):

```ts
import * as vscode from "vscode";
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
  revealFileLabel,
} from "@miragon/modeler-shell/vscode/extension";

const THEMES = ["light"] as const; // until the shared dark-mode release of all modelers

webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")] };
const asset = (file: string) =>
  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", file)).toString();
webview.html = renderWebviewHtml({
  cspSource: webview.cspSource,
  scriptUri: asset("webview.js"),
  styleUris: [asset("webview.css")],
  title: "Event Storming Board",
  lang: "en",
  appearance: currentAppearance(vscode, { themes: THEMES }),
});
context.subscriptions.push(connectThemeBridge(vscode, webviewPanel, { themes: THEMES }));

// after an export (exportImage.ts):
const reveal = revealFileLabel(process.platform);
if ((await vscode.window.showInformationMessage(`Exported ${name}.`, reveal)) === reveal) {
  void vscode.commands.executeCommand("revealFileInOS", target);
}
```

Webview (`src/webview/main.ts`):

```ts
import "./theme/cd-tokens.generated.css";
import "@fontsource-variable/geist/wght.css";
import { BoardBounds, Modeler, type EventStormingViewOptions } from "@miragon/event-storming-renderer";
import "@miragon/modeler-shell/shell.css";
import { INVALID_STATUS_DELAY_MS } from "@miragon/modeler-shell";
import { connectDiagramJs, shellModule } from "@miragon/modeler-shell/diagram-js";
import { mountVsCodeShell, readShellState, writeShellState } from "@miragon/modeler-shell/vscode/webview";

const vscode = acquireVsCodeApi();
const stored = readShellState(vscode);

// 1. The diagram first: Event Storming's keyboard listens on document and must run before the shell's.
const modeler = new Modeler({ width: "100%", height: "100%", additionalModules: [shellModule] });
modeler.get("canvas");
const viewOptions = modeler.get<EventStormingViewOptions>("eventStormingViewOptions");
const levels = () =>
  modeler.get<{ getLevel(): string; setLevel(level: string): void }>("eventStormingModeling");

// 2. The chrome around it.
const shell = mountVsCodeShell(document.getElementById("app")!, {
  themes: ["light"],
  canvas: modeler.container,
  menu: {
    model: [
      {
        kind: "radio",
        id: "level",
        label: "Level",
        options: [
          { value: "big-picture", label: "Big picture" },
          { value: "process", label: "Process modelling" },
          { value: "design", label: "Software design" },
        ],
        value: () => levels().getLevel(),
        onSelect: (level) => levels().setLevel(level),
      },
      {
        kind: "checkbox",
        id: "type-captions",
        label: "Type captions",
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
  },
  problems: { onActivate: () => vscode.postMessage({ type: "showProblems" }) },
  emptyHint: { onInsertExample: () => vscode.postMessage({ type: "insertExample" }) },
});

// 3. Viewport, palette and keys.
const isEmpty = () => modeler.exportMap().elements.length === 0; // §13.5: no element = empty file
const { viewport } = connectDiagramJs(shell, modeler, {
  contentBounds: () => (isEmpty() ? undefined : modeler.get<BoardBounds>("boardBounds").contentBounds()),
});
viewport.onChange(() => writeShellState(vscode, { view: viewport.getState() }));
modeler.on("commandStack.changed", () => shell.menu.refresh()); // level undo/redo

// 4. Every import from the document (init and external updates).
async function importText(text: string, first: boolean): Promise<void> {
  const keep = first ? undefined : viewport.getViewbox();
  try {
    await modeler.importDSL(text);
    shell.setReadOnly(false);
    shell.setStatus(null);
    if (keep) viewport.restore(keep);
    else if (first && stored.view) viewport.setState(stored.view);
    viewport.afterImport();
    shell.setEmptyHint(isEmpty());
    shell.menu.refresh();
  } catch {
    shell.setReadOnly(true); // at once; the box follows after 800ms without a valid import
    shell.setStatus(
      { severity: "danger", text: shell.messages.invalidFile("Event Storming board") },
      { delayMs: INVALID_STATUS_DELAY_MS },
    );
  }
}

// 5. Command Palette commands run the same handlers as the menu.
window.addEventListener("message", (event) => {
  if (event.data?.type === "command" && event.data.name === "fitView") viewport.fit();
});
```

Document sync, echo suppression, minimal edits and undo stay in the modeler for 0.1 (see below).

## Out of scope for 0.1

0.2 candidates unless noted:

- **VS Code document plumbing**: two-way sync with echo suppression, minimal `WorkspaceEdit`s,
  undo/redo through the document's history (no canvas `commandStack` bindings on Cmd+Z), "Insert
  example" as one edit, diagnostics to the Problems view, export save dialog. The modelers keep
  their own code; the shell only stops undo/redo keys in text fields and keys the canvas handled.
- **Web-app chrome**: primary action (`data-chrome="primary"`) with label collapse, legal line,
  File and Appearance menu groups, problems popover, toasts, empty-state card, drop zone, the
  `localStorage` mode script. `host: "web"` in 0.1 covers keys (page zoom), fit insets and the
  pill/legend offsets only.
- **Dialog and popover components** (§8: backdrop, focus trap) and the built-in "Keyboard
  shortcuts…" dialog; 0.1 has `dialog` menu entries, the modeler renders the dialog.
- Palette keyboard creation (Enter on a creating entry places the element in the centre of the free
  rectangle and opens the label editor).
- `appearance` surface of the modeler-api contract 1.1 for embedded hosts and the
  `miragon.<modeler>.colorTheme` setting UI (the bridge already honours `settingKey`).
- IntelliJ/JCEF hosts, Electron, Tauri, Theia.
- Canvas theming (`cd-canvas.css`, `cd-c-*` classes), light-only export, the token files themselves.
