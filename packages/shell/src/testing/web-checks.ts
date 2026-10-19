import {
  MAX_TOASTS,
  SHELL,
  decideTopRow,
  defaultMessages,
  legalLineHeight,
  type Appearance,
  type AppearanceChoice,
  type ShellHost,
  type Size,
  type Theme,
  type ToastStatus,
} from "../core/index.js";
import type { AriaFacts, MenuEntryFacts } from "./facts.js";
import { GEOMETRY_TOLERANCE_PX, boxMismatches, type IslandBox } from "./geometry.js";
import type { ModeChange, RecordedKey } from "./page-tools.js";
import type {
  DropZoneFacts,
  EmptyStateFacts,
  LegalLineFacts,
  LiveRegionFacts,
  PopoverFacts,
  ToastFacts,
  TopRowFacts,
  WebModeFacts,
} from "./web-facts.js";

/*
 * The judgements of the web column (0.2), as pure functions of what the probes in web-facts.ts saw.
 * Each returns readable problems (empty = conforming).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The Miragon legal pages, from the corporate-identity docs-site kit (`miragon/legal.ts`). */
export const MIRAGON_HOME = "https://www.miragon.io/";
export const MIRAGON_IMPRESSUM = "https://www.miragon.io/impressum/";
export const MIRAGON_DATENSCHUTZ = "https://www.miragon.io/datenschutz/";

/** Guide §2: these two stay German in every tool language. */
const GERMAN_LEGAL_LINKS = ["Impressum", "Datenschutz"] as const;

/** Whether the tool speaks English, so the kit may compare names with the shell's default messages. */
export function speaksEnglish(lang: string): boolean {
  return /^en(-|$)/i.test(lang.trim());
}

// ---- aria (extended) ----

/** The primary action's role and name (guide §5.7, §5.15, WCAG 2.5.3). */
export function primaryAriaProblems(facts: AriaFacts, host: ShellHost): string[] {
  const primary = facts.primary;
  if (!primary || host !== "web") return [];
  const problems: string[] = [];
  if (primary.tag !== "button") problems.push(`primary: a <${primary.tag}>, expected a <button>`);
  const label = normalize(primary.attributes["aria-label"] ?? "");
  if (!label) {
    problems.push(
      "primary: no aria-label; it names the action also while the label is collapsed (guide §5.15)",
    );
  } else if (!facts.primaryCollapsed && primary.text && !label.includes(primary.text)) {
    problems.push(
      `primary: the aria-label "${label}" does not contain the visible label "${primary.text}" (WCAG 2.5.3)`,
    );
  }
  if (primary.disabled) {
    problems.push(
      "primary: natively disabled; a disabled primary action keeps the focus with aria-disabled (guide §8)",
    );
  }
  return problems;
}

/** The legal line's landmark and languages (guide §2, §5.10). */
export function legalAriaProblems(facts: AriaFacts, host: ShellHost): string[] {
  if (host !== "web") return [];
  const legal = facts.legal;
  if (!legal) return ['legal: no [data-chrome="legal"] in the web app (guide §5.10)'];
  const problems: string[] = [];
  if (legal.tag !== "nav") problems.push(`legal: the legal line is a <${legal.tag}>, expected a <nav>`);
  if (!normalize(legal.attributes["aria-label"] ?? "")) problems.push("legal: the <nav> has no aria-label");
  for (const text of GERMAN_LEGAL_LINKS) {
    const link = facts.legalLinks.find((candidate) => candidate.text === text);
    if (!link) {
      problems.push(`legal: no "${text}" link (guide §5.10)`);
    } else if (link.lang !== "de") {
      problems.push(
        `legal: "${text}" has ${link.lang === null ? "no lang" : `lang="${link.lang}"`}, expected lang="de" (guide §2: Impressum and Datenschutz stay German)`,
      );
    }
  }
  for (const link of facts.legalLinks) {
    if (link.target !== "_blank") continue;
    const rel = (link.rel ?? "").split(/\s+/);
    if (!rel.includes("noopener") || !rel.includes("noreferrer")) {
      problems.push(`legal: the link "${link.text}" opens a new tab without rel="noopener noreferrer"`);
    }
  }
  return problems;
}

/** The pill as the trigger of the problems list (guide §5.10): web, and embedded when it opens one. */
export function pillPopupAriaProblems(facts: AriaFacts, host: ShellHost): string[] {
  const pill = facts.problems;
  if (!pill || host === "ide") return [];
  const haspopup = pill.attributes["aria-haspopup"];
  if (host === "embedded" && haspopup === undefined) return [];
  const problems: string[] = [];
  if (haspopup !== "dialog") {
    problems.push(
      `problems: the pill has aria-haspopup "${haspopup ?? ""}", expected "dialog" (it opens the problems list)`,
    );
  }
  if (pill.attributes["aria-expanded"] !== "false") {
    problems.push(
      `problems: the pill has aria-expanded "${pill.attributes["aria-expanded"] ?? ""}" while the list is closed, expected "false"`,
    );
  }
  const controls = pill.attributes["aria-controls"];
  if (!controls) {
    problems.push("problems: the pill has no aria-controls");
  } else if (!facts.problemsControlled) {
    problems.push(`problems: aria-controls="${controls}" names no element`);
  } else {
    const role = facts.problemsControlled.attributes.role;
    if (role !== "dialog") {
      problems.push(
        `problems: aria-controls names a ${facts.problemsControlled.description} with role "${role ?? ""}", expected "dialog"`,
      );
    }
    if (facts.problemsControlled.attributes["aria-modal"] === "true") {
      problems.push(
        'problems: the problems list is aria-modal="true"; it is a non-modal popover (guide §5.10)',
      );
    }
  }
  return problems;
}

