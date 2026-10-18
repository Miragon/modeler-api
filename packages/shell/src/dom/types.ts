import type {
  Insets,
  Platform,
  ShellHost,
  ShellMessageOverrides,
  ShellMessages,
  ZoomTarget,
} from "../core/index.js";
import type { ShellIconName } from "./icons.js";

export interface ShellOptions {
  /** The host column of guide §5.2. */
  host: ShellHost;
  /**
   * The element diagram-js renders into (for example a renderer's `modeler.container`). The shell
   * moves it into its canvas slot and adds `cd-shell-canvas`. Omitted: the shell creates the slot,
   * and the modeler is constructed with `container: handle.canvas`.
   */
  canvas?: HTMLElement;
  /**
   * The tool's UI language (BCP 47) for `Intl` and `<html lang>` (guide §2: one language per tool).
   * Default in an own document (`ide`, `web`): the closest `[lang]` of the root, else `"en"`. In the
   * `embedded` host the page's language is not the tool's, so the default is the root's own `lang`
   * attribute, else `"en"`, and the root carries `lang` itself.
   */
  lang?: string;
  messages?: ShellMessageOverrides;
  /** Platform of the shortcut labels; default `detectPlatform(navigator)`. */
  platform?: Platform;
  /** Where the one `keydown` listener sits; default `document`, `root` in the `embedded` host. */
  keyScope?: "document" | "root";
  /** The fixed menu groups this modeler fills (guide §5.4); omitted groups and empty ones collapse. */
  menu?: MenuGroups;
  /** The problems pill; omitted = the modeler has no diagnostics. */
  problems?: ProblemsOptions;
  /** The legend card; omitted = the notation has no legend. */
  legend?: LegendOptions;
  /** The inspector slot; omitted = the modeler has no inspector. */
  inspector?: InspectorOptions;
  /** The empty-file hint of IDE and embedded hosts (guide §13.5); omitted = no hint. */
  emptyHint?: EmptyHintOptions;
}

/** Rendered in this order, separated by separators: Model, Export, Help (guide §5.4). */
export interface MenuGroups {
  model?: readonly MenuEntry[];
  export?: readonly MenuEntry[];
  help?: readonly MenuEntry[];
}

export type MenuEntry = MenuActionEntry | MenuDialogEntry | MenuCheckboxEntry | MenuRadioGroup;

interface MenuItemBase {
  /** Stable id, rendered as `data-menu-id`. */
  id: string;
  label: string;
  /** Only the entries the guide gives an icon (the common set, guide §5.14). */
  icon?: ShellIconName;
  /** Read whenever the menu opens or `refresh()` runs; disabled entries stay focusable. */
  disabled?: () => boolean;
}

/** `menuitem`: closes the menu, returns focus to the trigger, then runs `onSelect`. */
export interface MenuActionEntry extends MenuItemBase {
  kind: "action";
  /** Shortcut chip text shown on the right, verbatim. */
  shortcut?: string;
  /** Destructive: icon in `--cd-ui-danger` (confirm per guide §9 in `onSelect`). */
  danger?: boolean;
  onSelect(): void;
}

/**
 * `menuitem` with `aria-haspopup="dialog"`; its label ends with "…" (U+2026). Behaves like an
 * action: the menu closes and focus returns to the trigger before `onSelect` opens the dialog.
 */
export interface MenuDialogEntry extends MenuItemBase {
  kind: "dialog";
  onSelect(): void;
}

/** `menuitemcheckbox`: toggles and keeps the menu open; the check mark carries the state. */
export interface MenuCheckboxEntry extends MenuItemBase {
  kind: "checkbox";
  checked(): boolean;
  onToggle(checked: boolean): void;
}

/** A `role="group"` with a heading and `menuitemradio` entries; keeps the menu open. */
export interface MenuRadioGroup {
  kind: "radio";
  id: string;
  /** Heading and group `aria-label`. */
  label: string;
  options: readonly MenuRadioOption[];
  value(): string | undefined;
  onSelect(value: string): void;
  disabled?: () => boolean;
}

export interface MenuRadioOption {
  value: string;
  label: string;
}

export interface ProblemsOptions {
  /** A click on the pill: the IDE host opens its Problems view. */
  onActivate(): void;
}

export interface LegendOptions {
  /** Renders the legend rows into `body` once (classes `cd-shell-legend-*`, see API.md). */
  render(body: HTMLElement): void;
  /** Start state the host remembered; default `legendStartsOpen(container height)`. */
  open?: boolean;
  /**
   * Every change of the open state (close button, menu checkbox, `setOpen`, `toggle`), so the host
   * can persist it; not the automatic start decision.
   */
  onToggle?(open: boolean): void;
  /** Append the "Legend" checkbox to the Model group; default `true`. */
  menuEntry?: boolean;
}

export interface InspectorOptions {
  /** `aria-label` of the inspector `<aside>`. */
  label: string;
}

