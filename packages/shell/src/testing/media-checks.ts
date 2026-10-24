import { isToolEntry } from "./checks.js";
import type {
  BorderSideFacts,
  BorderedPartFacts,
  FocusRingFacts,
  ForcedColorsFacts,
  ForcedEntryFacts,
  SystemColorFacts,
} from "./media-facts.js";
import type { MotionRecord } from "./page-tools.js";

/*
 * The judgements of the `reducedMotion` and `forcedColors` cases (guide §5.14, §7, §12), as pure
 * functions of what the probes in `media-facts.ts` saw.
 */

/**
 * The longest transition or animation that still counts as none: the guide's reduced-motion rule
 * (§7) and the shell's set every duration to 0.001ms.
 */
export const MOTION_THRESHOLD_MS = 0.01;

/**
 * The most views a click on Fit may show under reduced motion: the view before, the fitted one, and
 * one correction a modeler may still make in the next frame. A glide over the 250ms of §5.9 shows
 * about fifteen.
 */
export const MAX_JUMP_VIEWS = 3;

const durationLabel = (durationMs: number): string =>
  Number.isFinite(durationMs) ? `${Math.round(durationMs * 1000) / 1000}ms` : "no end";

function motionLabel(record: MotionRecord): string {
  if (record.kind === "script")
    return `an element.animate() animation of ${durationLabel(record.durationMs)}`;
  const article = record.kind === "animation" ? "an" : "a";
  return `${article} ${record.kind} of ${durationLabel(record.durationMs)} on "${record.name}"`;
}

/**
 * Guide §5.14 and §7: under reduced motion nothing moves. `styled` lists what computed styles set
 * (a transition the next state change would run), `running` what the page saw run.
 */
export function reducedMotionProblems(
  state: string,
  styled: readonly MotionRecord[],
  running: readonly MotionRecord[],
): string[] {
  const rule = "under reduced motion nothing moves (guide §5.14, §7)";
  return [
    ...styled.map(
      (record) => `motion: ${record.description} sets ${motionLabel(record)} ${state}; ${rule}`,
    ),
    ...running.map(
      (record) => `motion: ${record.description} ran ${motionLabel(record)} ${state}; ${rule}`,
    ),
  ];
}

/** Guide §5.9: under reduced motion an explicit fit jumps. `views` starts with the view before the click. */
export function fitJumpProblems(views: readonly string[]): string[] {
  if (views.length < 2) {
    return [
      "fit: a click on Fit after two clicks on zoom in left the view as it was, so whether it jumps was not verified",
    ];
  }
  if (views.length > MAX_JUMP_VIEWS) {
    return [
      `fit: a click on Fit passed through ${views.length - 1} views; under reduced motion an explicit fit jumps (guide §5.9, §7)`,
    ];
  }
  return [];
}

const SIDES = ["top", "right", "bottom", "left"] as const;

/** A border that shows on every side: at least 1px, a drawn style, in one of the expected colours. */
function borderProblems(
  what: string,
  part: BorderedPartFacts,
  expected: ReadonlyArray<readonly [name: string, color: string]>,
  rule: string,
): string[] {
  const drawn = (side: BorderSideFacts) =>
    side.width >= 1 && !["none", "hidden"].includes(side.style);
  const missing = SIDES.filter((side) => !drawn(part.border[side]));
  if (missing.length > 0) {
    return [
      `forced colours: ${what} (${part.description}) draws no border on its ${missing.join(", ")} side; ${rule}`,
    ];
  }
  const colors = new Set(expected.map(([, color]) => color));
  const wrong = SIDES.filter((side) => !colors.has(part.border[side].color));
  if (wrong.length === 0) return [];
  const names = expected.map(([name, color]) => `${name} (${color})`).join(" or ");
  return [
    `forced colours: ${what} (${part.description}) has its ${wrong.join(", ")} border in ${part.border[wrong[0]!].color}, expected ${names}; ${rule}`,
  ];
}

/** Parts without a border of their own: the legal line is text, the toast stack and the drop zone have their own rules. */
const BORDERLESS_PARTS: ReadonlySet<string> = new Set(["legal", "toasts", "drop-zone"]);

/** Chrome parts that are buttons (the web app's primary action), whose border is ButtonText (guide §8). */
const BUTTON_PARTS: ReadonlySet<string> = new Set(["primary"]);