/** The fixed order of the menu groups (guide §5.4). */
export const MENU_GROUP_ORDER = ["file", "model", "export", "appearance", "help"] as const;

/** The File group's entries in their order, and whether the guide gives each an icon (§5.4, §5.14). */
export const FILE_ENTRIES: ReadonlyArray<{ id: string; icon: boolean }> = [
  { id: "new-diagram", icon: true },
  { id: "open", icon: true },
  { id: "show-example", icon: false },
  { id: "import", icon: true },
];

const APPEARANCE_VALUES: readonly AppearanceChoice[] = ["system", "light", "dark"];

/**
 * The web app's File and Appearance groups (guide §5.4, §13.3): groups in the fixed order, the File
 * group's ids, order and icons, the Appearance radio group of a dark-capable modeler with its three
 * options and exactly the expected one checked; neither group outside the web app.
 */
export function menuGroupProblems(
  entries: readonly MenuEntryFacts[],
  host: ShellHost,
  themes: readonly Theme[],
  choice: AppearanceChoice = "system",
): string[] {
  const problems: string[] = [];
  const file = entries.filter((entry) => entry.group === "file");
  const appearance = entries.filter((entry) => entry.group === "appearance");
  if (host !== "web") {
    const guide =
      host === "ide"
        ? "its file actions are native (guide §13.5)"
        : "the host owns file and mode (guide §5.2)";
    if (file.length > 0) problems.push(`menu: the ${host} host shows a File group; ${guide}`);
    if (appearance.length > 0) problems.push(`menu: the ${host} host shows an Appearance group; ${guide}`);
    return problems;
  }

  const sequence: string[] = [];
  for (const entry of entries) {
    if (entry.group && sequence.at(-1) !== entry.group) sequence.push(entry.group);
  }
  const rank = (group: string) => MENU_GROUP_ORDER.indexOf(group as (typeof MENU_GROUP_ORDER)[number]);
  const ordered = sequence.every((group, index) => index === 0 || rank(sequence[index - 1]!) < rank(group));
  if (!ordered) {
    problems.push(
      `menu: the groups stand in the order ${sequence.join(", ")}; expected File, Model, Export, Appearance, Help (guide §5.4)`,
    );
  }

  const known = FILE_ENTRIES.map((entry) => entry.id);
  for (const entry of file) {
    const spec = FILE_ENTRIES.find((candidate) => candidate.id === entry.menuId);
    if (!spec) {
      problems.push(
        `menu: File entry "${entry.name}" has data-menu-id "${entry.menuId ?? ""}"; the shell builds the File group from ${known.join(", ")}`,
      );
      continue;
    }
    if (entry.role !== "menuitem")
      problems.push(`menu: File entry "${entry.name}" is a ${entry.role}, expected a menuitem`);
    if (spec.icon && !entry.icon) problems.push(`menu: File entry "${entry.name}" has no icon (guide §5.4)`);
    if (!spec.icon && entry.icon) {
      problems.push(
        `menu: File entry "${entry.name}" carries an icon; the guide gives ${entry.menuId} none (guide §5.14)`,
      );
    }
  }
  const fileIds = file.map((entry) => entry.menuId ?? "");
  const expectedIds = known.filter((id) => fileIds.includes(id));
  if (fileIds.join() !== expectedIds.join() && fileIds.every((id) => known.includes(id))) {
    problems.push(
      `menu: the File group reads ${fileIds.join(", ")}; expected the order ${expectedIds.join(", ")} (guide §5.4)`,
    );
  }

  if (themes.includes("dark")) {
    if (appearance.length === 0) {
      problems.push("menu: a dark-capable modeler shows no Appearance group (guide §5.4, §13.3)");
    } else {
      const values = appearance.map((entry) => entry.value ?? "");
      if (values.join() !== APPEARANCE_VALUES.join()) {
        problems.push(
          `menu: the Appearance options are ${values.join(", ")}; expected system, light, dark (guide §13.3)`,
        );
      }
      for (const entry of appearance) {
        if (entry.role !== "menuitemradio" || entry.menuId !== "appearance") {
          problems.push(
            `menu: Appearance option "${entry.name}" is a ${entry.role} in "${entry.menuId ?? ""}"; expected a menuitemradio of the radio group "appearance"`,
          );
        }
      }
      problems.push(...appearanceChoiceProblems(entries, choice));
    }
  }
  return problems;
}

/** The Appearance radio group checks exactly `choice` (`aria-checked`, guide §12). */
export function appearanceChoiceProblems(
  entries: readonly MenuEntryFacts[],
  choice: AppearanceChoice,
): string[] {
  const checked = entries
    .filter((entry) => entry.group === "appearance" && entry.checked === "true")
    .map((entry) => entry.value ?? "");
  return checked.length === 1 && checked[0] === choice
    ? []
    : [
        `menu: the Appearance group checks ${checked.length > 0 ? checked.join(", ") : "nothing"}; expected "${choice}" (aria-checked, guide §12)`,
      ];
}

/** Guide §13.3: a light-only modeler has no Appearance group. */
export function lightOnlyMenuProblems(
  entries: readonly MenuEntryFacts[],
  themes: readonly Theme[],
): string[] {
  if (themes.includes("dark")) return [];
  return entries.some((entry) => entry.group === "appearance" || entry.menuId === "appearance")
    ? ["menu: a light-only modeler shows the Appearance group; it comes with dark (guide §13.3)"]
    : [];
}

// ---- webChrome ----

