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
  PaletteRegistration,
  ShellHandle,
  ShellOptions,
  TooltipHandle,
} from "./types.js";
import { createZoomPanel } from "./zoom-panel.js";

let mountCount = 0;

// In a foreign page the closest [lang] is the page's language, not the tool's (guide §2).
function languageOf(root: HTMLElement, host: ShellOptions["host"], requested: string | undefined): string {
  if (requested) return requested;
  const declared =
    host === "embedded" ? root.getAttribute("lang") : root.closest("[lang]")?.getAttribute("lang");
  return declared || "en";
}

/**
 * Turns `root` into the shell (`.cd-shell`, container `cd-shell`) and renders the chrome in the
 * DOM order of guide §5.14: menu trigger, canvas slot, status box, empty-file hint, inspector,
 * problems pill, legend, zoom panel, then the layer for dropdown and tooltip. Installs the one
 * `keydown` listener (see `ShellOptions.keyScope`) and the root `ResizeObserver`.
 *
 * `root` must get its size from outside (`container-type: size`): `height: 100%` in an own
 * document, an explicitly sized element in a foreign page.
 */
export function mountShell(root: HTMLElement, options: ShellOptions): ShellHandle {
  const ownerDocument = root.ownerDocument;
  const { host } = options;
  const index = ++mountCount;
  const ledger = new Ledger();
  const messages = resolveMessages(options.messages);
  const platform = options.platform ?? detectPlatform(globalThis.navigator);
  const lang = languageOf(root, host, options.lang);
  const keyScope = options.keyScope ?? (host === "embedded" ? "root" : "document");

  ledger.addClass(root, "cd-shell");
  ledger.attribute(root, "data-cd-shell-host", host);
  ledger.attribute(root, "data-palette", "top");
  if (host === "embedded") ledger.attribute(root, "lang", lang);
  else ledger.addClass(ownerDocument.documentElement, "cd-shell-document");

  const setState = (name: string, value: string | null): void => {
    if (!ledger.isClosed) ledger.attribute(root, name, value);
  };

  const layer = createElement(ownerDocument, "div", { class: "cd-shell-layer" });
  const tooltip = createTooltip({ root, layer, id: `cd-shell-tooltip-${index}` });

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

  const legendEntry: MenuCheckboxEntry | undefined =
    legend && options.legend?.menuEntry !== false
      ? {
          kind: "checkbox",
          id: "legend",
          label: messages.legend,
          checked: () => legend.isOpen(),
          onToggle: (checked) => legend.setOpen(checked),
        }
      : undefined;
  const shellModelEntries: readonly MenuCheckboxEntry[] = legendEntry ? [legendEntry] : [];

  let readOnly = false;
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
  const detachTriggerTooltip = tooltip.attach(menu.trigger, () =>
    menu.isOpen() ? null : { label: messages.menu },
  );

  const canvas = options.canvas ?? createElement(ownerDocument, "div");
  ledger.addClass(canvas, "cd-shell-canvas");
  if (!options.canvas) ledger.defer(() => canvas.remove());

  const status = createStatusBox(ownerDocument);
  const hint = options.emptyHint ? createEmptyHint(ownerDocument, messages, options.emptyHint) : undefined;
  const inspector = options.inspector
    ? createInspector(ownerDocument, options.inspector, (open) => {
        setState("data-inspector", open ? "open" : null);
        placeHint();
      })
    : undefined;
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
  const zoomPanel = createZoomPanel({ ownerDocument, messages, lang, platform, tooltip });

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
      paletteWidth: palette?.registration.element.scrollWidth ?? 0,
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

  function unregisterPalette(): void {
    if (!palette) return;
    palette.detachTooltip();
    resizeObserver?.unobserve(palette.registration.element);
    palette = undefined;
  }

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
      if (!ledger.isClosed) inspector.close();
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
      registration.setReadOnly(readOnly);
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
      hint.setShown(visible);
      placeHint();
    },
    setReadOnly(next) {
      if (ledger.isClosed) return;
      readOnly = next;
      setState("data-readonly", next ? "" : null);
      palette?.registration.setReadOnly(next);
      menu.refresh();
    },
    isReadOnly: () => readOnly,
    destroy() {
      if (ledger.isClosed) return;
      unregisterPalette();
      detachTriggerTooltip();
      menu.destroy();
      zoomPanel.destroy();
      status.destroy();
      hint?.destroy();
      inspector?.destroy();
      pill?.destroy();
      legend?.destroy();
      tooltip.destroy();
      layer.remove();
      ledger.close();
    },
  };
}
