import type { Appearance, ShellHost, Theme } from "../core/index.js";
import { DOM_ORDER, type AppearanceFacts, type AriaFacts, type MenuFacts, type ZoomButton } from "./facts.js";
import type { ElementFacts, LeftoverFacts, RecordedKey } from "./page-tools.js";

/*
 * The judgements of the cases, as pure functions of what the probes saw. Each returns readable
 * problems (empty = conforming), so a case can report all of them at once.
 */

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

const name = (element: ElementFacts): string => normalize(element.attributes["aria-label"] ?? element.text);

const attribute = (element: ElementFacts, key: string): string | undefined => element.attributes[key];

/** `aria-keyshortcuts` of the zoom panel (guide §5.6, WAI-ARIA key names). */
export function expectedKeyShortcuts(platform: "mac" | "other"): Record<ZoomButton, string> {
  const modifier = platform === "mac" ? "Meta" : "Control";
  return {
    in: `${modifier}+= ${modifier}+Plus`,
    out: `${modifier}+-`,
    actual: `${modifier}+0`,
    fit: "Shift+1",
  };
}

/** Roles, names, states, DOM order and tab stops of guide §5.4 to §5.14 and §12. */
export function ariaProblems(facts: AriaFacts, host: ShellHost): string[] {
  const problems: string[] = [];

  if (host === "embedded") {
    if (!facts.rootLang)
      problems.push("root: an embedded shell root carries the tool's lang itself (guide §2, §12)");
  } else if (!facts.documentLang) {
    problems.push("<html> has no lang (guide §2)");
  }

  const trigger = facts.trigger;
  if (!trigger) {
    problems.push('menu: no [data-chrome="menu"] trigger');
  } else {
    if (trigger.tag !== "button")
      problems.push(`menu: the trigger is a <${trigger.tag}>, expected a <button>`);
    if (!attribute(trigger, "aria-label")) problems.push("menu: the icon-only trigger has no aria-label");
    if (attribute(trigger, "aria-haspopup") !== "menu") {
      problems.push(`menu: aria-haspopup is "${attribute(trigger, "aria-haspopup") ?? ""}", expected "menu"`);
    }
    if (attribute(trigger, "aria-expanded") !== "false") {
      problems.push(
        `menu: aria-expanded is "${attribute(trigger, "aria-expanded") ?? ""}" while closed, expected "false"`,
      );
    }
    if (!attribute(trigger, "aria-controls")) {
      problems.push("menu: the trigger has no aria-controls");
    } else if (!facts.controlled) {
      problems.push(`menu: aria-controls="${attribute(trigger, "aria-controls")}" names no element`);
    } else if (attribute(facts.controlled, "role") !== "menu") {
      problems.push(
        `menu: aria-controls names a ${facts.controlled.description} with role "${attribute(facts.controlled, "role") ?? ""}", expected "menu"`,
      );
    }
  }

  if (!facts.palette) {
    problems.push('palette: no [data-chrome="palette"]');
  } else {
    const toolbar = facts.toolbar;
    if (!toolbar || attribute(toolbar, "role") !== "toolbar") {
      problems.push('palette: .djs-palette-entries has no role="toolbar"');
    } else if (!attribute(toolbar, "aria-label")) {
      problems.push("palette: the toolbar has no aria-label");
    }
    for (const entry of facts.entries) {
      const action = attribute(entry, "data-action") ?? entry.description;
      if (attribute(entry, "role") !== "button")
        problems.push(`palette: entry "${action}" has no role="button"`);
      if (!attribute(entry, "aria-label"))
        problems.push(`palette: entry "${action}" has no aria-label (title)`);
      const tabindex = attribute(entry, "tabindex");
      if (tabindex !== "0" && tabindex !== "-1") {
        problems.push(`palette: entry "${action}" has tabindex "${tabindex ?? ""}", expected roving 0/-1`);
      }
    }
    const stops = facts.entries.filter((entry) => attribute(entry, "tabindex") === "0");
    if (facts.entries.length > 0 && stops.length !== 1) {
      problems.push(
        `palette: ${stops.length} entries with tabindex="0", expected exactly one (roving tabindex)`,
      );
    }
    const tools = facts.entries.filter(
      (entry) => entry.group === "tools" && (attribute(entry, "data-action") ?? "").endsWith("-tool"),
    );
    for (const tool of tools) {
      const pressed = attribute(tool, "aria-pressed");
      if (pressed !== "true" && pressed !== "false") {
        problems.push(`palette: tool "${attribute(tool, "data-action")}" has no aria-pressed`);
      }
    }
    const pressed = tools.filter((tool) => attribute(tool, "aria-pressed") === "true");
    if (pressed.length > 1) problems.push(`palette: ${pressed.length} tools are aria-pressed at once`);
  }

  const zoom = facts.zoom;
  if (!zoom) {
    problems.push('zoom: no [data-chrome="zoom"]');
  } else {
    if (attribute(zoom, "role") !== "group") problems.push('zoom: the panel has no role="group"');
    if (!attribute(zoom, "aria-label")) problems.push("zoom: the panel has no aria-label");
    const shortcuts = expectedKeyShortcuts(facts.platform);
    for (const button of ["out", "actual", "in", "fit"] as const) {
      const control = facts.zoomButtons[button];
      if (!control) {
        problems.push(`zoom: no [data-zoom="${button}"] button`);
        continue;
      }
      if (control.tag !== "button") problems.push(`zoom: [data-zoom="${button}"] is a <${control.tag}>`);
      if (!name(control)) problems.push(`zoom: [data-zoom="${button}"] has no accessible name`);
      if (attribute(control, "aria-keyshortcuts") !== shortcuts[button]) {
        problems.push(
          `zoom: [data-zoom="${button}"] aria-keyshortcuts is "${attribute(control, "aria-keyshortcuts") ?? ""}", expected "${shortcuts[button]}" (${facts.platform})`,
        );
      }
      if (control.disabled) {
        problems.push(
          `zoom: [data-zoom="${button}"] is natively disabled; aria-disabled keeps the focus (guide §5.8)`,
        );
      }
    }
    const readout = facts.zoomButtons.actual;
    if (readout) {
      if (!/\d/.test(readout.text))
        problems.push(`zoom: the readout shows "${readout.text}", expected a percentage`);
      const label = normalize(attribute(readout, "aria-label") ?? "");
      if (!label.includes(readout.text)) {
        problems.push(
          `zoom: the readout's aria-label "${label}" does not name the current zoom "${readout.text}"`,
        );
      }
      if (attribute(readout, "aria-disabled") === "true")
        problems.push("zoom: the readout is never disabled");
    }
  }

  const present = new Set(facts.order);
  const expectedOrder = DOM_ORDER.filter((part) => present.has(part));
  if (facts.order.join() !== expectedOrder.join()) {
    problems.push(
      `DOM order is ${facts.order.join(", ")}; expected ${expectedOrder.join(", ")} (guide §5.14)`,
    );
  }
  if (!present.has("canvas")) problems.push("canvas: no diagram-js <svg> (.djs-container > svg) in the root");
  const canvas = facts.canvas;
  if (canvas && !normalize(attribute(canvas, "aria-label") ?? "") && !attribute(canvas, "aria-labelledby")) {
    problems.push(
      'canvas: the focusable <svg> has no accessible name (WCAG 4.1.2); shellModule names it role="application" with messages.canvas',
    );
  }
  for (const element of facts.positiveTabindex)
    problems.push(`positive tabindex on ${element} (guide §5.14)`);
  for (const element of facts.titled) {
    problems.push(`${element} has a native title; the chrome tooltip replaces it (guide §5.6)`);
  }
  return problems;
}