/** The labelled width of the primary action: its widest measurement while it showed the label. */
export function labelledWidth(samples: readonly TopRowFacts[]): number | undefined {
  const widths = samples.flatMap((sample) =>
    sample.primary && !sample.primary.collapsed && sample.primary.label ? [sample.primary.box.width] : [],
  );
  return widths.length > 0 ? Math.max(...widths) : undefined;
}

/**
 * Guide §5.15 at every measured width: the primary action loses its label before the palette
 * moves to the second row (`decideTopRow` with the measured widths); collapsed it is 40 × 40, keeps
 * its `aria-label` and has no `aria-describedby`. A width where a 1px difference flips the
 * decision is left out.
 */
export function topRowProblems(samples: readonly TopRowFacts[], withLabel: number, name: string): string[] {
  const problems: string[] = [];
  for (const sample of samples) {
    const { container, paletteWidth, menuRight, primary } = sample;
    if (!primary || paletteWidth === null || menuRight === null) continue;
    const decide = (palette: number, labelled: number) =>
      decideTopRow({
        containerWidth: container.width,
        paletteWidth: palette,
        menuRight,
        primary: { withLabel: labelled, iconOnly: SHELL.row },
      });
    const expected = decide(paletteWidth, withLabel);
    const low = decide(paletteWidth - 1, withLabel - 1);
    const high = decide(paletteWidth + 1, withLabel + 1);
    const at = `[${round(container.width)}px wide]`;
    if (
      low.paletteRow === high.paletteRow &&
      low.primaryLabel === high.primaryLabel &&
      expected.paletteRow === low.paletteRow &&
      expected.primaryLabel === low.primaryLabel
    ) {
      const collapsed = expected.primaryLabel === "collapsed";
      if (collapsed && !primary.collapsed) {
        problems.push(
          expected.paletteRow === "top"
            ? `${at} primary: shows its label, but the ${round(paletteWidth)}px palette fits the top row only beside the icon; the label collapses first (guide §5.15)`
            : `${at} primary: shows its label, but it no longer fits next to the menu trigger (data-primary="collapsed", guide §5.15)`,
        );
      }
      if (!collapsed && primary.collapsed) {
        problems.push(`${at} primary: collapsed although its ${round(withLabel)}px label fits (guide §5.15)`);
      }
      if (expected.paletteRow !== sample.paletteRow) {
        problems.push(
          expected.paletteRow === "top"
            ? `${at} palette: in the second row although it fits the top row beside the collapsed primary action; the label collapses first (guide §5.15)`
            : `${at} palette: in the top row although it keeps less than 16px to the primary action even icon only (guide §5.15)`,
        );
      }
    }
    if (primary.collapsed) {
      if (Math.abs(primary.box.width - SHELL.row) > GEOMETRY_TOLERANCE_PX + 1e-6) {
        problems.push(
          `${at} primary: ${round(primary.box.width)}px wide while collapsed, expected ${SHELL.row}px`,
        );
      }
      if (primary.label)
        problems.push(`${at} primary: collapsed, but its label "${primary.label}" still shows`);
      if (primary.ariaLabel !== name) {
        problems.push(
          `${at} primary: the aria-label is "${primary.ariaLabel ?? ""}" while collapsed; it keeps "${name}" (guide §5.15)`,
        );
      }
    } else if (!primary.label) {
      problems.push(`${at} primary: shows no label although the root lacks data-primary="collapsed"`);
    }
    if (primary.describedBy) {
      problems.push(
        `${at} primary: aria-describedby="${primary.describedBy}"; its tooltip repeats the name (API.md, Primary action)`,
      );
    }
  }
  return problems;
}

/** The chrome tooltip of the primary action: only while collapsed, with its label (guide §5.15). */
export function primaryTooltipProblems(
  collapsed: boolean,
  tooltip: string | null,
  name: string,
  width: number,
): string[] {
  const at = `[${round(width)}px wide]`;
  if (collapsed && tooltip === null) {
    return [`${at} primary: no chrome tooltip while collapsed; it shows the label "${name}" (guide §5.15)`];
  }
  if (collapsed && tooltip !== null && !normalize(tooltip).startsWith(name)) {
    return [`${at} primary: the tooltip while collapsed reads "${normalize(tooltip)}", expected "${name}"`];
  }
  if (!collapsed && tooltip !== null) {
    return [
      `${at} primary: a tooltip "${normalize(tooltip)}" while the label shows; only the collapsed action has one`,
    ];
  }
  return [];
}

/** A key on the primary action: a native button turns Enter into one click (guide §5.7). */
export function primaryActivationProblems(clicks: { pointer: number; enter: number }): string[] {
  const problems: string[] = [];
  if (clicks.pointer !== 1)
    problems.push(`primary: a pointer click reached it ${clicks.pointer} times, expected once`);
  if (clicks.enter !== 1) {
    problems.push(
      `primary: Enter on the focused primary action clicked it ${clicks.enter} times, expected once (keyboard activation)`,
    );
  }
  return problems;
}

