import {
  SHELL,
  decidePaletteRow,
  detectPlatform,
  fitInsets,
  legendStartsOpen,
  resolveMessages,
  type FitLayout,
  type Insets,
  type PaletteRow,
  type Size,
  type Theme,
  type ZoomTarget,
} from "../core/index.js";
import { boxRelativeTo, createElement } from "./element.js";
import { createEmptyHint } from "./hint.js";
import { createInspector } from "./inspector.js";
import { createKeyListener } from "./keys.js";
import { Ledger } from "./ledger.js";
import { createLegend } from "./legend.js";
import { createMenu } from "./menu.js";
import { createProblemsPill } from "./problems.js";
import { createStatusBox } from "./status.js";
import { createTooltip } from "./tooltip.js";
import type {
  InspectorHandle,
  LegendHandle,
  MenuCheckboxEntry,
  MenuHandle,
  PaletteReadOnlyState,
  PaletteRegistration,
  ShellHandle,
  ShellOptions,
  TooltipHandle,
} from "./types.js";
import { createZoomPanel } from "./zoom-panel.js";

// Page-global: every modeler bundles its own copy of the shell (and the CJS entries inline one each),
// and two shells on one foreign page must not share element ids.
const MOUNT_COUNTER = Symbol.for("@miragon/modeler-shell.mounts");

function nextMountIndex(): number {
  const scope = globalThis as unknown as Record<symbol, number | undefined>;
  const index = (scope[MOUNT_COUNTER] ?? 0) + 1;
  scope[MOUNT_COUNTER] = index;
  return index;
}

const DEFAULT_THEMES: readonly Theme[] = ["light"];

// In a foreign page the closest [lang] is the page's language, not the tool's (guide §2).
function languageOf(root: HTMLElement, host: ShellOptions["host"], requested: string | undefined): string {
  if (requested) return requested;
  const declared =
    host === "embedded" ? root.getAttribute("lang") : root.closest("[lang]")?.getAttribute("lang");
  return declared || "en";
}

/** The contrast of the host page around an embedded root: the nearest mode carrier above it. */
function hostKontrast(root: HTMLElement): "hoch" | null {
  const carrier = root.parentElement?.closest("[data-cd-theme], [data-cd-kontrast]");
  return carrier?.getAttribute("data-cd-kontrast") === "hoch" ? "hoch" : null;
}

/**
 * Turns `root` into the shell (`.cd-shell`, container `cd-shell`) and renders the chrome in the
 * DOM order of guide §5.14: menu trigger, canvas slot, status box, empty-file hint, inspector,
 * problems pill, legend, zoom panel, then the layer for dropdown and tooltip. Installs the one
 * `keydown` listener (see `ShellOptions.keyScope`) and the root `ResizeObserver`.
 *
 * `root` must get its size from outside (`container-type: size`): `height: 100%` in an own
 * document, an explicitly sized element in a foreign page. When rendering throws (a modeler's
 * `legend.render`), everything added so far is removed again before the error propagates.
 */
export function mountShell(root: HTMLElement, options: ShellOptions): ShellHandle {
  const themes = options.themes ?? DEFAULT_THEMES;
  if (themes.length === 0) throw new Error("@miragon/modeler-shell: mountShell needs at least one theme");
  const ledger = new Ledger();
  try {
    return renderShell(root, options, themes, ledger);
  } catch (error) {
    ledger.close();
    throw error;
  }
}