/** The optional islands once the harness showed them. */
export function optionalIslandProblems(facts: AriaFacts, shown: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (shown.has("problems")) {
    const pill = facts.problems;
    if (!pill?.visible) {
      problems.push("problems: the pill is not visible after show.problems");
    } else {
      if (pill.tag !== "button") problems.push(`problems: the pill is a <${pill.tag}>, expected a <button>`);
      const label = normalize(attribute(pill, "aria-label") ?? "");
      if (!label) problems.push("problems: the pill has no aria-label (count and errors)");
      else if (!label.includes(pill.text)) {
        problems.push(`problems: the aria-label "${label}" does not contain the visible text "${pill.text}"`);
      }
    }
  }
  if (shown.has("status")) {
    const status = facts.status;
    if (!status?.visible) {
      problems.push("status: the status box is not visible after show.status");
    } else {
      const role = attribute(status, "role");
      const severity = attribute(status, "data-severity");
      const expected = severity === "danger" ? "alert" : "status";
      if (role !== expected) {
        problems.push(
          `status: role is "${role ?? ""}" for data-severity="${severity ?? ""}", expected "${expected}"`,
        );
      }
    }
  }
  if (shown.has("legend")) {
    const legend = facts.legend;
    if (!legend?.visible) {
      problems.push("legend: the legend is not visible after show.legend");
    } else {
      if (!facts.legendTitle)
        problems.push("legend: the card is not labelled by its title (aria-labelledby)");
      if (!facts.legendClose || !attribute(facts.legendClose, "aria-label")) {
        problems.push("legend: the close button has no aria-label");
      }
    }
  }
  if (shown.has("inspector")) {
    const inspector = facts.inspector;
    if (!inspector?.visible) {
      problems.push("inspector: the inspector is not visible after show.inspector");
    } else {
      if (inspector.tag !== "aside") problems.push(`inspector: a <${inspector.tag}>, expected an <aside>`);
      if (!attribute(inspector, "aria-label")) problems.push("inspector: the <aside> has no aria-label");
    }
  }
  return problems;
}