/** The legal line's content (guide §5.10, docs-site kit `miragon/legal.ts`). */
export function legalContentProblems(links: AriaFacts["legalLinks"]): string[] {
  const problems: string[] = [];
  const [copyright, impressum, datenschutz] = links;
  if (!copyright || !/^©/.test(copyright.text) || !copyright.text.includes("Miragon GmbH")) {
    problems.push(
      `legal: the line starts with "${copyright?.text ?? ""}", expected the copyright "© <year> Miragon GmbH" (guide §5.10)`,
    );
  } else if (copyright.href !== MIRAGON_HOME) {
    problems.push(`legal: the copyright links "${copyright.href}", expected ${MIRAGON_HOME}`);
  }
  const expected: Array<[typeof impressum, string, string]> = [
    [impressum, "Impressum", MIRAGON_IMPRESSUM],
    [datenschutz, "Datenschutz", MIRAGON_DATENSCHUTZ],
  ];
  for (const [link, text, href] of expected) {
    if (link?.text !== text) {
      problems.push(
        `legal: the links read ${links.map((entry) => `"${entry.text}"`).join(", ")}; expected the copyright, "Impressum", "Datenschutz", then the modeler's links (guide §5.10)`,
      );
      break;
    }
    if (link.href !== href) problems.push(`legal: "${text}" links "${link.href}", expected ${href}`);
  }
  return [...new Set(problems)];
}

/**
 * Guide §5.10, WCAG 1.4.10: in the narrowest container every legal link lies whole inside the legal
 * line and the container, so Impressum and Datenschutz are never cut off or scrolled away.
 */
export function legalReachProblems(facts: LegalLineFacts): string[] {
  const legal = facts.legal;
  if (!legal) return [];
  const width = round(facts.container.width);
  const problems: string[] = [];
  for (const link of facts.links) {
    const box = link.box;
    const inside =
      box.left >= Math.max(0, legal.left) - GEOMETRY_TOLERANCE_PX &&
      box.left + box.width <=
        Math.min(legal.left + legal.width, facts.container.width) + GEOMETRY_TOLERANCE_PX &&
      box.top >= legal.top - GEOMETRY_TOLERANCE_PX &&
      box.top + box.height <= legal.top + legal.height + GEOMETRY_TOLERANCE_PX;
    if (!inside) {
      problems.push(
        `legal: [${width}px wide] "${link.text}" is cut off or scrolled out of the legal line; it wraps instead (guide §5.10, WCAG 1.4.10)`,
      );
    }
  }
  return problems;
}

/**
 * The zoom panel's bottom in the web app: 12px, 40px while `data-zoom-row="raised"` (on a legal line
 * that wraps, 8px above its measured `legalHeight`).
 */
export function zoomRowBottomProblems(
  zoom: IslandBox | undefined,
  raised: boolean,
  container: Size,
  legalHeight?: number,
): string[] {
  if (!zoom) return [];
  const bottom = raised ? SHELL.edge + legalLineHeight(legalHeight) + SHELL.gap : SHELL.edge;
  return boxMismatches("zoom", zoom, { bottom }, container).map(
    (problem) => `[${round(container.width)}px wide${raised ? ", raised" : ""}] ${problem}`,
  );
}

// ---- emptyState ----

/** The start screen of guide §8 as `show.emptyState` leaves it. */
export function emptyStateProblems(facts: EmptyStateFacts, container: Size, lang: string): string[] {
  const problems: string[] = [];
  if (!facts.shown)
    problems.push('empty-state: the root lacks data-empty-state="shown" after show.emptyState');
  const card = facts.card;
  if (!card?.visible) return [...problems, "empty-state: the card is not visible after show.emptyState"];
  problems.push(
    ...boxMismatches(
      "empty-state",
      card.box,
      {
        centerX: container.width / 2,
        centerY: container.height / 2,
        width: Math.min(400, container.width - 2 * SHELL.edge),
      },
      container,
    ),
  );
  if (!card.labelledBy) problems.push("empty-state: the card is not labelled by its title (aria-labelledby)");
  if (!facts.komet) {
    problems.push("empty-state: no Komet <img> on the card (guide §2, §8)");
  } else {
    if (facts.komet.alt !== "") {
      problems.push(
        `empty-state: the Komet has ${facts.komet.alt === null ? "no alt" : `alt="${facts.komet.alt}"`}; it is decorative, alt="" (guide §8)`,
      );
    }
    if (Math.abs(facts.komet.width - 64) > 1 || Math.abs(facts.komet.height - 64) > 1) {
      problems.push(
        `empty-state: the Komet is ${round(facts.komet.width)} × ${round(facts.komet.height)}px, expected 64 × 64 (guide §8)`,
      );
    }
  }
  if (facts.heading?.tag !== "h1") {
    problems.push(
      `empty-state: the title is ${facts.heading ? `a <${facts.heading.tag}>` : "missing"}, expected an <h1>`,
    );
  }
  const [primary, ghost, ...rest] = facts.buttons;
  if (!primary) {
    problems.push('empty-state: no "New diagram" button on the card (guide §8)');
  } else {
    if (primary.variant !== "primary") {
      problems.push(
        `empty-state: the first button "${primary.name}" is ${primary.variant ?? "no"} variant, expected the blue primary "New diagram" first (guide §8)`,
      );
    }
    if (ghost && ghost.variant !== "ghost") {
      problems.push(
        `empty-state: the second button "${ghost.name}" is ${ghost.variant ?? "no"} variant, expected the ghost "Show example" (guide §8)`,
      );
    }
    if (rest.length > 0)
      problems.push(
        `empty-state: ${facts.buttons.length} buttons on the card; exactly two actions (guide §8)`,
      );
    for (const button of [primary, ghost]) {
      if (button && Math.abs(button.height - SHELL.entry) > 1) {
        problems.push(
          `empty-state: "${button.name}" is ${round(button.height)}px high, expected ${SHELL.entry}px (guide §8)`,
        );
      }
    }
    if (speaksEnglish(lang)) {
      if (primary.name !== defaultMessages.newDiagram) {
        problems.push(
          `empty-state: the primary button reads "${primary.name}", expected "${defaultMessages.newDiagram}" (guide §2)`,
        );
      }
      if (ghost && ghost.name !== defaultMessages.showExample) {
        problems.push(
          `empty-state: the ghost button reads "${ghost.name}", expected "${defaultMessages.showExample}" (guide §2)`,
        );
      }
    }
  }
  for (const part of facts.work) {
    if (part.visible) {
      problems.push(
        `empty-state: ${part.name} is visible behind the start screen; it hides the work chrome (guide §8)`,
      );
    }
  }
  if (!facts.canvasInert) {
    problems.push(
      "empty-state: the canvas slot is not inert behind the start screen; nothing else takes a click or the Tab (guide §8)",
    );
  }
  if (!facts.legalVisible)
    problems.push("empty-state: the legal line is not visible; a public page always shows it (guide §8)");
  return problems;
}