function renderShell(
  root: HTMLElement,
  options: ShellOptions,
  themes: readonly Theme[],
  ledger: Ledger,
): ShellHandle {
  const ownerDocument = root.ownerDocument;
  const { host } = options;
  const index = nextMountIndex();
  const messages = resolveMessages(options.messages);
  const platform = options.platform ?? detectPlatform(globalThis.navigator);
  const lang = languageOf(root, host, options.lang);
  const keyScope = options.keyScope ?? (host === "embedded" ? "root" : "document");

  ledger.addClass(root, "cd-shell");
  ledger.attribute(root, "data-cd-shell-host", host);
  ledger.attribute(root, "data-palette", "top");
  if (host === "embedded") {
    ledger.attribute(root, "lang", lang);
    carryOwnMode(root, themes[0] ?? "light", ledger);
  } else {
    ledger.addClass(ownerDocument.documentElement, "cd-shell-document");
  }

  const setState = (name: string, value: string | null): void => {
    if (!ledger.isClosed) ledger.attribute(root, name, value);
  };

  const layer = createElement(ownerDocument, "div", { class: "cd-shell-layer" });
  ledger.defer(() => layer.remove());
  const tooltip = createTooltip({ root, layer, id: `cd-shell-tooltip-${index}` });
  ledger.defer(() => tooltip.destroy());

  /** The lock of `setReadOnly(true)`; `readOnlyShown` its marks, which may follow after a delay. */
  let readOnly = false;
  let readOnlyShown = false;
  let readOnlyTimer: ReturnType<typeof setTimeout> | undefined;
  ledger.defer(() => clearTimeout(readOnlyTimer));

  const legend = options.legend
    ? createLegend({
        ownerDocument,
        messages,
        tooltip,
        titleId: `cd-shell-legend-title-${index}`,
        options: options.legend,
        onChange(open) {
          setState("data-legend", open ? "open" : null);
          placeHint();
          menu.refresh();
        },
        focusAfterClose: () => menu.trigger.focus(),
      })
    : undefined;
  if (legend) ledger.defer(() => legend.destroy());

  const legendEntry: MenuCheckboxEntry | undefined =
    legend && options.legend?.menuEntry !== false
      ? {
          kind: "checkbox",
          id: "legend",
          label: messages.legend,
          checked: () => legend.isOpen(),
          onToggle: (checked) => legend.setOpen(checked),
          keepEnabledWhenReadOnly: true,
        }
      : undefined;
  const shellModelEntries: readonly MenuCheckboxEntry[] = legendEntry ? [legendEntry] : [];

  const menu = createMenu({
    root,
    layer,
    id: `cd-shell-menu-${index}`,
    messages,
    tooltip,
    groups: options.menu ?? {},
    shellModelEntries: () => shellModelEntries,
    isReadOnly: () => readOnly,
  });
  ledger.defer(() => menu.destroy());
  ledger.defer(tooltip.attach(menu.trigger, () => (menu.isOpen() ? null : { label: messages.menu })));

  const canvas = options.canvas ?? createElement(ownerDocument, "div");
  ledger.addClass(canvas, "cd-shell-canvas");
  if (!options.canvas) ledger.defer(() => canvas.remove());

  /** Where the focus goes when the island holding it hides: the canvas, else the menu trigger. */
  function moveFocusOutOf(island: HTMLElement): void {
    if (!island.contains(ownerDocument.activeElement)) return;
    const canvasTarget = canvas.querySelector<HTMLElement | SVGElement>("svg[tabindex]");
    canvasTarget?.focus({ preventScroll: true });
    if (canvasTarget && ownerDocument.activeElement === canvasTarget) return;
    if (!menu.trigger.hidden) menu.trigger.focus({ preventScroll: true });
  }

  const status = createStatusBox(ownerDocument);
  ledger.defer(() => status.destroy());
  const hint = options.emptyHint ? createEmptyHint(ownerDocument, messages, options.emptyHint) : undefined;
  if (hint) ledger.defer(() => hint.destroy());
  const inspector = options.inspector
    ? createInspector(ownerDocument, options.inspector, (open) => {
        setState("data-inspector", open ? "open" : null);
        placeHint();
      })
    : undefined;
  if (inspector) ledger.defer(() => inspector.destroy());
  const pill = options.problems
    ? createProblemsPill({
        ownerDocument,
        messages,
        lang,
        tooltip,
        showTooltip: host === "ide",
        options: options.problems,
      })
    : undefined;
  if (pill) ledger.defer(() => pill.destroy());
  const zoomPanel = createZoomPanel({ ownerDocument, messages, lang, platform, tooltip });
  ledger.defer(() => zoomPanel.destroy());

  root.prepend(menu.trigger, canvas);
  root.append(
    ...[
      status.element,
      hint?.element,
      inspector?.element,
      pill?.element,
      legend?.element,
      zoomPanel.element,
    ].filter((element): element is HTMLElement => element !== undefined),
    layer,
  );

  let palette: { registration: PaletteRegistration; detachTooltip: () => void } | undefined;
  let paletteRow: PaletteRow = "top";

  function containerSize(): Size {
    return { width: root.clientWidth, height: root.clientHeight };
  }

  function menuRight(): number {
    const box = boxRelativeTo(menu.trigger, root);
    return box.width > 0 ? box.x + box.width : SHELL.edge + SHELL.row;
  }

  /** The palette's intrinsic border-box width: it does not shrink once the second row clips it. */
  function paletteWidth(): number {
    const element = palette?.registration.element;
    return element ? element.offsetWidth - element.clientWidth + element.scrollWidth : 0;
  }

  function currentFitInsets(): Insets {
    const container = containerSize();
    const layout: FitLayout = {
      container,
      host,
      paletteRow,
      problemsVisible: pill?.isShown() ?? false,
    };
    if (legend?.isOpen()) layout.legendWidth = legend.element.getBoundingClientRect().width;
    if (inspector?.isOpen()) {
      layout.inspector =
        container.width > SHELL.narrow ? {} : { sheetTop: boxRelativeTo(inspector.element, root).y };
    }
    return fitInsets(layout);
  }

  function placeHint(): void {
    if (hint?.isShown()) hint.place(currentFitInsets());
  }

  function updateLayout(): void {
    if (ledger.isClosed) return;
    const size = containerSize();
    // A hidden tab reports 0 × 0; it neither measures nor decides anything (guide §5.9).
    if (size.width === 0 || size.height === 0) return;
    paletteRow = decidePaletteRow({
      containerWidth: size.width,
      paletteWidth: paletteWidth(),
      menuRight: menuRight(),
    });
    setState("data-palette", paletteRow);
    if (legend && !legend.isStarted()) legend.start(options.legend?.open ?? legendStartsOpen(size.height));
    placeHint();
  }

  const ResizeObserverClass = globalThis.ResizeObserver;
  const resizeObserver = ResizeObserverClass ? new ResizeObserverClass(() => updateLayout()) : undefined;
  resizeObserver?.observe(root);
  ledger.defer(() => resizeObserver?.disconnect());

  if (legend && options.legend?.open !== undefined) legend.start(options.legend.open);
  updateLayout();

  const keyTarget: HTMLElement | Document = keyScope === "root" ? root : ownerDocument;
  const onKeydown = createKeyListener({
    host,
    dialogScope: keyTarget,
    menuOpen: () => menu.isOpen(),
    closeMenu() {
      const active = ownerDocument.activeElement;
      menu.close({ restoreFocus: active === menu.trigger || menu.dropdown.contains(active) });
    },
    hideTooltip: () => tooltip.hide(),
    run: (key) => zoomPanel.run(key),
  });
  keyTarget.addEventListener("keydown", onKeydown as EventListener);
  ledger.defer(() => keyTarget.removeEventListener("keydown", onKeydown as EventListener));

  function readOnlyState(): PaletteReadOnlyState {
    return { locked: readOnly, shown: readOnlyShown };
  }

  function applyReadOnly(): void {
    setState("data-readonly", readOnlyShown ? "" : null);
    palette?.registration.setReadOnly(readOnlyState());
    menu.refresh();
  }

  function showReadOnly(): void {
    readOnlyTimer = undefined;
    if (ledger.isClosed || !readOnly) return;
    readOnlyShown = true;
    applyReadOnly();
  }

  function unregisterPalette(): void {
    if (!palette) return;
    palette.detachTooltip();
    resizeObserver?.unobserve(palette.registration.element);
    palette = undefined;
  }
  ledger.defer(unregisterPalette);

  const menuHandle: MenuHandle = {
    trigger: menu.trigger,
    dropdown: menu.dropdown,
    isOpen: () => menu.isOpen(),
    open: (focus) => menu.open(focus),
    close: (closeOptions) => menu.close(closeOptions),
    refresh: () => menu.refresh(),
    setGroups: (groups) => {
      if (!ledger.isClosed) menu.setGroups(groups);
    },
  };

  const tooltipHandle: TooltipHandle = {
    attach: (control, content) => (ledger.isClosed ? () => {} : tooltip.attach(control, content)),
    hide: () => tooltip.hide(),
  };

  const legendHandle: LegendHandle | undefined = legend && {
    element: legend.element,
    body: legend.body,
    isOpen: () => legend.isOpen(),
    setOpen: (open) => {
      if (!ledger.isClosed) legend.setOpen(open);
    },
    toggle: () => {
      if (!ledger.isClosed) legend.toggle();
    },
  };

  const inspectorHandle: InspectorHandle | undefined = inspector && {
    element: inspector.element,
    isOpen: () => inspector.isOpen(),
    open: () => {
      if (!ledger.isClosed) inspector.open();
    },
    close: () => {
      if (ledger.isClosed) return;
      if (inspector.isOpen()) moveFocusOutOf(inspector.element);
      inspector.close();
    },
  };

  return {
    root,
    canvas,
    host,
    lang,
    platform,
    messages,
    menu: menuHandle,
    tooltip: tooltipHandle,
    legend: legendHandle,
    inspector: inspectorHandle,
    setZoomTarget(target: ZoomTarget | null) {
      if (!ledger.isClosed) zoomPanel.setTarget(target);
    },
    fitInsets: currentFitInsets,
    registerPalette(registration) {
      if (ledger.isClosed) return () => {};
      unregisterPalette();
      palette = {
        registration,
        detachTooltip: tooltip.delegate(registration.element, ".entry", (entry) =>
          registration.entryTooltip(entry),
        ),
      };
      resizeObserver?.observe(registration.element);
      registration.setReadOnly(readOnlyState());
      updateLayout();
      const registered = palette;
      return () => {
        if (palette !== registered) return;
        unregisterPalette();
        updateLayout();
      };
    },
    setProblems(summary) {
      if (ledger.isClosed || !pill) return;
      pill.set(summary);
      setState("data-problems", pill.isShown() ? "shown" : null);
      placeHint();
    },
    setStatus(next, statusOptions) {
      if (!ledger.isClosed) status.set(next, statusOptions?.delayMs ?? 0);
    },
    setEmptyHint(visible) {
      if (ledger.isClosed || !hint) return;
      if (!visible && hint.isShown()) moveFocusOutOf(hint.element);
      hint.setShown(visible);
      placeHint();
    },
    setReadOnly(next, readOnlyOptions) {
      if (ledger.isClosed) return;
      if (!next) {
        clearTimeout(readOnlyTimer);
        readOnlyTimer = undefined;
        readOnly = false;
        readOnlyShown = false;
      } else {
        readOnly = true;
        const delayMs = readOnlyOptions?.delayMs ?? 0;
        // Repeated invalid imports while typing keep the first timer, like the status box.
        if (!readOnlyShown && readOnlyTimer === undefined) {
          if (delayMs > 0) readOnlyTimer = setTimeout(showReadOnly, delayMs);
          else readOnlyShown = true;
        }
      }
      applyReadOnly();
    },
    isReadOnly: () => readOnly,
    destroy() {
      ledger.close();
    },
  };
}

/**
 * An embedded root carries its own mode (guide §13.3): the token CSS resolves the roles on the
 * nearest `[data-cd-theme]`, so without it a light-only modeler would inherit a dark host page and
 * be half-dark against its light-drawn diagram. The root's own `data-cd-theme` would also drop the
 * host's high contrast, so `data-cd-kontrast` is mirrored from the host for as long as it lives.
 */
function carryOwnMode(root: HTMLElement, theme: Theme, ledger: Ledger): void {
  ledger.attribute(root, "data-cd-theme", theme);
  const mirror = (): void => {
    if (ledger.isClosed) return;
    const kontrast = hostKontrast(root);
    if (root.getAttribute("data-cd-kontrast") !== kontrast)
      ledger.attribute(root, "data-cd-kontrast", kontrast);
  };
  mirror();
  const MutationObserverClass = globalThis.MutationObserver;
  if (!MutationObserverClass) return;
  const observer = new MutationObserverClass(mirror);
  observer.observe(root.ownerDocument.documentElement, {
    attributes: true,
    attributeFilter: ["data-cd-theme", "data-cd-kontrast"],
    subtree: true,
  });
  ledger.defer(() => observer.disconnect());
}