/** One Tab stop as the kit's tab-sequence probe saw it. */
export interface TabStop {
  description: string;
  /** What the stop is: the palette's roving entry, the canvas `<svg>`, the web app's primary action. */
  kind: "palette" | "canvas" | "primary" | "other";
}

/**
 * Tab from the menu trigger (guide §5.14): the primary action (web app), the palette's one tab
 * stop, then the canvas `<svg>`; nothing else in between (a renderer's own `tabindex` on
 * `.djs-container` would be an extra, unnamed stop).
 */
export function tabSequenceProblems(stops: readonly TabStop[]): string[] {
  const [first, second, third] = stops;
  const sequence = first?.kind === "primary" ? [second, third] : [first, second];
  const [palette, canvas] = sequence;
  const problems: string[] = [];
  if (palette?.kind !== "palette") {
    problems.push(
      `tab order: Tab from the menu trigger lands on ${palette?.description ?? "nothing"}, expected the palette's roving entry (guide §5.14)`,
    );
  } else if (canvas?.kind !== "canvas") {
    problems.push(
      `tab order: Tab from the palette lands on ${canvas?.description ?? "nothing"}, expected the canvas <svg> (an unexpected tab stop, guide §5.14)`,
    );
  }
  return problems;
}

/** A palette entry with the keyboard focus: its tooltip's chip and what it names for assistive technology. */
export interface PaletteShortcutFacts {
  action: string;
  /** Text of the visible tooltip's `kbd` chip; empty without a chip. */
  chip: string;
  keyShortcuts: string | null;
}

/** Guide §5.6: an entry whose tooltip shows a shortcut carries `aria-keyshortcuts`. */
export function paletteShortcutProblems(entries: readonly PaletteShortcutFacts[]): string[] {
  return entries
    .filter((entry) => entry.chip && !entry.keyShortcuts)
    .map(
      (entry) =>
        `palette: entry "${entry.action}" shows the shortcut "${entry.chip}" in its tooltip but has no aria-keyshortcuts (guide §5.6)`,
    );
}

/**
 * The keys an open menu consumes (↑ ↓ Home End, a letter) never reach a `keydown` listener on
 * `document`: a modeler's document keyboard would act on them (Event Storming moves the selection
 * on ↑/↓).
 */
export function menuKeysAtDocumentProblems(
  pressed: readonly string[],
  documentKeys: readonly RecordedKey[],
): string[] {
  const reached = new Set(documentKeys.map((key) => key.key));
  return pressed
    .filter((key) => reached.has(key))
    .map(
      (key) =>
        `menu: ${key} in the open menu reached a keydown listener on document; a modeler's document keyboard acts on it (stop it at the menu, guide §5.4)`,
    );
}