/** Tab on the start screen: only the card's buttons and the legal links (guide §8). */
export function emptyStateTabProblems(
  owners: ReadonlyArray<{ owner: string; description: string }>,
): string[] {
  const problems: string[] = [];
  for (const stop of owners) {
    if (["empty-state", "legal", "toasts", "body", "outside"].includes(stop.owner)) continue;
    problems.push(
      `empty-state: Tab reaches ${stop.description} (${stop.owner}) behind the start screen; only the card and the legal links take the focus (guide §8)`,
    );
  }
  if (!owners.some((stop) => stop.owner === "empty-state")) {
    problems.push("empty-state: Tab never reaches the card's buttons");
  }
  if (!owners.some((stop) => stop.owner === "legal"))
    problems.push("empty-state: Tab never reaches the legal links");
  return [...new Set(problems)];
}

/**
 * A chrome key behind the start screen (API.md, Empty state): it zooms no diagram, and it reaches
 * the browser unprevented, which zooms the page (WCAG 1.4.4: there is no diagram to zoom instead).
 */
export function emptyStateKeyProblems(
  key: string,
  before: number | null,
  after: number | null,
  keys: readonly RecordedKey[],
): string[] {
  const problems: string[] = [];
  if (after !== before) {
    problems.push(
      `empty-state: ${key} behind the start screen changed the zoom from ${before ?? "?"}% to ${after ?? "?"}%; the chrome keys zoom no diagram there`,
    );
  }
  if (keys.some((recorded) => recorded.defaultPrevented)) {
    problems.push(
      `empty-state: ${key} behind the start screen arrived prevented; with no diagram to zoom the browser keeps its page zoom (WCAG 1.4.4)`,
    );
  }
  return problems;
}

/** After "New diagram": the card gone, the work chrome back, the focus on the canvas (guide §8). */
export function afterStartProblems(
  facts: EmptyStateFacts,
  focus: { owner: string; description: string },
): string[] {
  const problems: string[] = [];
  const after = 'after "New diagram"';
  if (facts.shown) problems.push(`empty-state: ${after} the root still carries data-empty-state="shown"`);
  if (facts.card?.visible) problems.push(`empty-state: ${after} the card still shows`);
  for (const name of ["menu", "palette", "zoom"]) {
    const part = facts.work.find((candidate) => candidate.name === name);
    if (part && !part.visible) problems.push(`empty-state: ${after} the ${name} is still hidden`);
  }
  if (facts.canvasInert) problems.push(`empty-state: ${after} the canvas slot is still inert`);
  if (focus.owner !== "canvas") {
    problems.push(
      `empty-state: ${after} the focus is on ${focus.description}, expected the canvas <svg> (API.md, Empty state)`,
    );
  }
  return problems;
}

// ---- toasts ----

/** How a toast reached screen readers: its live region existed before it, and its text arrived there. */
export interface ToastAnnouncement {
  /** A live region of the toast's role was rendered in the root before the first toast. */
  persistent: boolean;
  /** The toast's text arrived in that region. */
  announced: boolean;
}

/**
 * The live region a toast of `status` is announced through (guide §8, §12): `role="alert"` for
 * errors, `role="status"` (`aria-live="polite"`) otherwise.
 */
export function toastLiveRegion(
  regions: readonly LiveRegionFacts[],
  status: ToastStatus,
): LiveRegionFacts | undefined {
  const role = status === "danger" ? "alert" : "status";
  return regions.find((region) => region.role === role);
}

/**
 * Guide §8, §12: announced through a persistent `role="alert"` (errors) or `role="status"` live
 * region, the card itself without a live role (it would be read twice); Close named "Close".
 */
export function toastAnatomyProblems(
  toast: ToastFacts,
  status: ToastStatus,
  lang: string,
  announcement: ToastAnnouncement,
): string[] {
  const problems: string[] = [];
  const role = status === "danger" ? "alert" : "status";
  if (!announcement.persistent) {
    problems.push(
      `toasts: no role="${role}" live region in the root before the first toast; a live region created together with its text is often not announced (guide §8, §12)`,
    );
  } else if (!announcement.announced) {
    problems.push(
      `toasts: the ${status} toast's text never reaches the role="${role}" live region (guide §8, §12)`,
    );
  }
  if (toast.role === "status" || toast.role === "alert") {
    problems.push(
      `toasts: the ${status} toast's card carries role="${toast.role}"; the live region announces it, so a live card is read twice`,
    );
  }
  const close = toast.buttons.at(-1);
  if (!close || close.text !== "") {
    problems.push(`toasts: the ${status} toast has no Close icon button at its end (guide §8)`);
  } else if (!close.name) {
    problems.push(`toasts: the ${status} toast's Close button has no accessible name`);
  } else if (speaksEnglish(lang) && close.name !== defaultMessages.close) {
    problems.push(
      `toasts: the Close button is named "${close.name}", expected "${defaultMessages.close}" (guide §8)`,
    );
  }
  if (toast.box.height < 40 - GEOMETRY_TOLERANCE_PX) {
    problems.push(
      `toasts: the ${status} toast is ${round(toast.box.height)}px high, at least 40px (guide §8)`,
    );
  }
  return problems;
}