export interface EmptyHintOptions {
  /** Shows the "Insert example" button; the modeler writes the example as one document change. */
  onInsertExample?(): void;
}

export interface ShellHandle {
  /** The element passed to `mountShell`, now `.cd-shell`. */
  readonly root: HTMLElement;
  /** The canvas slot (`.cd-shell-canvas`), diagram-js's container. */
  readonly canvas: HTMLElement;
  readonly host: ShellHost;
  readonly lang: string;
  readonly platform: Platform;
  /** The resolved messages table. */
  readonly messages: ShellMessages;
  readonly menu: MenuHandle;
  readonly tooltip: TooltipHandle;
  readonly legend: LegendHandle | undefined;
  readonly inspector: InspectorHandle | undefined;
  /** Binds zoom panel, readout and chrome keys; `null` unbinds (buttons disabled). */
  setZoomTarget(target: ZoomTarget | null): void;
  /** The fit insets for what is open right now (palette row, legend, inspector, pill). */
  fitInsets(): Insets;
  /** Adapter API: the diagram-js palette island; returns the unregister function. */
  registerPalette(palette: PaletteRegistration): () => void;
  /** Shows the pill for `count > 0`, hides it at 0. */
  setProblems(summary: ProblemSummary): void;
  /** Shows (after `delayMs`, default 0) or hides (at once) the status box under the palette. */
  setStatus(status: StatusMessage | null, options?: { delayMs?: number }): void;
  /** Shows or hides the empty-file hint. */
  setEmptyHint(visible: boolean): void;
  /**
   * Read-only canvas (invalid file, guide §13.5). `true` locks at once: `isReadOnly()`, the palette
   * veto (every entry but Lasso and Hand) and the Model entries of the menu. `data-readonly` and the
   * `aria-disabled` palette entries show after `delayMs` (default 0; an invalid file passes
   * `INVALID_STATUS_DELAY_MS`, as for `setStatus`), so typing in the text editor does not flicker.
   * Repeated calls while the delay runs keep the first timer; `false` unlocks and hides at once.
   */
  setReadOnly(readOnly: boolean, options?: { delayMs?: number }): void;
  /** The lock, true from the first `setReadOnly(true)` on, also while its marks are still delayed. */
  isReadOnly(): boolean;
  /** Removes every element, attribute, listener, observer and timer the shell added. Idempotent. */
  destroy(): void;
}

export interface MenuHandle {
  readonly trigger: HTMLButtonElement;
  readonly dropdown: HTMLElement;
  isOpen(): boolean;
  /** Opens on the first (default) or last entry. */
  open(focus?: "first" | "last"): void;
  /** Closes; `restoreFocus` moves focus back to the trigger (default `false`). */
  close(options?: { restoreFocus?: boolean }): void;
  /** Re-reads `checked`, `value` and `disabled` (call after an external state change). */
  refresh(): void;
  setGroups(groups: MenuGroups): void;
}

export interface TooltipContent {
  label: string;
  /** Shortcut chip text, verbatim (`⌘+`). */
  shortcut?: string;
}

export interface TooltipHandle {
  /**
   * The chrome tooltip for `control`: after `TOOLTIP_DELAY_MS` hover, at once on keyboard focus,
   * hidden on click, Escape, leave and menu open. Returns the detach function.
   */
  attach(control: HTMLElement, content: TooltipContent | (() => TooltipContent | null)): () => void;
  hide(): void;
}

export interface LegendHandle {
  /** The legend card (`[data-chrome="legend"]`). */
  readonly element: HTMLElement;
  /** Where `render` put the rows. */
  readonly body: HTMLElement;
  isOpen(): boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

export interface InspectorHandle {
  /** The `<aside data-chrome="inspector">`; the modeler renders its fields into it. */
  readonly element: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
}

/** What the diagram-js adapter hands the shell about the palette. */
export interface PaletteRegistration {
  /** The `.djs-palette` element (already carrying `data-chrome="palette"`). */
  element: HTMLElement;
  /** Tooltip of an entry element (`.entry`), from `palette.getEntries()` title and shortcut. */
  entryTooltip(entry: HTMLElement): TooltipContent | null;
  /** The read-only state, on registration and on every `setReadOnly` and its delayed marks. */
  setReadOnly(state: PaletteReadOnlyState): void;
}

/** The read-only canvas as the palette sees it (guide §13.5). */
export interface PaletteReadOnlyState {
  /** Veto every entry but Lasso and Hand on `palette.trigger`, from the invalid import on. */
  locked: boolean;
  /** Mark those entries `aria-disabled` and muted, once the shell's delay has passed. */
  shown: boolean;
}

export interface ProblemSummary {
  count: number;
  /** How many of them are errors; decides icon and wording. */
  errors: number;
}

export type StatusSeverity = "danger" | "warning";

export interface StatusMessage {
  severity: StatusSeverity;
  text: string;
}