/** An open menu (guide §5.4): expanded trigger, labelled `role="menu"`, named items, focus. */
export function menuOpenProblems(facts: MenuFacts, focus?: "first" | "last"): string[] {
  const problems: string[] = [];
  if (facts.expanded !== "true") {
    problems.push(`menu: aria-expanded is "${facts.expanded ?? ""}" while open, expected "true"`);
  }
  const menu = facts.menu;
  if (!menu) return [...problems, 'menu: no visible role="menu" after opening'];
  if (!attribute(menu, "aria-label")) problems.push("menu: the dropdown has no aria-label");
  if (facts.controls && attribute(menu, "id") !== facts.controls) {
    problems.push(
      `menu: the visible dropdown is #${attribute(menu, "id") ?? ""}, the trigger controls #${facts.controls}`,
    );
  }
  if (facts.items.length === 0) problems.push("menu: the dropdown has no menuitem");
  facts.items.forEach((item, index) => {
    const label = item.name || `item ${index + 1}`;
    if (!item.name) problems.push(`menu: ${label} has no accessible name`);
    if (item.role !== "menuitem" && item.checked !== "true" && item.checked !== "false") {
      problems.push(`menu: "${label}" (${item.role}) has aria-checked "${item.checked ?? ""}"`);
    }
    if (item.role === "menuitemradio" && !item.group) {
      problems.push(`menu: radio "${label}" is not in a labelled role="group"`);
    }
    if (item.haspopup === "dialog" && !item.name.endsWith("…")) {
      problems.push(`menu: "${label}" opens a dialog, so its label ends with "…" (U+2026)`);
    }
  });
  if (focus && facts.items.length > 0) {
    const expected = focus === "first" ? 0 : facts.items.length - 1;
    if (facts.active !== expected) {
      problems.push(
        `menu: focus is on ${facts.active < 0 ? "no entry" : `entry ${facts.active + 1}`}, expected the ${focus} entry`,
      );
    }
  }
  return problems;
}

export function menuClosedProblems(facts: MenuFacts, focusOnTrigger: boolean): string[] {
  const problems: string[] = [];
  if (facts.expanded !== "false")
    problems.push(`menu: aria-expanded is "${facts.expanded ?? ""}" after closing`);
  if (facts.menu) problems.push("menu: the dropdown is still visible after Escape");
  if (focusOnTrigger && !facts.activeIsTrigger)
    problems.push("menu: Escape did not return the focus to the trigger");
  return problems;
}

/**
 * How a key press must arrive at a `keydown` listener on `window` (guide §5.8, §13.5):
 * - `handled`: the shell executes it; IDE: stopped, else it arrives prevented;
 * - `blocked`: recognized but not executed (text field, modal, Escape with a dialog); IDE: stopped,
 *   else it arrives unprevented (the browser, the field or the dialog acts);
 * - `canvas`: the canvas handled it (`defaultPrevented`); IDE: stopped, else it arrives prevented;
 * - `free`: nobody may handle it; it arrives unprevented in every host.
 * In the IDE host a stopped key never reaches `window`, so `prevented` is read on `document`.
 */
export type KeyReach = "handled" | "blocked" | "canvas" | "free";

export interface SeenKeys {
  /** What a listener on `window` saw. */
  keys: readonly RecordedKey[];
  /** What a listener on `document`, registered after the shell's, saw. */
  documentKeys?: readonly RecordedKey[];
}

export function keyReachProblem(
  press: string,
  reach: KeyReach,
  host: ShellHost,
  seen: SeenKeys,
): string | undefined {
  const shouldPrevent = reach === "handled" || reach === "canvas";
  if (host === "ide" && reach !== "free") {
    if (seen.keys.length > 0) {
      return `${press} reached a keydown listener on window; in the IDE host the shell stops it on document, or VS Code runs it again (guide §13.5)`;
    }
    const atDocument = seen.documentKeys ?? [];
    const prevented = atDocument.length === 1 ? atDocument[0]?.defaultPrevented : undefined;
    if (prevented === true && !shouldPrevent) {
      return `${press} was prevented; the shell only stops it, so the field, dialog or browser still acts (guide §13.5)`;
    }
    if (prevented === false && shouldPrevent) {
      return `${press} was stopped but not prevented; a handled key also calls preventDefault`;
    }
    return undefined;
  }
  if (seen.keys.length === 0) {
    return host === "ide"
      ? `${press} never reached window; keys the webview does not handle must go on to VS Code (guide §13.5)`
      : `${press} never reached window; outside the IDE host the shell never stops propagation`;
  }
  if (seen.keys.length > 1) return `${press} reached window ${seen.keys.length} times`;
  const prevented = seen.keys[0]?.defaultPrevented ?? false;
  if (prevented && !shouldPrevent) {
    return `${press} arrived prevented; ${reach === "free" ? "nothing may handle it" : "the browser, the field or the dialog must act"}`;
  }
  if (!prevented && shouldPrevent) {
    return `${press} arrived unprevented; a handled key calls preventDefault (the browser would zoom the page)`;
  }
  return undefined;
}