/** Texts of the visible toasts that contain one of `texts`, in stack order. */
export function shownToasts(toasts: readonly ToastFacts[], texts: readonly string[]): string[] {
  return toasts.flatMap((toast) => texts.filter((text) => toast.text.includes(text)));
}

/**
 * The stack after `shown` toasts in this order (the first with an action): at most `MAX_TOASTS`,
 * the oldest without an action evicted, the newest at the bottom, a repeated text not stacked.
 */
export function toastStackProblems(
  toasts: readonly ToastFacts[],
  shown: readonly string[],
  expected: readonly string[],
): string[] {
  const problems: string[] = [];
  const present = shownToasts(toasts, shown);
  if (toasts.length > MAX_TOASTS)
    problems.push(`toasts: ${toasts.length} toasts at once, at most ${MAX_TOASTS} (guide §8)`);
  if (present.join("\u0000") !== expected.join("\u0000")) {
    problems.push(
      `toasts: after ${shown.length} toasts the stack shows ${present.map((text) => `"${text}"`).join(", ") || "none"}; expected ${expected.map((text) => `"${text}"`).join(", ")} (at most ${MAX_TOASTS}, the oldest without an action leaves, guide §8)`,
    );
  }
  const tops = toasts
    .filter((toast) => shown.some((text) => toast.text.includes(text)))
    .map((toast) => toast.box.top);
  if (tops.some((top, index) => index > 0 && top < tops[index - 1]!)) {
    problems.push("toasts: the newest toast is not at the bottom of the stack (guide §8)");
  }
  return problems;
}

/** A repeated request (status and text) restarts the shown toast instead of stacking a second. */
export function repeatedToastProblems(toasts: readonly ToastFacts[], text: string): string[] {
  const count = toasts.filter((toast) => toast.text.includes(text)).length;
  return count > 1
    ? [`toasts: a repeated "${text}" stacks ${count} toasts; it restarts the shown one (API.md, Toasts)`]
    : [];
}

/** How the kit treated a toast before it looked at it again. */
export type ToastCondition = "plain" | "hovered" | "focused" | "resumed" | "action";

export interface ToastTiming {
  text: string;
  expectation: "present" | "gone";
  /** Milliseconds since it appeared, or since pointer and focus left it (`resumed`). */
  after: number;
  present: boolean;
  condition: ToastCondition;
}

const TOAST_RULES: Readonly<Record<ToastCondition, string>> = {
  plain: "it stays for its lifetime",
  hovered: "hover pauses its time",
  focused: "focus pauses its time",
  resumed: "it resumes with at least 1.5s left",
  action: "a toast with an action never closes by itself",
};

/** Guide §8: closing after `toastLifetime` unless hovered or focused; a toast with an action never. */
export function toastTimingProblems(timings: readonly ToastTiming[]): string[] {
  return timings.flatMap((timing) => {
    const since =
      timing.condition === "resumed" ? "after the pointer and the focus left it" : "after it appeared";
    if (timing.expectation === "present" && !timing.present) {
      return [
        `toasts: "${timing.text}" closed within ${timing.after}ms ${since}; ${TOAST_RULES[timing.condition]} (guide §8)`,
      ];
    }
    if (timing.expectation === "gone" && timing.present) {
      return [
        `toasts: "${timing.text}" is still there ${timing.after}ms ${since}; it closes after its lifetime (guide §8)`,
      ];
    }
    return [];
  });
}

// ---- problemsList ----

/** One ArrowDown (or End) in the open problems list: the row it should reach, and the one it did. */
export interface PopoverKeyStep {
  key: string;
  expected: number;
  focused: { index: number; inView: boolean } | null;
}

/**
 * Guide §5.10, §12 (WCAG 2.1.1): the keyboard reaches every row of the problems list, text rows
 * without an element too, and each focused row scrolls into the list's visible part.
 */
export function popoverKeyboardProblems(steps: readonly PopoverKeyStep[], rowCount: number): string[] {
  const problems: string[] = [];
  for (const step of steps) {
    if (step.focused?.index !== step.expected) {
      problems.push(
        `problems-popover: ${step.key} reaches ${step.focused ? `row ${step.focused.index + 1}` : "no row"}, expected row ${step.expected + 1} of ${rowCount}; the keyboard reads every row, text rows too (guide §5.10, WCAG 2.1.1)`,
      );
    } else if (!step.focused.inView) {
      problems.push(
        `problems-popover: row ${step.expected + 1} takes the focus on ${step.key} but stays scrolled out of the list`,
      );
    }
  }
  return problems;
}

