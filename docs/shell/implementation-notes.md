# @miragon/modeler-shell — implementation notes

`@miragon/modeler-shell` will be the shared, framework-free implementation of everything around a
Miragon diagram-js modeler: menu button, tool palette, tooltips, zoom panel, keys, fit, problems pill,
legend, status box and the plumbing to its host (a VS Code webview, a web app, or an embedding host
such as designIQ). **Status: planned**, Phase 4 of [#4](https://github.com/Miragon/modeler-api/issues/4).
No package in this repository implements these notes yet.

The source of truth for look and behaviour is the Miragon design system: the Claude skill
`modeler-tool-design` in Miragon/corporate-identity, guide
[`plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md`][guide], §5
(chrome anatomy) and §13.3 to §13.5 (appearance and IDE hosts). The guide defines what users and
reviewers experience: sizes, anchors, surfaces, states, keys and their effect, timing, ARIA,
accessibility and the rules per host. These notes explain how to get there with diagram-js, VS Code
and browser APIs: services and events, DOM and CSS techniques, host quirks.

The design system repository is private, so the guide links in these notes open only for Miragon
staff. Every section therefore links the guide section it implements and restates its rule in one
line (**Guide §x.y.** Rule: …); the mechanics follow. If a note and the guide disagree, the guide
wins and the note gets fixed. If you cannot read the guide and something here looks wrong or
incomplete, open an issue in [Miragon/modeler-api](https://github.com/Miragon/modeler-api/issues); a
maintainer checks it against the guide.

Checked against diagram-js 15.28.1 (the guide requires at least 15.28) and against VS Code's webview
host page (`src/vs/workbench/contrib/webview/browser/pre/index.html` on `main`, October 2026). What
can only be confirmed in a running VS Code is collected in
[Open verification points](#open-verification-points).

## Glossary

The design system names its tokens and attributes in German. The names used in these notes:

| Name                                                                                  | Meaning                                                                                                                       | Value                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `--cd-shell-rand`                                                                     | edge: distance of every island from the container edge                                                                        | 12px                                   |
| `--cd-shell-luecke`                                                                   | gap: trigger to dropdown, island to island in one stack                                                                       | 8px                                    |
| `--cd-shell-zeile`                                                                    | row: height of every island in the top and bottom rows                                                                        | 40px                                   |
| `--cd-shell-ziel`                                                                     | target: button or entry inside an island                                                                                      | 32px                                   |
| `--cd-shell-eintrag`                                                                  | entry: minimum height of a menu entry, default button in dialogs                                                              | 36px                                   |
| `--cd-shell-frei`                                                                     | free line: first free line below the top row and above the bottom row                                                         | 64px                                   |
| `--cd-shell-menue-breite`, `--cd-shell-inspector-breite`                              | minimum dropdown width, inspector width                                                                                       | 248px, 288px                           |
| `--cd-shell-einpassen-oben`, `-oben-schmal`, `-seite`, `-unten`, `-unten-web`         | fit insets: top, top with the palette in the second row, left and right, bottom, bottom in the web app with the problems pill | 88, 140, 24, 64, 92px                  |
| `--cd-shell-schmal`, `-sehr-schmal`, `-niedrig`                                       | breakpoints: narrow and very narrow (width), low (height)                                                                     | 760, 440, 820px                        |
| `--cd-shell-ebene-inseln`, `-inspector`, `-reihe`, `-aufklapper`, `-dialog`, `-toast` | layers (`z-index`): islands, inspector, top row, dropdowns (dropdown, popover, chrome tooltip), dialog, toast                 | 20, 25, 30, 40, 50, 60                 |
| `--cd-ui-grund`                                                                       | ground: app background and canvas surroundings                                                                                | per mode                               |
| `--cd-ui-flaeche`, `--cd-ui-flaeche-hoch`                                             | surface of a docked panel; raised surface (dropdown, dialog, tooltip, inspector)                                              | per mode                               |
| `--cd-ui-hover`, `--cd-ui-plot`                                                       | hover and pressed surface; drawing area                                                                                       | per mode                               |
| `--cd-ui-linie`, `--cd-ui-kontur`                                                     | line (decorative borders, separators); contour (input borders, at least 3:1)                                                  | per mode                               |
| `--cd-ui-text`, `--cd-ui-text-leise`, `--cd-ui-link`                                  | text, muted text, links                                                                                                       | per mode                               |
| `--cd-ui-interaktion`, `--cd-ui-fokus`                                                | interaction (selection, active-tool ring, hover icon); focus ring                                                             | per mode                               |
| `--cd-ui-<status>`, `--cd-ui-<status>-flaeche`                                        | status colour and status surface for `success`, `warning`, `danger`, `info`                                                   | per mode                               |
| `--cd-ui-chrome-deckkraft`                                                            | opacity of glass islands                                                                                                      | 84 %, opaque in dark and high contrast |
| `data-cd-theme`                                                                       | mode attribute: `light`, `dark` or `system`                                                                                   |                                        |
| `data-cd-kontrast="hoch"`, `kontrast: "hoch"`                                         | high contrast ("hoch" means high), on the same element as `data-cd-theme`                                                     |                                        |
| radius `sm`, `md`, `lg`, `pill` (`--cd-radius-*`)                                     | corner radii                                                                                                                  | 6, 12, 16, 999px                       |
| `shadow-1` to `shadow-3` (`--cd-shadow-*`)                                            | elevation, from resting islands to dropdowns and dialogs                                                                      |                                        |
| `--cd-motion-fast`, `-base`, `-slow`; `--cd-ease`, `--cd-ease-out`                    | durations; easing                                                                                                             | 150, 250, 400ms                        |

## Where the tokens come from

- `cd-tokens.generated.css` (every `--cd-*` variable, the roles per mode) and
  `cd-tokens.generated.json` (the roles per mode as hex, plus `shell` with the shell dimensions) are
  generated in the design system repository and published unchanged at
  <https://corporate-identity.netlify.app/brand/cd-tokens.generated.css> and
  <https://corporate-identity.netlify.app/brand/cd-tokens.generated.json>. The `shell` group appears
  there with design system release 1.12.0.
- Modeler repositories vendor them unchanged, for example
  `packages/renderer/src/theme/cd-tokens.generated.css` in
  [Miragon/wardley-maps-modeler](https://github.com/Miragon/wardley-maps-modeler). A vendored copy is
  never edited by hand; it is re-copied from the source.
- `cd-canvas.css` (the mapping of the diagram-js variables and the `cd-c-*` role classes) ships only
  with the design system skill so far and is not public yet.

## What a modeler hands to the shell

**Guide [§5][guide-5].** Rule: the chrome is the same for every modeler; only the modeler knows its
content.

| The modeler supplies                                               | The shell uses it for                       |
| ------------------------------------------------------------------ | ------------------------------------------- |
| content bounds in diagram coordinates (empty means nothing to fit) | fit (§5.9)                                  |
| whether the file is empty, whether an example exists               | empty-file hint (§13.5)                     |
| diagnostics with count and highest severity                        | problems pill (§5.10)                       |
| whether the file is invalid                                        | status box, read-only canvas (§5.12, §13.5) |
| legend content                                                     | legend (§5.10)                              |
| entries of the Model menu group                                    | menu (§5.4)                                 |
| palette entries with name and shortcut (`title`, `shortcut`)       | palette and its tooltip (§5.5, §5.6)        |
| the list of keyboard shortcuts                                     | "Keyboard shortcuts…" dialog (§5.4)         |
| the inspector                                                      | inspector (§5.11)                           |

The shell talks to diagram-js only through public services and events (`canvas`, `zoomScroll`,
`keyboard`, `palette`, `eventBus`). It never reads private fields such as `palette._container`, which
hosts still do today (Miragon/design-iq#136): the palette's container comes with the `palette.create`
event.

## Container, not window

**Guide [§5.1][guide-5.1], [§5.15][guide-5.15].** Rule: every size, breakpoint and height is relative to
the modeler's container, never to the window, so an embedded modeler behaves like one in its own
webview.

- The shell root gets `container-type: size` and `position: relative`; the islands are
  `position: absolute` inside it.
- `container-type: size` applies size containment: the root no longer takes its height from its
  content. It must get width and height from outside (`height: 100%` in the webview and the web app,
  an explicitly sized element in an embedding page), otherwise it collapses to 0.
- Use container query units, never viewport units: `cqw` and `cqh` instead of `vw` and `vh`. Every
  container-relative size the guide writes as a percentage is written with them, so it resolves
  against the shell root and not against whatever positioned element happens to be the containing
  block:
  - dropdown `max-width: min(320px, 100cqw - 24px)`, `max-height: calc(100cqh - 72px)`;
  - tooltip `max-width: min(280px, 100cqw - 24px)`;
  - bottom sheet `max-height: 45cqh`;
  - inspector `max-height: calc(100cqh - 128px)`;
  - legend `max-height: calc(100cqh - 64px - <bottom> - 12px)`, with the palette in the second row
    `calc(100cqh - 116px - <bottom> - 12px)`;
  - problems popover `width: min(320px, 100cqw - 24px)`, status box
    `max-width: min(560px, 100cqw - 24px)`, palette in the second row
    `max-width: calc(100cqw - 24px)`;
  - the components of guide §8 wherever the shell renders them: dialog
    `width: min(560px, 100cqw - 32px)`, confirmation `min(440px, 100cqw - 32px)`, both
    `max-height: calc(100cqh - 32px)`; toast `width: min(480px, 100cqw - 24px)`; empty-state card
    `width: min(400px, 100cqw - 24px)`.
- No element inside the shell gets a `container-type` of its own. `cqw`/`cqh` resolve against the
  nearest query container, so a nested one would silently change their meaning. Name the root
  (`container-name: cd-shell`) and write `@container cd-shell (…)` so host CSS cannot interfere.
- Breakpoints are `@container` queries on the shell root, never `@media` (see
  [Narrow and low containers](#narrow-and-low-containers)).
- Scripts measure the container with a `ResizeObserver` on the shell root, never with
  `window.innerWidth`/`innerHeight`.
- The sizes come from the vendored tokens: CSS uses `var(--cd-shell-*)`, scripts read the `shell`
  object of `cd-tokens.generated.json`, whose keys are the CSS variable names and whose values are
  strings with unit (`"88px"`, layers `"20"`): `parseFloat(tokens.shell["--cd-shell-einpassen-oben"])`.

## Geometry hooks

**Guide [§5.2][guide-5.2], [§13.4][guide-13.4].** Rule: every island sits at a fixed anchor with fixed
sizes in every host; tests check the position of each island to 1px.

- Every island carries `data-chrome` with its name: `menu`, `palette`, `primary`, `zoom`,
  `problems`, `legend`, `inspector`, `status`. On the palette the attribute goes onto diagram-js's
  `.djs-palette` element.
- Shell conformance runs in every modeler's e2e suite in a real browser. It finds the islands through
  this attribute and asserts their boxes (`getBoundingClientRect()` relative to the shell root) within
  ±1px. There are no pixel goldens: the islands are glass, so their pixels depend on the diagram
  underneath.
- The expected boxes, relative to the shell root (guide §5.2 to §5.12, IDE host unless noted):

  | Island      | Expected box                                                                                                                        |
  | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | `menu`      | 40 × 40 at `top: 12px; left: 12px`                                                                                                  |
  | `palette`   | 40 high at `top: 12px`, horizontally centred; second row `top: 64px`                                                                |
  | `primary`   | web app only: 40 high at `top: 12px; right: 12px`                                                                                   |
  | `zoom`      | 40 high at `right: 12px; bottom: 12px`, 173px wide with a 56px readout                                                              |
  | `problems`  | 40 high at `left: 12px`, `bottom: 12px` (web app `40px`, above the legal line)                                                      |
  | `legend`    | `left: 12px`, `bottom: 12px` without pill, `60px` with pill (web app `40px` and `88px`); up to 440px width at least `60px`          |
  | `inspector` | 288 wide at `top: 64px; right: 12px`; up to 760px width a bottom sheet with 12px left, right, bottom                                |
  | `status`    | horizontally centred under the palette at `top: 64px` (second row `116px`); with an open inspector centred in the strip to its left |

## Menu

**Guide [§5.4][guide-5.4].** Rule: a click outside the open menu closes it without moving focus and
still acts on its target, also on the canvas.

- While the menu is open, listen for `pointerdown` on `document` with `{ capture: true }`. diagram-js
  stops pointer events on its own surfaces: palette and context pad call `stopPropagation()` on
  `mousedown`, the dragging module stops the events of a drag, and canvas interaction events stop
  propagation when a listener returns `false`. A bubble-phase listener would miss these clicks.
- Neither stop nor prevent the event, so the click still reaches its target (a palette tool, an
  element on the canvas).
- Dropdown limits: `max-width: min(320px, 100cqw - 24px)`, `max-height: calc(100cqh - 72px)` (see
  [Container, not window](#container-not-window)).

## Palette

**Guide [§5.5][guide-5.5].** Rule: the palette is one horizontal glass island, 40px high, at the top
centre in every modeler; it lies above context pad and label editor and comes before the canvas in the
tab order.

- **Position.** diagram-js styles `.djs-palette` as a vertical column
  (`left: 20px; top: 20px; width: 48px`, floating 46 × 46 entries). The shell overrides it with
  `top: 12px; left: 50%; transform: translateX(-50%); width: auto` and lays `.djs-palette-entries`
  and each `.group` out as one flex row of 32 × 32 entries.
- **Surface.** `cd-canvas.css` (vendored from the design system) maps the diagram-js surface
  variables (`--bio-surface` and friends) to the opaque `--cd-ui-flaeche-hoch`, so the diagram-js
  palette on its own is opaque. The shell CSS sets the glass on top (guide §5.3):
  `background: color-mix(in srgb, var(--cd-ui-flaeche-hoch) var(--cd-ui-chrome-deckkraft), transparent)`
  with `backdrop-filter: blur(8px)`, 1px border in `--cd-ui-linie`, radius `md`, `shadow-1`. Use a
  selector of at least specificity 0,2,0 (`.djs-palette[data-chrome="palette"]`) so the result does
  not depend on stylesheet order.
- **Layer.** The palette stays inside the diagram-js canvas container (layer 0, see
  [Layers](#layers)) with `z-index: 110`. The context pad has 100 (set by diagram-js), the label
  editor 100 (set by the modeler).
- **DOM order.** `Palette#_init` appends the palette to `canvas.getContainer()` after the `<svg>` and
  then fires `palette.create` with `{ container }`. On that event the shell moves it in front of the
  canvas `<svg>` (the `svg` of the `canvas.init` event): `canvasContainer.insertBefore(container, svg)`.
  DOM order, and with it the tab order, then puts the palette before the canvas (the `<svg>` carries
  `tabindex="0"`).
- **Rebuilds.** `Palette#_update` clears and rebuilds all entries on every change and then fires
  `palette.changed`. Entries are `div.entry` elements with `data-action`, plus `role="button"` and
  `aria-label` when the entry has a `title`; entries without a `group` land in group `default`. After
  every `palette.changed` the shell re-applies what it adds: `role="toolbar"` and `aria-label="Tools"`
  on the entries container, roving `tabindex` (0 on one entry, -1 on the rest) and `aria-pressed` on
  tool entries.
- **Active tool.** diagram-js fires `tool-manager.update` with `{ tool }` (the tool name, `null` when
  none is active) and marks the matching entry in group `tools` (`data-action="<tool>-tool"`) with
  `highlighted-entry`. The shell mirrors that to `aria-pressed="true"`.
- **Group separator.** Between two `.group` elements: `margin-left: 8px` before the line and
  `padding-left: 8px` after it, so 8px of space show on each side. Draw the 1px line as a `::before`
  inset 4px at top and bottom; a `border-left` would run the full 32px.

## Tooltip

**Guide [§5.6][guide-5.6].** Rule: palette entries and chrome buttons show the same chrome tooltip with
a shortcut chip, after 300ms hover or at once on keyboard focus, on the dropdown layer above status box,
legend and inspector.

- Render the tooltip outside the canvas container, in a layer element directly under the shell root
  at `z-index: var(--cd-shell-ebene-aufklapper)` (40). Inside the canvas container (layer 0,
  `isolation: isolate`) it would sit below status box, legend and inspector whatever its z-index.
- Do not render it inside an island either: an island with a `z-index` is a stacking context of its
  own, so a tooltip inside it could not rise above the inspector, and `backdrop-filter` makes a glass
  island the containing block of `position: fixed` descendants. Position the tooltip with
  `position: absolute` in shell-root coordinates (differences of `getBoundingClientRect()`).
- diagram-js 15.28 ships its own palette tooltip: `PaletteTooltip` on top of `HoverTooltip`, shown on
  `mouseover` only and therefore never on keyboard focus, placed to the right of a vertical palette.
  The shell replaces it with an empty service in the modeler's modules:
  `{ paletteTooltip: ["value", null] }` (a later module overrides the earlier definition in didi; the
  palette module still lists `paletteTooltip` in `__init__`, which then resolves to `null`).
- Name and shortcut come from `palette.getEntries()` (`title`, `shortcut`), keyed by the entry's
  `data-action`. Re-read them on `palette.changed`.
- The 300ms hover delay is the delay of diagram-js's `HoverTooltip` (`SHOW_DELAY = 300`), so palette,
  chrome and canvas tooltips feel the same.
- `max-width: min(280px, 100cqw - 24px)` (see [Container, not window](#container-not-window)).
- Shortcut chip (`kbd`): set every property of the guide's spec explicitly, including
  `box-shadow: none` and `vertical-align: baseline`. Otherwise the host's `kbd` style leaks through:
  VS Code's default webview stylesheet colours `kbd` with its keybinding colours and adds an inset
  shadow and `vertical-align: middle` (see [VS Code: host hygiene](#vs-code-host-hygiene)).

## Zoom panel

### Readout

**Guide [§5.8][guide-5.8], [§2][guide-2].** Rule: the readout shows the zoom as a whole percentage in
the UI language (English "86%", German "86 %" with a no-break space) and follows every zoom change; its
`aria-label` names target and state ("Zoom to 100% (now 86%)").

- Format with `new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 })`, `lang`
  being the tool's language (`<html lang>` in its own document, see the next bullet for a foreign
  page). For German it puts U+00A0 (no-break space) before the percent sign.
  Every other number in the chrome ("2 problems") goes through `Intl` with the same language (guide
  §2: one language per tool).
- In a foreign page the page's `<html lang>` may name another language than the tool's. There the
  shell root carries the tool's `lang` itself (guide §2), so read the language with
  `root.closest("[lang]").lang`, not from `document.documentElement`.
- Update after `canvas.viewbox.changed`, reading `canvas.zoom()` at most once per animation frame
  (`requestAnimationFrame`).
- If a modeler enables `canvas.deferUpdate`, diagram-js debounces `canvas.viewbox.changed` by 300ms,
  and the readout would lag. `canvas.viewbox.changing` still fires synchronously before every change:
  schedule the frame read from it as well; by the time the frame runs, the change is applied.

### Steps

**Guide [§5.8][guide-5.8].** Rule: buttons and keys zoom in fixed steps (22, 30, 41, 55, 74, 100, 135,
182, 246, 331 %) plus the limits 20 and 400 %, which are not steps (from 20 % zoom in goes to 30 %, from
400 % zoom out to 331 %); the mouse wheel uses the same steps plus the half steps between them and zooms
only with Ctrl (on macOS also Cmd) or a pinch; a step starts from the nearest full step, at a wheel half
step from either neighbour (86 % zooms in to 135 %, 64 % to 74 %); buttons and keys zoom around the
container centre, the wheel around the pointer.

- Buttons and keys call `zoomScroll.stepZoom(±1)`. Using `stepZoom` is what keeps buttons and wheel
  on one raster. The shell adds no rounding of its own.
- The raster: `ZoomScroll` has a fixed `RANGE = { min: 0.2, max: 4 }` and `NUM_STEPS = 10`. One step
  is `log10(20) / 10` in log space, a factor of `20^(1/10) ≈ 1.349`. The raster is anchored at 100 %
  (`log10(1) = 0`): full steps are 22.4, 30.2, 40.7, 54.9, 74.1, 100, 134.9, 182.1, 245.6 and
  331.4 %; 20 % and 400 % are not on it and are only reached by capping (`cap(RANGE, …)`).
- The wheel (`ZoomScroll#zoom`) uses half that step (26.0, 35.0, 47.3, 63.8, 86.1, 116.2 % and so on),
  one half step each time the accumulated wheel delta exceeds 0.1. diagram-js zooms with the wheel
  only with Ctrl (or Cmd on macOS) or a trackpad pinch, which browsers report as `wheel` with
  `ctrlKey`; a plain wheel pans. The wheel listener is only bound while the pointer is over the canvas.
- `ZoomScroll#_zoom` first snaps the current zoom to the nearest step
  (`Math.round(log10(zoom) / step) * step`) and then moves one step. That gives the guide's examples:
  95 % after a fit goes to 135 % (zoom in) or 74 % (zoom out); 86 % after one wheel notch goes to
  135 % on zoom in.
- The snap explains the guide's edge cases:
  - A wheel half step lies exactly between two full steps, and `canvas.zoom()` is rounded to three
    decimals, so the rounding decides which neighbour wins: 86.1 % snaps up (zoom in → 135 %), 63.8 %
    snaps down (zoom in → 74 %).
  - 20 % snaps to the 22.4 % step (zoom in → 30 %); 400 % snaps to the 447 % step beyond the limit
    (zoom out → 331 %). The wheel half step 385 % snaps down to 331 % (zoom out → 246 %).
- `stepZoom` without a position calls `canvas.zoom(scale)`, which zooms around the centre of the whole
  canvas container (`outer.width / 2`, `outer.height / 2`), not of the free rectangle. The wheel
  passes the pointer position. 100 % is `canvas.zoom(1)`, also around the container centre.

### Limits

**Guide [§5.8][guide-5.8].** Rule: zoom out is disabled at 20 % and below, zoom in at 400 %; zoom out
never zooms in.

- 20 % and 400 % are `ZoomScroll`'s fixed `RANGE` (0.2 to 4); it is not configurable through
  `config.zoomScroll`.
- Disable zoom out when `canvas.zoom()` is at most `0.2 * 1.001`, zoom in when it is at least
  `4 * 0.999`. The getter returns the scale rounded to three decimals (`round(matrix.a, 1000)`), and
  the tolerance absorbs that and floating-point noise at the limits.
- Below 20 % (possible after fitting a large diagram) `stepZoom(-1)` snaps, steps down and then caps
  the result to 20 %, which zooms in. That is why zoom out is already disabled below the limit, not
  only at it.

### Key matching

**Guide [§5.8][guide-5.8].** Rule: only Cmd/Ctrl + `+`/`=`, `-`/`_` and `0` (also with Shift and on the
numpad) and Shift+1 act; Cmd and Ctrl both work on every platform; nothing acts with Alt, during IME
composition or in a text field (every input field, select list and editable text: label editor,
inspector, dialog and popover fields).

- "Cmd/Ctrl" is `event.metaKey || event.ctrlKey` on every platform, like `isCmd` in diagram-js
  (`KeyboardUtil`), which also returns `false` whenever `altKey` is set because Windows reports AltGr
  as Ctrl+Alt.
- `+`/`=` and `-`/`_` are matched by the produced character (`event.key`), with or without Shift.
- Numpad keys are matched by `event.code`: `NumpadAdd`, `NumpadSubtract`, `Numpad0`. `code` also
  covers Numpad0 with NumLock off, where `key` is `"Insert"`.
- Fit is matched by `event.code === "Digit1"` with `shiftKey` and without `metaKey`, `ctrlKey` and
  `altKey`, so it is the physical 1 key of the number row on every keyboard layout (`key` is `"!"` on
  US and German layouts, but `"1"` on French AZERTY).
- Ignore every shortcut with `altKey` or while `event.isComposing` is true.
- A text field is `input`, `textarea`, `select` or `[contenteditable]`: check the event target with
  `target.closest("input, textarea, select")` or `target.isContentEditable`; this covers the label
  editor and the fields of inspector, dialogs and popovers. There the zoom keys do not zoom and
  Shift+1 types `!`.
- Unmodified `+`/`-` must not be bound anywhere, also not in a modeler's own keyboard module.

### One place for the keys

**Guide [§5.8][guide-5.8].** Rule: every press of a zoom key acts exactly once, also where diagram-js or
the modeler know the same key.

- diagram-js binds Cmd/Ctrl + `+`/`=`, `-` and `0` itself on the focused canvas `<svg>` as soon as
  the editor actions `stepZoom` and `zoom` are registered (`KeyboardBindings`, default priority
  1000). Its `Keyboard` service calls only `preventDefault()` on a handled key, never
  `stopPropagation()`, so the event still bubbles to `document`.
- The shell registers `keyboard.addListener(2000, listener)` and returns `true` for the chrome keys.
  A non-`undefined` return value stops the diagram-js event bus, so `KeyboardBindings` and the
  modelers' keyboard modules (default priority 1000) never see these keys, and no key zooms twice.
- The keys are executed only in the shell's own DOM listener (see
  [Where the listener listens](#where-the-listener-listens)). It handles them regardless of
  `defaultPrevented`, because diagram-js's `Keyboard` has called `preventDefault()` on every key a
  listener returned a value for, including the shell's own.

### Where the listener listens

**Guide [§5.8][guide-5.8].** Rule: in its own document the keys work wherever the focus is, except in
text fields and while a dialog is open; embedded in a foreign page only while the focus is inside the
modeler. In the web app Cmd/Ctrl + `+`, `-` and `0` zoom the diagram, not the page, except in text
fields and dialogs.

- Own document (VS Code webview, web app, iframe): one `keydown` listener on `document`, bubble
  phase. The diagram-js keyboard on the `<svg>` has run by then, so `defaultPrevented` tells the
  shell which keys the canvas handled.
- The listener does not execute the chrome keys while the focus is in a text field or a modal dialog
  (guide §8, `[role="dialog"][aria-modal="true"]`) is open. Popovers are `role="dialog"` without
  `aria-modal` and do not block the keys. In VS Code the listener still stops the blocked keys and
  the keys the canvas handled (see [VS Code: key interception](#vs-code-key-interception)).
- Foreign page (embedded without iframe): the listener sits on the shell root. `keydown` is
  dispatched to the focused element, so it only reaches the root while the focus is inside it.
- Web app: call `preventDefault()` on Cmd/Ctrl + `+`, `-` and `0` unless the focus is in a text field
  or a dialog, so the browser does not zoom the page. In text fields and dialogs do nothing: the
  browser zooms the page. Zooming via the browser menu always stays possible.
- What the listener additionally stops in an IDE host: see
  [VS Code: key interception](#vs-code-key-interception).

### Shortcut labels

**Guide [§5.8][guide-5.8], [§5.6][guide-5.6].** Rule: tooltips show the labels of the machine the user
sits at, also when VS Code works on another system over Remote: on macOS `⌘+`, `⌘−`, `⌘0`, `⇧1`,
elsewhere `Ctrl+Plus`, `Ctrl+Minus`, `Ctrl+0`, `Shift+1` (German `Strg`, `Umschalt`); "Plus" because `=`
is not on the plus key of German keyboards. `aria-keyshortcuts` follows the same platform, with WAI-ARIA
key names.

- Read the platform in the webview or page itself, in every host:
  `navigator.userAgentData?.platform ?? navigator.platform`, macOS if it matches `/mac/i`. The webview
  always runs on the client, so its own `navigator` reports the keyboard in front of the user.
- Do not label shortcuts from `process.platform` in the extension: with VS Code Remote (SSH, WSL, Dev
  Containers) a custom-editor extension usually runs on the remote machine, so `process.platform`
  names the remote OS. See [Open verification points](#open-verification-points).
- `aria-keyshortcuts` values (WAI-ARIA 1.2: modifiers first, then the key pressed, named by its
  unshifted character, the plus sign as `Plus`; `code` names such as `Equal` are invalid): zoom in
  `Meta+= Meta+Plus`, zoom out `Meta+-`, 100 % `Meta+0`, fit `Shift+1`; outside macOS `Control`
  instead of `Meta`.

## Fit

### Fit math

**Guide [§5.9][guide-5.9].** Rule: fit shows the whole content centred in the free rectangle (the
container minus the fit insets and whatever is open), never above 100 %.

- Do not use `canvas.zoom("fit-viewport")`: it knows no insets, and a diagram that already fits is
  aligned to the origin instead of being centred.
- Compute the viewbox and set it with `canvas.viewbox(box)`. The setter uses
  `scale = min(outer.width / box.width, outer.height / box.height)` and puts `box.x`/`box.y` at the
  top-left corner, so pass a box with the container's aspect ratio:

  ```ts
  const size = canvas.getSize(); // client size of the canvas container
  const free = {
    width: size.width - insets.left - insets.right,
    height: size.height - insets.top - insets.bottom,
  };
  const scale = Math.min(1, free.width / bounds.width, free.height / bounds.height);
  canvas.viewbox({
    x: bounds.x + bounds.width / 2 - (insets.left + free.width / 2) / scale,
    y: bounds.y + bounds.height / 2 - (insets.top + free.height / 2) / scale,
    width: size.width / scale,
    height: size.height / scale,
  });
  ```

- `bounds` are the content bounds the modeler supplies. The insets (guide §5.9):
  - top `--cd-shell-einpassen-oben` (88px), with the palette in the second row
    `--cd-shell-einpassen-oben-schmal` (140px);
  - left and right `--cd-shell-einpassen-seite` (24px);
  - bottom `--cd-shell-einpassen-unten` (64px); in the web app while the problems pill is shown
    `--cd-shell-einpassen-unten-web` (92px) instead. The pill is not measured on top of that;
  - right with an open inspector (container wider than 760px): 324px (12 + 288 + 24);
  - left with an open legend (container wider than 440px): 12 + the legend's rendered width + 24; up
    to 440px the legend does not count;
  - bottom with an open bottom sheet (up to 760px): the distance from the container's bottom edge to
    the sheet's top edge, plus 12.
- Animated fit (explicit fit only, 250ms, guide §5.9): diagram-js has no animated viewbox change.
  Interpolate the viewbox in `requestAnimationFrame` (the scale in log space) and set each frame with
  `canvas.viewbox(box)`. Record the target as the last fitted box before the first frame, and cancel
  the animation on `wheel`, `pointerdown` or a zoom key.

### Resize

**Guide [§5.9][guide-5.9].** Rule: when the container size changes (split, side bar, bottom panel), the
view refits until the user has zoomed or panned; a 0 × 0 container (hidden tab) does not count.

- Observe the container with a `ResizeObserver` and coalesce the entries to one per animation frame.
- Then call `canvas.resized()`: diagram-js caches the viewbox including the container size
  (`_cachedViewbox`), and `resized()` drops that cache and fires `canvas.resized` (the palette
  re-lays itself out on it). Refit if the view is still automatic.
- Skip entries with width or height 0 (hidden tab, see [VS Code: host hygiene](#vs-code-host-hygiene),
  `retainContextWhenHidden`).

### Detecting a user move

**Guide [§5.9][guide-5.9].** Rule: every viewbox change that does not come from fitting or from
restoring after an import counts as a user move (pan, wheel, zoom buttons, keys, 100 %); only an
explicit fit (button, Shift+1, command) makes the view automatic again.

- On every `canvas.viewbox.changed`, compare the event's viewbox with the last box the shell set
  itself (fit or restore), with a relative tolerance of 1/1000. If it differs, the user moved the
  view.
- Compare `x`, `y` and `scale`, not `width` and `height`: those change with the container size, and a
  resize must not count as a move. The getter rounds the transform to three decimals, which is why an
  exact comparison would fail.
- Do not count own changes with a flag or counter around the fit: with `canvas.deferUpdate` diagram-js
  emits `canvas.viewbox.changed` up to 300ms later (debounced), so the delayed event would be
  attributed to the user. During a fit animation without `deferUpdate`, ignore the synchronous
  intermediate events until the animation ends or is cancelled.
- A restore after an import (guide §5.9: external changes keep viewbox and selection) updates the
  reference box but does not reset the "user moved" state.

## Legend state

**Guide [§5.10][guide-5.10].** Rule: the host remembers whether the legend is open, in VS Code also
across a window reload, in the web app across sessions.

- VS Code: `vscode.setState`, together with the viewbox (see [VS Code: state](#vs-code-state)).
- Web app: `localStorage`. Wrap the access in `try`/`catch`: it throws when storage is blocked.

## Status box

**Guide [§5.12][guide-5.12].** Rule: the 4px status bar runs straight over the full height and does not
bend at the rounded corner.

Draw the bar as its own element (`::before`, absolutely positioned over the full height:
`top: 0; bottom: 0; left: 0; width: 4px`). A `border-left` follows the border radius and turns into a
crescent at the rounded corners.

## Layers

**Guide [§5.13][guide-5.13].** Rule: everything diagram-js shows on the canvas (search, context pad,
popup menu, element tooltips, palette, label editor) stays on canvas layer 0 below every island; within
it the palette lies above context pad and label editor.

- The canvas container gets `isolation: isolate`, so diagram-js's own z-indices stay local to
  layer 0: search 10, context pad 100, popup menu 200, hover tooltips 1000 (`.djs-hover-tooltip`,
  `position: fixed`, which does not escape the stacking context), palette 110 and label editor 100
  (set by the modeler). Once the palette tooltip is replaced (see [Tooltip](#tooltip)), only hover
  sources a modeler registers for canvas elements still use `.djs-hover-tooltip`.
- The islands use the tokens `--cd-shell-ebene-*`: islands 20, inspector 25, top row 30, dropdowns,
  popovers and the chrome tooltip 40, dialog 50, toast 60.
- The shell root gets `isolation: isolate` as well, so these values stay local when the shell is
  embedded in a foreign page.

## Focus order, fonts and forced colours

### Fonts

**Guide [§5.14][guide-5.14].** Rule: chrome text is Geist 13px, buttons and fields included.

Buttons and form fields get `font: inherit`; browsers give them their own control font otherwise
(13.333px, see [VS Code: host hygiene](#vs-code-host-hygiene)).

### Tab order

**Guide [§5.14][guide-5.14], [§12][guide-12].** Rule: menu trigger, primary action, palette, canvas,
then status box, empty-file hint, inspector, bottom left (pill before legend) and bottom right; the DOM
has the same order, so screen readers read the chrome in it, and nothing has a positive `tabindex`.

The resulting DOM order of the shell root:

```html
<div class="cd-shell">
  <button data-chrome="menu">…</button>
  <button data-chrome="primary">…</button>
  <div class="cd-shell-canvas">
    <!-- the element passed to diagram-js as `container`; diagram-js creates .djs-container in it -->
    <div class="djs-container">
      <div class="djs-palette" data-chrome="palette">…</div>
      <svg tabindex="0">…</svg>
    </div>
  </div>
  <div data-chrome="status">…</div>
  <div class="cd-shell-hint">…</div>
  <aside data-chrome="inspector">…</aside>
  <div data-chrome="problems">…</div>
  <div data-chrome="legend">…</div>
  <div data-chrome="zoom" role="group">…</div>
</div>
```

The palette comes before the `<svg>` because the shell moves it there (see [Palette](#palette)); the
primary action exists only in the web app. Dropdowns, popovers and the tooltip live in the layer
element described under [Tooltip](#tooltip) and are reached through their triggers, not by Tab.

### Forced colours

**Guide [§5.14][guide-5.14].** Rule: under forced colours nothing disappears: the active tool and
pressed toggles keep a 2px inner ring in `Highlight`, the status bar shows in `CanvasText`, islands have
a `CanvasText` border, icons stay visible.

- In `@media (forced-colors: active)` the browser removes `box-shadow` and replaces backgrounds. The
  active tool and every toggle with `aria-pressed="true"` therefore get `forced-color-adjust: none`
  and the ring as `box-shadow: inset 0 0 0 2px Highlight`.
- The status bar gets `forced-color-adjust: none` and `background: CanvasText`.
- Islands get `border-color: CanvasText`.
- Icons use `stroke="currentColor"` and so follow the system text colour without extra rules.

## Narrow and low containers

**Guide [§5.15][guide-5.15].** Rule: the breakpoints measure the container: palette in a second row up
to 760px width or when less than 16px would stay free next to a top-row island; inspector as bottom
sheet up to 760px; legend above the bottom row up to 440px; legend starts closed up to 820px height.

- The breakpoints are `@container cd-shell (…)` queries on the shell root. Custom properties cannot be
  used in a container condition, so the queries carry the literal values (`max-width: 760px`,
  `max-width: 440px`, `max-height: 820px`); scripts read the same values from `shell` in
  `cd-tokens.generated.json` (`--cd-shell-schmal`, `--cd-shell-sehr-schmal`, `--cd-shell-niedrig`).
- The 16px gap is measured by script on every container resize and on `palette.changed`. Use the
  palette's intrinsic width (`scrollWidth`), not its current box, so the decision does not flip once
  the palette has moved: the top row fits if `(width - paletteWidth) / 2 >= menuTrigger.right + 16`
  and, where a primary action exists, `(width + paletteWidth) / 2 <= primaryAction.left - 16` (both
  relative to the shell root). In the web app evaluate twice, with the primary action's label and
  then with its icon-only width, because the label goes first.
- The script's result is a state attribute on the shell root (for example
  `data-palette="second-row"`); the second-row CSS applies under the 760px container query or under
  that attribute, and fit uses the matching top inset.
- The palette in the second row scrolls horizontally without a visible scrollbar:
  `overflow-x: auto; scrollbar-width: none`.
- The legend's start state (closed up to 820px height) is state, not style, so it is decided by
  script from the container height (`--cd-shell-niedrig`), not by a container query.

## Appearance decision

**Guide [§13.5][guide-13.5], [§13.3][guide-13.3].** Rule: each host decides in exactly one place; a mode
the modeler cannot show is never shown (a light-only modeler stays light whatever the host reports);
high contrast always passes through.

```ts
type Theme = "light" | "dark";
type Appearance = { theme: Theme; kontrast?: "hoch" };

function resolveAppearance(requested: Appearance, themes: readonly Theme[]): Appearance {
  const theme = themes.includes(requested.theme) ? requested.theme : themes[0];
  return requested.kontrast ? { theme, kontrast: requested.kontrast } : { theme };
}
```

- `requested`: in an IDE host from `ColorThemeKind` (see [VS Code: theme bridge](#vs-code-theme-bridge))
  or the setting `miragon.<modeler>.colorTheme`, in the web app from the stored choice or the system.
- `themes`: reported by the modeler. If it cannot show the requested theme, `themes[0]` wins.
  `kontrast` always passes: under VS Code "High Contrast" (dark) a light-only modeler becomes `light`
  with `hoch`.
- `themes` is a static value of the modeler package (for example an exported `themes` constant) that
  the host reads when it renders the HTML, not from the running instance; the attributes must be
  right before the first paint.
- `resolveAppearance` ships with contract 1.1 in `@miragon/modeler-api`; the host part of the shell
  uses it ([#4](https://github.com/Miragon/modeler-api/issues/4)).
- Shell conformance requests dark from a light-only modeler and asserts that nothing turns dark.

## Appearance in embedded hosts

**Guide [§13.3][guide-13.3].** Rule: an embedded modeler reports which modes it supports, the host never
requests another one, and the mode is view state that never touches the document or exports; until
contract 1.1 an embedded modeler stays light.

- Contract 1.1 adds the optional surface `appearance` with `themes` (supported modes) and `set` (mode
  and contrast); hosts feature-detect it (`if (modeler.appearance)`).
- In a foreign page `set` writes `data-cd-theme` and `data-cd-kontrast` on the modeler's container
  (both on the same element, as the token CSS requires); in its own webview they stay on `<html>`.
- Appearance is view state: `onContentChanged` never fires for it, and it has no effect on
  `exportText` or image exports.

## VS Code host

The VS Code sections below (commands and menu, notifications, undo, key interception, theme bridge,
language, host hygiene, state) implement guide §13.5. In VS Code the extension owns file, document,
history and mode; the webview shows the canvas with the chrome.

## VS Code: commands and menu

**Guide [§13.5][guide-13.5].** Rule: every webview-menu action that makes sense without focus on the
canvas also exists as a command in the Command Palette, and both do exactly the same.

Command and menu entry run the same code. The extension registers the command
(`vscode.commands.registerCommand("<prefix>.fitView", …)`) and posts a message with the command name
to the webview of the active custom editor
(`webviewPanel.webview.postMessage({ type: "command", name: "fitView" })`; track the active panel
with `onDidChangeViewState`). The webview dispatches the name to the same handler as the menu entry.

## VS Code: notifications

**Guide [§13.5][guide-13.5], [§9][guide-9].** Rule: no toasts in the webview; info, warning and error
appear as the host's notification of the same level, only for actions the user triggered, never for an
import.

- The webview posts a message to the extension, which calls `vscode.window.showInformationMessage`,
  `showWarningMessage` or `showErrorMessage`.
- After an export the info carries an action that reveals the file, labelled like VS Code: "Reveal in
  Finder" (`process.platform === "darwin"`), "Reveal in File Explorer" (`"win32"`), "Open Containing
  Folder" (Linux). The action runs the built-in command
  `vscode.commands.executeCommand("revealFileInOS", uri)`.

## VS Code: undo

**Guide [§13.5][guide-13.5].** Rule: the history belongs to the host document; every canvas change is
exactly one document change and one undo step; after a host undo the webview keeps viewbox and
selection; in text fields the field's own undo applies.

- The modeler does not bind Cmd+Z, Cmd+Shift+Z and Ctrl+Y to the diagram-js `commandStack`.
  `KeyboardBindings` binds them (`isUndo`/`isRedo`) as soon as the editor actions `undo` and `redo`
  are registered; a renderer option such as `keyboard.undoRedo: false` keeps them unbound. The keys
  then propagate to `window`, where VS Code's webview host forwards them and VS Code undoes the
  document edit.
- Each canvas change is written as one `WorkspaceEdit` with minimal line changes, applied with
  `vscode.workspace.applyEdit` (one undo step). Multi-step actions (insert example, resize) are one
  edit.
- A host undo comes back to the webview as an external document change
  (`onDidChangeTextDocument`, `reason` is `TextDocumentChangeReason.Undo` or `Redo`). The webview
  re-imports and restores viewbox and selection, no refit (guide §5.9).
- The extension also receives `onDidChangeTextDocument` for its own edits. It recognises these echoes
  (the texts of its pending edits, compared CRLF-tolerant) and does not send them back as an external
  change.
- In text fields of the webview (label editor, inspector, dialog and popover fields) stop Cmd+Z, Cmd+Shift+Z, Cmd+Y and
  Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y with `stopPropagation()` but without `preventDefault()`. VS Code's
  webview host calls `preventDefault()` on every Ctrl/Cmd + Z or Y that reaches `window` and forwards
  it: without the stop the field loses its native undo and VS Code undoes the last document change;
  with `preventDefault()` the field loses its native undo too.

## VS Code: key interception

**Guide [§13.5][guide-13.5].** Rule: a key the webview handles acts only in the webview: VS Code never
sees it and never runs it again (for example as a window zoom); every other key goes on to VS Code.

- VS Code's webview host page listens for `keydown` on the webview's `window` (bubble phase) and
  forwards every event that reaches it to the workbench (`did-keydown`), regardless of
  `defaultPrevented`. The workbench then runs its keybindings: window zoom, copy and paste, select all
  and so on. The one exception is VS Code for the Web: there the host page returns early for
  Cmd/Ctrl + C, X and V, leaves them to the browser and forwards nothing.
- The webview therefore listens with exactly one `keydown` listener on `document` (bubble phase) and
  calls `preventDefault()` and `stopPropagation()` for every key it handles. A listener on `window`
  would come too late: VS Code attaches its listener to the frame's `window` when it creates the
  frame, before the webview's scripts run, so it runs first on that target, and `stopPropagation()`
  does not affect other listeners on the same target.
- Handled keys: the zoom keys (Cmd/Ctrl + `+`, `=`, `-`, `_`, `0`, also with Shift and on the
  numpad) and Shift+1; Escape while a menu, popover or dialog is open; in text fields the undo and
  redo keys, there with `stopPropagation()` only (see [VS Code: undo](#vs-code-undo)). VS Code also
  zooms the window with Cmd/Ctrl+Shift+- and the numpad, so these belong to the list.
- In text fields, during IME composition and with an open dialog the zoom keys do not zoom but are
  still stopped, so VS Code does not zoom the window; Shift+1 stays a character there.
- Cmd/Ctrl+0 belongs to the canvas (100 %) while the webview has focus, although VS Code binds the key
  itself (by default: focus the primary side bar). That is intended.
- A key the canvas has already handled (`event.defaultPrevented`, for example Cmd+A, Cmd+C, Cmd+V from
  diagram-js) is stopped as well. Otherwise VS Code runs it a second time on the webview: on desktop
  (Electron) its host page prevents copy, cut and paste and the workbench dispatches them back to the
  webview (in VS Code for the Web the browser handles them, see above), and select all would select
  the chrome's text. Every other key propagates to VS Code (Cmd+S, Cmd+P, Cmd+W, F1).
- Test: a `keydown` listener on `window` (where VS Code's host page picks keys up) must not see any
  handled key. Acceptance runs in real VS Code with Light, Dark and both High Contrast themes, plus
  Cmd+Shift+- and Cmd+A on the canvas.

## VS Code: theme bridge

**Guide [§13.3][guide-13.3], [§13.5][guide-13.5].** Rule: the webview follows the VS Code color theme
(later the setting `miragon.<modeler>.colorTheme`); the attributes are there before the first paint, and
a theme change switches at once, both attributes in one step, without a fade.

- Signal: `vscode.window.activeColorTheme.kind`, mapped to the requested appearance and then through
  `resolveAppearance` (see [Appearance decision](#appearance-decision)):

  | `ColorThemeKind`      | `data-cd-theme` | `data-cd-kontrast` |
  | --------------------- | --------------- | ------------------ |
  | 1 `Light`             | `light`         |                    |
  | 2 `Dark`              | `dark`          |                    |
  | 3 `HighContrast`      | `dark`          | `hoch`             |
  | 4 `HighContrastLight` | `light`         | `hoch`             |

- Initial: the extension writes `data-cd-theme` and `data-cd-kontrast` into `<html>` when it renders
  the webview HTML, always, also `light`.
- Change: on `vscode.window.onDidChangeActiveColorTheme` and on
  `vscode.workspace.onDidChangeConfiguration`
  (`e.affectsConfiguration("miragon.<modeler>.colorTheme")`) the extension posts the new appearance
  to the webview (`webview.postMessage`). The webview sets both attributes in the same task, with
  transitions disabled for one frame: add a class that sets `transition: none`, change the
  attributes, and remove the class in a nested `requestAnimationFrame`, so the first frame in the new
  mode renders without transitions.
- Hidden tabs: the VS Code API documentation contradicts itself on whether a hidden webview with
  `retainContextWhenHidden` receives messages. Re-send the current appearance from
  `webviewPanel.onDidChangeViewState` when the panel becomes visible again.
- Fallback signal inside the webview: VS Code sets the body classes `vscode-light`, `vscode-dark`,
  `vscode-high-contrast` and `vscode-high-contrast-light`; watch them with a `MutationObserver`. Check
  `vscode-high-contrast-light` first: for backwards compatibility VS Code adds `vscode-high-contrast`
  to High Contrast Light as well, so "High Contrast Light" would otherwise be read as dark. Never use
  the body classes for styling (guide §13.5).

## VS Code: language

**Guide [§13.5][guide-13.5], [§2][guide-2].** Rule: native contributions and webview speak one language;
a localized modeler is localized completely.

- Contributions: `%key%` placeholders in `package.json`, with `package.nls.json` and
  `package.nls.<language>.json`.
- Extension code: `vscode.l10n.t(…)`, with the bundle directory named by `l10n` in `package.json`
  (`bundle.l10n.<language>.json`).
- Webview: the extension passes `vscode.env.language` (and `vscode.l10n.bundle` for the webview's
  strings) to the webview. The webview sets `<html lang>` and its texts from it.

## VS Code: host hygiene

**Guide [§13.5][guide-13.5].** Rule: nothing of VS Code's webview styling shows: no edge padding, no
host colours or fonts, own `kbd`, `code`, links, focus rings and scrollbars; Geist loads in the webview;
a hidden tab keeps its state and neither fits nor measures.

VS Code injects a default stylesheet into every webview. In current releases it sits in
`@layer vscode-default`, so unlayered author rules win regardless of specificity; keep the reset
unlayered (or in a layer declared after it). The defaults and their resets:

- Reset `html` and `body`. VS Code otherwise sets `body { padding: 0 20px }`, the editor text colour
  (`--vscode-editor-foreground`) and its font (`--vscode-font-family`, `--vscode-font-weight`,
  `--vscode-font-size`):

  ```css
  html,
  body {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: var(--cd-ui-grund);
    color: var(--cd-ui-text);
    font:
      400 13px/1.5 "Geist Variable",
      "Geist",
      ui-sans-serif,
      system-ui,
      -apple-system,
      "Segoe UI",
      sans-serif; /* the stack from guide §5.14 */
  }
  ```

- Font: never use `var(--vscode-font-family)`. Wherever the variable is undefined (the same CSS in the
  web app, in tests, in an embedding host), a `var()` without its own fallback makes the whole
  `font-family` declaration invalid at computed-value time: a font list after the `var()` does not
  help, and the browser renders Times.
- `button, input, select, textarea { font: inherit; color: inherit; }`; otherwise buttons render in
  the browser's control font, typically Arial 13.33px.
- Style `kbd` (guide §5.6), `code` and `a` completely yourself (links in `--cd-ui-link`). VS Code's
  defaults colour all three with its own colours: `kbd` with the keybinding-label colours, an inset
  shadow and `vertical-align: middle`; `code` with the preformat colours and the editor's monospace
  font; `a` with the text-link colours.
- Focus: VS Code sets `outline: 1px solid -webkit-focus-ring-color; outline-offset: -1px` on
  `a:focus`, `input:focus`, `select:focus` and `textarea:focus`. Override it with the ring from guide
  §8 (`outline: 2px solid var(--cd-ui-fokus); outline-offset: 2px`). The defaults use `:focus`, not
  `:focus-visible`, so a link focused by mouse still gets VS Code's ring unless the override covers
  `:focus` as well.
- Scrollbars: `html { scrollbar-color: var(--cd-ui-kontur) transparent; }`. VS Code sets its own
  `html { scrollbar-color: … }` from `--vscode-scrollbarSlider-background` and
  `--vscode-editor-background`, plus `::-webkit-scrollbar*` colours. `scrollbar-color` is inherited,
  and once it is set Chromium (121 and later) ignores the `::-webkit-scrollbar` pseudo-elements.
- CSP: if the fonts are bundled as data URLs (as an esbuild `dataurl` loader does), the webview CSP
  needs `font-src ${webview.cspSource} data:`; otherwise Geist does not load and the fallback font
  shows.
- Hidden tabs: register the custom editor with
  `webviewOptions: { retainContextWhenHidden: true }`, so a hidden tab keeps its document, view and
  selection. A hidden tab then reports a 0 × 0 container: skip fitting and measuring while hidden
  (guide §5.9, see [Resize](#resize)).

## VS Code: state

**Guide [§13.5][guide-13.5], [§5.10][guide-5.10].** Rule: legend state and view survive a rebuild of the
webview (for example a window reload); the stored view wins over fitting.

- `const vscode = acquireVsCodeApi()` (it may be called only once per webview). Store whether the
  legend is open and the viewbox with `vscode.setState({ … })` (JSON-serializable), updated after
  `canvas.viewbox.changed` and on every legend toggle.
- On start read `vscode.getState()`. If a viewbox is stored, apply it after the first import instead
  of the automatic first fit, as a restore (see [Detecting a user move](#detecting-a-user-move)).

## Not covered here

These topics stay in the design guide because they are not part of the shell:

- canvas theming with `cd-canvas.css` and the `cd-c-*` role classes (guide §10.2, §10.3; renderers and
  Phase 7 of [#4](https://github.com/Miragon/modeler-api/issues/4) own them);
- light-only export (guide §10.7);
- the token files and the token module (guide §13.1, §13.2);
- the mode recipes for IntelliJ, Electron, Tauri and Theia and the web-app bootstrap script with its
  `localStorage` key (guide §13.3);
- the IntelliJ white-flash fix (guide §13.5).

## Open verification points

To confirm in a real VS Code before the shell's VS Code part is released. Each one is an assumption
the notes rely on that the sources alone do not settle.

- [ ] No handled key reaches a `keydown` listener on `window`: zoom keys including Cmd/Ctrl+Shift+-
      and the numpad, Shift+1, Escape with an open menu, undo and redo in text fields, Cmd/Ctrl+A, C
      and V after the canvas handled them. VS Code never zooms the window.
- [ ] Cmd/Ctrl+0 with focus in the webview sets 100 % and does not focus the side bar.
- [ ] VS Code for the Web: Cmd/Ctrl + C, X and V on the canvas copy, cut and paste exactly once (the
      host page leaves them to the browser and does not forward them).
- [ ] Cmd/Ctrl+Z in the label editor undoes only in the field; the document stays unchanged.
- [ ] One Cmd/Ctrl+Z on the canvas undoes exactly one canvas change; viewbox and selection stay.
- [ ] Light, Dark, High Contrast and High Contrast Light: attributes before the first paint (no
      flash), switching at once, a light-only modeler stays light (with `hoch` under both High
      Contrast themes).
- [ ] High Contrast Light sets both body classes `vscode-high-contrast-light` and
      `vscode-high-contrast` (the reason for the fallback's check order).
- [ ] A theme change while the tab is hidden: does the message arrive in a retained webview? Either
      way the re-send on `onDidChangeViewState` leaves the right mode.
- [ ] A hidden tab with `retainContextWhenHidden` reports 0 × 0 to the `ResizeObserver`; back in
      front, view and selection are unchanged and nothing refits. If VS Code only hides the webview
      without resizing it, skip fitting while `webviewPanel.visible` is `false` instead.
- [ ] Developer: Reload Window: `vscode.getState()` returns legend state and viewbox in the restored
      custom editor, and the stored view wins over the first fit.
- [ ] VS Code Remote (SSH, WSL, Dev Containers) and vscode.dev: the webview's `navigator` reports
      the client's platform (with or without `userAgentData`), so the labels show ⌘ on a Mac client
      even when the extension host runs on Linux or Windows.
- [ ] `revealFileInOS` for a file in a remote workspace: offer the reveal action only where it works.
- [ ] The default webview stylesheet is in `@layer vscode-default` in every VS Code version the
      extension supports (`engines.vscode`); on older versions the reset must win by order. Body
      padding, fonts (no Times, no Arial 13.33px), `kbd`, `code`, links, focus rings and scrollbars
      checked in all four themes.
- [ ] Geist loads from data URLs without a CSP violation (webview developer tools).
- [ ] `vscode.env.language` and `vscode.l10n.bundle` reach the webview, and `<html lang>` matches the
      native contributions.
- [ ] The export notification shows the platform's reveal label and opens the file manager.

To re-check on every diagram-js upgrade, because these notes rely on internals:

- [ ] `ZoomScroll`: `RANGE = { min: 0.2, max: 4 }`, `NUM_STEPS = 10`, the snap in `_zoom`, the wheel
      half step.
- [ ] `Canvas`: `zoom()` rounded to three decimals, `canvas.viewbox.changing` synchronous,
      `deferUpdate` debounce of 300ms, `resized()` dropping the cached viewbox.
- [ ] `Palette`: appended after the `<svg>`, `palette.create` with `{ container }`, full rebuild on
      `palette.changed`, `highlighted-entry` for the active tool.
- [ ] `PaletteTooltip` still registered as `paletteTooltip`; `HoverTooltip` `SHOW_DELAY = 300`.
- [ ] `Keyboard`: bound to the canvas `<svg>`, `preventDefault()` without `stopPropagation()`;
      `KeyboardBindings` at default priority 1000.

[guide]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md
[guide-2]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#2-marken-grundlagen
[guide-5]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#5-abst%C3%A4nde-layout-und-chrome
[guide-5.1]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#51-raster-und-ma%C3%9Fe-als-tokens
[guide-5.2]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#52-app-shell-und-anker
[guide-5.4]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#54-men%C3%BC-oben-links
[guide-5.5]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#55-werkzeugpalette-oben-mitte
[guide-5.6]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#56-tooltip
[guide-5.8]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#58-zoom-panel-unten-rechts
[guide-5.9]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#59-einpassen
[guide-5.10]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#510-unten-links-problem-pill-und-legende
[guide-5.12]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#512-status-kasten-unter-der-palette
[guide-5.13]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#513-ebenen
[guide-5.14]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#514-icons-schrift-fokus-und-bewegung-im-chrome
[guide-5.15]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#515-schmale-und-niedrige-fenster
[guide-9]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#9-feedback-und-zust%C3%A4nde
[guide-12]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#12-checkliste-barrierefreiheit
[guide-13.3]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#133-moduswahl
[guide-13.4]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#134-checkliste
[guide-13.5]: https://github.com/Miragon/corporate-identity/blob/main/plugins/miragon-brand/skills/modeler-tool-design/assets/modeler-design-system.md#135-ide-hosts-vs-code-intellij