/** The decision of guide §13.5, computed independently of the shell under test. */
export function expectedAppearance(requested: Appearance, themes: readonly Theme[]): Appearance {
  const fallback = themes[0];
  if (fallback === undefined) throw new Error("@miragon/modeler-shell conformance: harness.themes is empty");
  const theme = themes.includes(requested.theme) ? requested.theme : fallback;
  return requested.kontrast ? { theme, kontrast: requested.kontrast } : { theme };
}

const describeAppearance = (appearance: Appearance): string =>
  appearance.kontrast ? `${appearance.theme} + ${appearance.kontrast}` : appearance.theme;

export interface AppearanceVerdict {
  problems: string[];
}

/**
 * What an embedded root must show (guide §13.3): until contract 1.1 there is no channel to ask
 * it for a mode, so it stays in its first one whatever the page shows, and takes the page's high
 * contrast over from the nearest mode carrier above it.
 */
export function expectedEmbeddedAppearance(facts: AppearanceFacts, themes: readonly Theme[]): Appearance {
  const fallback = themes[0];
  if (fallback === undefined) throw new Error("@miragon/modeler-shell conformance: harness.themes is empty");
  const host = facts.themed.filter((element) => element.relation === "ancestor").at(-1);
  return host?.kontrast === "hoch" ? { theme: fallback, kontrast: "hoch" } : { theme: fallback };
}