/** The problems list once the pill opened it (guide §5.10). */
export function openPopoverProblems(facts: PopoverFacts, container: Size, lang: string): string[] {
  const problems: string[] = [];
  const popover = facts.popover;
  if (!popover?.visible)
    return ["problems-popover: a click on the pill shows no problems list (guide §5.10)"];
  if (popover.attributes.role !== "dialog") {
    problems.push(`problems-popover: role "${popover.attributes.role ?? ""}", expected "dialog"`);
  }
  if (popover.attributes["aria-modal"] === "true")
    problems.push('problems-popover: aria-modal="true"; it is not modal');
  if (!popover.title) {
    problems.push("problems-popover: not labelled by its title (aria-labelledby)");
  } else if (speaksEnglish(lang) && popover.title !== defaultMessages.problemsTitle) {
    problems.push(
      `problems-popover: titled "${popover.title}", expected "${defaultMessages.problemsTitle}" (guide §5.10)`,
    );
  }
  if (facts.pill?.attributes["aria-expanded"] !== "true") {
    problems.push(
      `problems: aria-expanded is "${facts.pill?.attributes["aria-expanded"] ?? ""}" while the list is open, expected "true"`,
    );
  }
  if (facts.rows.length === 0) {
    problems.push("problems-popover: the list has no rows; show.problems passes items in the web host");
  }
  for (const row of facts.rows) {
    if (row.height < SHELL.entry - GEOMETRY_TOLERANCE_PX) {
      problems.push(
        `problems-popover: the row "${row.text}" is ${round(row.height)}px high, at least ${SHELL.entry}px (guide §5.10)`,
      );
    }
    if (!row.icon)
      problems.push(`problems-popover: the row "${row.text}" has no severity icon (guide §5.10)`);
  }
  if (facts.focus !== "popover") {
    problems.push(
      `problems-popover: opening it leaves the focus on ${facts.focused}; it moves to the first row (API.md, Problems popover)`,
    );
  }
  const pill = facts.pill;
  if (pill) {
    problems.push(
      ...boxMismatches(
        "problems-popover",
        popover.box,
        { left: SHELL.edge, bottom: container.height - pill.box.top + SHELL.gap },
        container,
      ),
    );
    if (popover.box.width > Math.min(320, container.width - 2 * SHELL.edge) + GEOMETRY_TOLERANCE_PX + 1e-6) {
      problems.push(
        `problems-popover: width is ${round(popover.box.width)}px, at most ${round(Math.min(320, container.width - 2 * SHELL.edge))}px expected`,
      );
    }
    if (popover.box.height > 320 + GEOMETRY_TOLERANCE_PX + 1e-6) {
      problems.push(`problems-popover: height is ${round(popover.box.height)}px, at most 320px expected`);
    }
  }
  return problems;
}

/** The problems list after a way of closing it (guide §5.10, API.md). */
export function closedPopoverProblems(
  facts: PopoverFacts,
  how: "Escape" | "an outside click" | "a row with an element",
): string[] {
  const problems: string[] = [];
  if (facts.popover?.visible) problems.push(`problems-popover: ${how} does not close the list`);
  if (facts.pill && facts.pill.attributes["aria-expanded"] !== "false") {
    problems.push(
      `problems: aria-expanded is "${facts.pill.attributes["aria-expanded"] ?? ""}" after ${how}, expected "false"`,
    );
  }
  if (how === "Escape" && facts.focus !== "pill") {
    problems.push(`problems-popover: Escape leaves the focus on ${facts.focused}, expected the pill`);
  }
  if (how === "an outside click" && facts.focus === "pill") {
    problems.push(
      "problems-popover: an outside click moved the focus to the pill; it closes without moving the focus",
    );
  }
  if (how === "a row with an element" && facts.focus !== "canvas") {
    problems.push(
      `problems-popover: a row with an element leaves the focus on ${facts.focused}, expected the canvas`,
    );
  }
  return problems;
}

// ---- dropZone ----

export type ExpectedDrop = "over" | "forbidden" | "none";

/** One drag state of guide §9: drag-over, drop forbidden, or a drag the drop zone leaves alone. */
export function dropStateProblems(
  facts: DropZoneFacts,
  expected: ExpectedDrop,
  context: string,
  container: Size,
): string[] {
  const problems: string[] = [];
  const zone = facts.zone;
  const over = facts.events.filter((event) => event.type === "dragover");
  if (expected === "none") {
    if (facts.state !== null)
      problems.push(`drop-zone: ${context} sets data-drop="${facts.state}"; it is no file drag`);
    if (zone?.visible) problems.push(`drop-zone: ${context} shows the drop zone`);
    if (over.some((event) => event.defaultPrevented))
      problems.push(`drop-zone: ${context} is prevented; the drop zone leaves non-file drags alone`);
    return problems;
  }
  if (facts.state !== expected) {
    problems.push(
      `drop-zone: ${context} sets data-drop="${facts.state ?? ""}", expected "${expected}" (guide §9)`,
    );
  }
  if (facts.events.some((event) => !event.defaultPrevented && event.type !== "dragleave")) {
    problems.push(`drop-zone: ${context} is not prevented, so the browser would open the file`);
  }
  const effect = expected === "over" ? "copy" : "none";
  for (const event of over) {
    if (event.dropEffect !== effect)
      problems.push(`drop-zone: ${context} has dropEffect "${event.dropEffect}", expected "${effect}"`);
  }
  if (!zone?.visible) return [...problems, `drop-zone: ${context} shows no drop zone (guide §9)`];
  problems.push(
    ...boxMismatches("drop-zone", zone.box, { left: 12, top: 12, right: 12, bottom: 12 }, container).map(
      (problem) => `${problem} (${context})`,
    ),
  );
  if (zone.ariaHidden !== "true") problems.push('drop-zone: the overlay lacks aria-hidden="true"');
  const fill =
    expected === "over"
      ? ["--cd-ui-hover", facts.roles.hover]
      : ["--cd-ui-danger-flaeche", facts.roles.dangerFlaeche];
  const border =
    expected === "over"
      ? ["--cd-ui-interaktion", facts.roles.interaktion]
      : ["--cd-ui-danger", facts.roles.danger];
  if (zone.background !== fill[1]) {
    problems.push(
      `drop-zone: ${context} fills ${zone.background}, expected ${fill[0]} (${fill[1]}) (guide §9)`,
    );
  }
  if (zone.borderStyle !== "dashed" || zone.borderWidth !== "2px" || zone.borderColor !== border[1]) {
    problems.push(
      `drop-zone: ${context} has a ${zone.borderWidth} ${zone.borderStyle} ${zone.borderColor} border, expected 2px dashed ${border[0]} (${border[1]}) (guide §9)`,
    );
  }
  if (!facts.chip?.text) {
    problems.push(`drop-zone: ${context} shows no chip text (guide §9)`);
  } else if (facts.chip.background !== facts.roles.flaecheHoch) {
    problems.push(
      `drop-zone: the chip fills ${facts.chip.background}, expected --cd-ui-flaeche-hoch (${facts.roles.flaecheHoch})`,
    );
  }
  return problems;
}