/**
 * Guide §5.14 under forced colours: every island and the open dropdown keep their border in
 * CanvasText (a button island in ButtonText), the status box keeps its bar in CanvasText, and the
 * icons of the palette's tools stay visible in CanvasText.
 */
export function forcedColorsProblems(facts: ForcedColorsFacts): string[] {
  const { system } = facts;
  const problems: string[] = [];
  for (const part of facts.parts) {
    if (BORDERLESS_PARTS.has(part.name)) continue;
    const expected: Array<readonly [string, string]> = [["CanvasText", system.canvasText]];
    if (BUTTON_PARTS.has(part.name)) expected.push(["ButtonText", system.buttonText]);
    problems.push(
      ...borderProblems(
        part.name === "dropdown" ? "the dropdown" : `island "${part.name}"`,
        part,
        expected,
        "islands keep their border in system colours, nothing disappears (guide §5.14)",
      ),
    );
  }
  if (
    facts.statusBar &&
    (facts.statusBar.width < 1 || facts.statusBar.color !== system.canvasText)
  ) {
    problems.push(
      `forced colours: the status box's bar is ${facts.statusBar.width}px in ${facts.statusBar.color}, expected CanvasText (${system.canvasText}); it stays visible (guide §5.14)`,
    );
  }
  for (const entry of facts.entries) {
    if (!isToolEntry(entry) || entry.disabled || !entry.icon) continue;
    if (entry.icon.color !== system.canvasText) {
      const icon = entry.icon.kind === "svg" ? "<svg> icon" : "::before icon";
      problems.push(
        `forced colours: the ${icon} of tool "${entry.action}" has color ${entry.icon.color}, expected CanvasText (${system.canvasText}); icons stay visible (guide §5.14)`,
      );
    }
  }
  return problems;
}

/** One shadow of a computed `box-shadow` list. */
interface Shadow {
  inset: boolean;
  color: string;
  lengths: number[];
}

function shadows(boxShadow: string): Shadow[] {
  if (boxShadow === "" || boxShadow === "none") return [];
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of boxShadow) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.map((part) => ({
    inset: /\binset\b/.test(part),
    color: /(?:rgba?|hsla?|color|oklch|oklab|lab|lch)\([^)]*\)/.exec(part)?.[0] ?? "",
    lengths: [...part.replace(/\([^)]*\)/g, "").matchAll(/(-?[\d.]+)px/g)].map((match) =>
      Number(match[1]),
    ),
  }));
}

/** Guide §5.14: the pressed tool keeps its ring, 2px inside in Highlight. */
export function pressedToolProblems(entry: ForcedEntryFacts, system: SystemColorFacts): string[] {
  const ring = shadows(entry.boxShadow).some(
    (shadow) => shadow.inset && shadow.lengths[3] === 2 && shadow.color === system.highlight,
  );
  if (ring) return [];
  return [
    `forced colours: the pressed tool "${entry.action}" shows box-shadow "${entry.boxShadow}", expected its ring as a 2px inset shadow in Highlight (${system.highlight}), with forced-color-adjust: none so the browser keeps it (guide §5.14)`,
  ];
}

/** Guide §5.14 and §8: the keyboard focus ring stays visible, a solid outline of at least 2px in Highlight. */
export function focusRingProblems(
  facts: FocusRingFacts,
  system: SystemColorFacts,
  step: string,
): string[] {
  if (!facts.inRoot) {
    return [
      `forced colours: after ${step} the focus is on ${facts.focused}, outside the shell root`,
    ];
  }
  const { outline } = facts;
  if (
    outline.width >= 2 &&
    !["none", "hidden"].includes(outline.style) &&
    outline.color === system.highlight
  )
    return [];
  return [
    `forced colours: after ${step} the focus ring of ${facts.focused} is ${outline.style} ${outline.width}px in ${outline.color}, expected a solid ring of at least 2px in Highlight (${system.highlight}) (guide §5.14, §8)`,
  ];
}

/** Guide §5.3 and §8: a modeler's dialog keeps its panel border in CanvasText under forced colours. */
export function dialogBorderProblems(
  entry: string,
  panels: readonly BorderedPartFacts[],
  system: SystemColorFacts,
): string[] {
  return panels.flatMap((panel) =>
    borderProblems(
      `the dialog of "${entry}"`,
      panel,
      [["CanvasText", system.canvasText]],
      "a modeler's dialog sets its forced-colours rules itself, the shell's do not reach it (guide §5.3, §8)",
    ),
  );
}