/** No half-dark (guide §13.3, §13.5): one mode on `<html>` (own document) or the root (embedded). */
export function appearanceProblems(
  facts: AppearanceFacts,
  host: ShellHost,
  requested: Appearance,
  themes: readonly Theme[],
): AppearanceVerdict {
  const ownDocument = host !== "embedded";
  const expected = ownDocument
    ? expectedAppearance(requested, themes)
    : expectedEmbeddedAppearance(facts, themes);
  const problems: string[] = [];
  const label = ownDocument
    ? `requested ${describeAppearance(requested)}, expected ${describeAppearance(expected)}`
    : `host page ${describeAppearance(requested)}, expected ${describeAppearance(expected)}`;

  const carrier = ownDocument
    ? facts.themed.find((element) => element.isDocument && element.theme !== null)
    : facts.themed.find((element) => element.relation === "self" && element.theme !== null);
  if (!carrier) {
    problems.push(
      ownDocument
        ? `<html> has no data-cd-theme (${label}); the host always writes it, also "light" (guide §13.3)`
        : `the embedded root has no data-cd-theme (${label}): it takes the host page's mode instead of its own (guide §13.3)`,
    );
  } else {
    if (carrier.theme !== expected.theme) {
      problems.push(`${carrier.description} has data-cd-theme="${carrier.theme}" (${label})`);
    }
    if ((carrier.kontrast ?? undefined) !== expected.kontrast) {
      problems.push(
        `${carrier.description} has ${carrier.kontrast ? `data-cd-kontrast="${carrier.kontrast}"` : "no data-cd-kontrast"} (${label})`,
      );
    }
  }
  for (const element of facts.themed) {
    if (element === carrier) continue;
    const stray = ownDocument
      ? !element.isDocument || element.theme === null
      : element.relation === "descendant" || element.relation === "self";
    if (!stray) continue;
    const values = [
      element.theme !== null ? `data-cd-theme="${element.theme}"` : "",
      element.kontrast !== null ? `data-cd-kontrast="${element.kontrast}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const sameMode =
      carrier !== undefined && element.theme === carrier.theme && element.kontrast === carrier.kontrast;
    problems.push(
      element.theme === null
        ? `${element.description} carries ${values} without data-cd-theme on the same element (guide §13.3)`
        : sameMode
          ? `${element.description} repeats ${values}: in an own document the attributes stand only on <html> (guide §13.5)`
          : `${element.description} carries ${values}: a second mode inside the modeler is half-dark (guide §13.5)`,
    );
  }

  if (ownDocument && !facts.documentClasses.includes("cd-shell-document")) {
    problems.push(
      "<html> lacks cd-shell-document in an own document (the reset of the webview's host styles)",
    );
  }
  if (!ownDocument && facts.documentClasses.includes("cd-shell-document")) {
    problems.push(
      "<html> of a foreign page carries cd-shell-document: the own-document reset restyles the host page",
    );
  }

  const reference = facts.parts[0];
  if (reference && !reference.roles["--cd-ui-text"]) {
    problems.push(
      "--cd-ui-text is empty at the shell root: the vendored cd-tokens.generated.css is not loaded",
    );
  }
  for (const part of facts.parts) {
    const schemes = part.colorScheme.split(/\s+/);
    const dark = schemes.includes("dark");
    const light = schemes.includes("light");
    if (expected.theme === "light" && (dark || (carrier && !light))) {
      problems.push(`${part.name}: color-scheme is "${part.colorScheme}" (${label})`);
    }
    if (expected.theme === "dark" && (!dark || light)) {
      problems.push(`${part.name}: color-scheme is "${part.colorScheme}" (${label})`);
    }
    if (reference && part !== reference) {
      for (const [role, value] of Object.entries(part.roles)) {
        if (value !== reference.roles[role]) {
          problems.push(
            `${part.name}: ${role} resolves to "${value}", the root to "${reference.roles[role] ?? ""}" (half-dark)`,
          );
        }
      }
    }
  }
  for (const required of ["dropdown", "tooltip"]) {
    if (!facts.parts.some((part) => part.name === required)) {
      problems.push(`${required}: not visible when the kit opened it, so its mode was not checked`);
    }
  }
  return { problems };
}

/** The root attributes the shell writes (API.md, DOM). */
const SHELL_ROOT_ATTRIBUTES = [
  "data-cd-shell-host",
  "data-palette",
  "data-legend",
  "data-inspector",
  "data-problems",
  "data-readonly",
];

/** What an embedded root carries on top (its own mode). */
const EMBEDDED_ROOT_ATTRIBUTES = ["data-cd-theme", "data-cd-kontrast"];

/** Messages of benign browser reports that are no shell error. */
const BENIGN_ERRORS = /ResizeObserver loop/;

/** Nothing of the shell remains after `destroy` (API.md, `destroy()`). */
export function leftoverProblems(facts: LeftoverFacts, host: ShellHost): string[] {
  const problems: string[] = [];
  for (const element of facts.classedElements) problems.push(`${element} is left after destroy`);
  const ownDocument = host !== "embedded";
  for (const name of facts.documentClasses) {
    if (ownDocument && name === "cd-shell-document") continue;
    problems.push(`<html> keeps the class ${name} after destroy`);
  }
  for (const element of facts.chromeElements) problems.push(`${element} is left after destroy`);
  for (const name of facts.rootClasses) problems.push(`the root keeps the class ${name} after destroy`);
  const written = ownDocument
    ? SHELL_ROOT_ATTRIBUTES
    : [...SHELL_ROOT_ATTRIBUTES, ...EMBEDDED_ROOT_ATTRIBUTES];
  for (const name of facts.rootAttributes) {
    if (written.includes(name)) problems.push(`the root keeps ${name} after destroy`);
  }
  for (const error of facts.errors) {
    if (!BENIGN_ERRORS.test(error)) problems.push(`the page reported an error after destroy: ${error}`);
  }
  return problems;
}

/** After `destroy` no listener of the shell may act on a chrome key any more. */
export function afterDestroyKeyProblem(press: string, recorded: readonly RecordedKey[]): string | undefined {
  if (recorded.length === 0)
    return `${press} after destroy never reached window: a shell listener still stops it`;
  if (recorded.some((key) => key.defaultPrevented)) {
    return `${press} after destroy arrived prevented: a shell listener is still installed`;
  }
  return undefined;
}