// ---- appearance (web) ----

/** What the web app's document carries for `choice` (guide §13.3), computed independently of the shell. */
export interface ExpectedWebMode {
  /** `data-cd-theme` on `<html>`. */
  carrier: Theme | "system";
  /** The mode the page shows under the emulated system preference. */
  effective: Appearance;
}

export function expectedWebMode(
  requested: Appearance,
  themes: readonly Theme[],
  choice: AppearanceChoice,
): ExpectedWebMode {
  const kontrast = requested.kontrast ? { kontrast: requested.kontrast } : {};
  if (!themes.includes("dark")) return { carrier: "light", effective: { theme: "light", ...kontrast } };
  if (choice === "system") return { carrier: "system", effective: { theme: requested.theme, ...kontrast } };
  return { carrier: choice, effective: { theme: choice, ...kontrast } };
}

/**
 * `<html>`, the meta tags and the stored choice of the web app (guide §13.3): light-only static
 * light with one `theme-color` without `media`; dark-capable `system` with `color-scheme` "light
 * dark" and two `theme-color`s by `media`, a fixed choice stored and on both metas.
 */
export function webModeProblems(
  facts: WebModeFacts,
  themes: readonly Theme[],
  choice: AppearanceChoice,
  colors: { light: string; dark: string } | undefined,
): string[] {
  const problems: string[] = [];
  const dark = themes.includes("dark");
  if (!dark) {
    const metas = facts.themeColors;
    if (metas.length !== 1 || metas[0]?.media !== null) {
      problems.push(
        `mode: a light-only web app carries one theme-color without media (guide §13.3); found ${metas.map((meta) => (meta.media ? `${meta.content} (${meta.media})` : meta.content)).join(", ") || "none"}`,
      );
    }
    if (facts.colorScheme !== null && facts.colorScheme.split(/\s+/).includes("dark")) {
      problems.push(`mode: a light-only web app declares color-scheme "${facts.colorScheme}"`);
    }
    return problems;
  }
  const label = choice === "system" ? "System" : choice === "dark" ? "Dark" : "Light";
  const expectedScheme = choice === "system" ? "light dark" : choice;
  if (facts.colorScheme !== expectedScheme) {
    problems.push(
      `mode: with ${label} <meta name="color-scheme"> reads "${facts.colorScheme ?? "(none)"}", expected "${expectedScheme}" (guide §13.3)`,
    );
  }
  const stored = choice === "system" ? null : choice;
  if (!facts.storageBlocked && facts.stored !== stored) {
    problems.push(
      stored === null
        ? `mode: with System localStorage keeps miragon.darstellung="${facts.stored ?? ""}"; System removes the entry (guide §13.3)`
        : `mode: with ${label} localStorage holds miragon.darstellung=${facts.stored === null ? "(none)" : `"${facts.stored}"`}, expected "${stored}" (guide §13.3)`,
    );
  }
  const byMedia = (scheme: "light" | "dark") =>
    facts.themeColors.find((meta) => meta.media?.replace(/\s+/g, "") === `(prefers-color-scheme:${scheme})`);
  const light = byMedia("light");
  const darkMeta = byMedia("dark");
  if (!light || !darkMeta) {
    problems.push(
      "mode: a dark-capable web app carries two theme-color metas, one per prefers-color-scheme (guide §13.3)",
    );
  } else if (colors) {
    const want = choice === "system" ? colors : { light: colors[choice], dark: colors[choice] };
    if (light.content !== want.light || darkMeta.content !== want.dark) {
      problems.push(
        `mode: with ${label} the theme-color metas read ${light.content} (light) and ${darkMeta.content} (dark), expected ${want.light} and ${want.dark} (guide §13.3)`,
      );
    }
  }
  return problems;
}

/** Guide §13.3, §7: one switch changes `<html>` and every meta tag in one frame, transitions off for it. */
export function modeSwitchProblems(changes: readonly ModeChange[], label: string): string[] {
  const relevant = changes.filter((change) => ["theme", "color-scheme", "theme-color"].includes(change.part));
  if (relevant.length === 0) return [`mode: choosing ${label} changed nothing on <html> or its meta tags`];
  const problems: string[] = [];
  const frames = [...new Set(relevant.map((change) => change.frame))];
  if (frames.length > 1) {
    const parts = relevant.map((change) => `${change.part} in frame ${change.frame}`).join(", ");
    problems.push(`mode: choosing ${label} changed ${parts}; one frame for all of them (guide §13.3)`);
  }
  const first = Math.min(...frames);
  if (
    !changes.some(
      (change) => change.part === "no-transition" && change.value === "on" && change.frame === first,
    )
  ) {
    problems.push(
      `mode: choosing ${label} switched without cd-shell-no-transition on <html> in that frame (guide §7: no colour fades)`,
    );
  }
  return problems;
}
