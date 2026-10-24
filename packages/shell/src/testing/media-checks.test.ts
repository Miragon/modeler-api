import { describe, expect, it } from "vitest";

import {
  MAX_JUMP_VIEWS,
  dialogBorderProblems,
  fitJumpProblems,
  focusRingProblems,
  forcedColorsProblems,
  pressedToolProblems,
  reducedMotionProblems,
} from "./media-checks.js";
import type {
  BorderFacts,
  BorderedPartFacts,
  ForcedColorsFacts,
  ForcedEntryFacts,
  SystemColorFacts,
} from "./media-facts.js";

const SYSTEM: SystemColorFacts = {
  canvas: "rgb(255, 255, 255)",
  canvasText: "rgb(0, 0, 0)",
  highlight: "rgba(5, 0, 73, 0.8)",
  buttonText: "rgb(16, 16, 16)",
};

function border(width: number, style: string, color: string): BorderFacts {
  const side = { width, style, color };
  return { top: side, right: side, bottom: side, left: side };
}

function part(name: string, facts: BorderFacts = border(1, "solid", SYSTEM.canvasText)) {
  return {
    name,
    description: `div[data-chrome="${name}"]`,
    border: facts,
  } satisfies BorderedPartFacts;
}

function tool(overrides: Partial<ForcedEntryFacts> = {}): ForcedEntryFacts {
  return {
    action: "lasso-tool",
    group: "tools",
    pressed: false,
    disabled: false,
    boxShadow: "none",
    icon: { kind: "svg", color: SYSTEM.canvasText },
    ...overrides,
  };
}

function forced(overrides: Partial<ForcedColorsFacts> = {}): ForcedColorsFacts {
  return {
    system: SYSTEM,
    parts: [part("menu"), part("palette"), part("zoom")],
    entries: [tool(), tool({ action: "hand-tool" })],
    statusBar: null,
    ...overrides,
  };
}

describe("reducedMotionProblems", () => {
  it("passes a state without motion", () => {
    expect(reducedMotionProblems("as opened", [], [])).toEqual([]);
  });

  it("names a style that sets motion and an animation that ran, with the state", () => {
    expect(
      reducedMotionProblems(
        'with "box" selected',
        [{ description: "div.panel", kind: "transition", name: "opacity", durationMs: 200 }],
        [
          { description: "g.djs-shape", kind: "script", name: "", durationMs: 400 },
          {
            description: "div.spinner::before",
            kind: "animation",
            name: "spin",
            durationMs: Infinity,
          },
        ],
      ),
    ).toEqual([
      'motion: div.panel sets a transition of 200ms on "opacity" with "box" selected; under reduced motion nothing moves (guide §5.14, §7)',
      'motion: g.djs-shape ran an element.animate() animation of 400ms with "box" selected; under reduced motion nothing moves (guide §5.14, §7)',
      'motion: div.spinner::before ran an animation of no end on "spin" with "box" selected; under reduced motion nothing moves (guide §5.14, §7)',
    ]);
  });
});

describe("fitJumpProblems", () => {
  it("passes a jump from the view before to the fitted one, and one correction after it", () => {
    expect(fitJumpProblems(["2 0 0 2 0 0", "1 0 0 1 10 10"])).toEqual([]);
    expect(fitJumpProblems(["2 0 0 2 0 0", "1 0 0 1 10 10", "1 0 0 1 10 12"])).toEqual([]);
  });

  it("fails a fit that passes through the views of a glide", () => {
    const glide = Array.from(
      { length: MAX_JUMP_VIEWS + 1 },
      (_, step) => `${2 - step / 4} 0 0 1 0 0`,
    );
    expect(fitJumpProblems(glide)).toEqual([
      `fit: a click on Fit passed through ${MAX_JUMP_VIEWS} views; under reduced motion an explicit fit jumps (guide §5.9, §7)`,
    ]);
  });

  it("reports a click on Fit that left the view as it was, which proves nothing", () => {
    expect(fitJumpProblems(["1 0 0 1 0 0"])).toEqual([
      "fit: a click on Fit after two clicks on zoom in left the view as it was, so whether it jumps was not verified",
    ]);
  });
});

describe("forcedColorsProblems", () => {
  it("passes islands in CanvasText, the primary action in ButtonText and the borderless parts", () => {
    expect(
      forcedColorsProblems(
        forced({
          parts: [
            part("menu"),
            part("primary", border(1, "solid", SYSTEM.buttonText)),
            part("legal", border(0, "none", "rgba(0, 0, 0, 0)")),
            part("toasts", border(0, "none", "rgba(0, 0, 0, 0)")),
            part("dropdown"),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("fails an island without a border on some side", () => {
    const facts = border(1, "solid", SYSTEM.canvasText);
    facts.bottom = { width: 0, style: "none", color: SYSTEM.canvasText };
    expect(forcedColorsProblems(forced({ parts: [part("zoom", facts)] }))).toEqual([
      'forced colours: island "zoom" (div[data-chrome="zoom"]) draws no border on its bottom side; islands keep their border in system colours, nothing disappears (guide §5.14)',
    ]);
  });

  it("fails an island and the dropdown whose border is not CanvasText", () => {
    expect(
      forcedColorsProblems(
        forced({
          parts: [
            part("zoom", border(1, "solid", "rgba(0, 0, 0, 0)")),
            part("dropdown", border(1, "solid", SYSTEM.buttonText)),
          ],
        }),
      ),
    ).toEqual([
      'forced colours: island "zoom" (div[data-chrome="zoom"]) has its top, right, bottom, left border in rgba(0, 0, 0, 0), expected CanvasText (rgb(0, 0, 0)); islands keep their border in system colours, nothing disappears (guide §5.14)',
      'forced colours: the dropdown (div[data-chrome="dropdown"]) has its top, right, bottom, left border in rgb(16, 16, 16), expected CanvasText (rgb(0, 0, 0)); islands keep their border in system colours, nothing disappears (guide §5.14)',
    ]);
  });

  it("fails a status bar that is not CanvasText or has no width", () => {
    expect(
      forcedColorsProblems(forced({ statusBar: { width: 4, color: SYSTEM.canvasText } })),
    ).toEqual([]);
    expect(forcedColorsProblems(forced({ statusBar: { width: 4, color: SYSTEM.canvas } }))).toEqual(
      [
        "forced colours: the status box's bar is 4px in rgb(255, 255, 255), expected CanvasText (rgb(0, 0, 0)); it stays visible (guide §5.14)",
      ],
    );
    expect(
      forcedColorsProblems(forced({ statusBar: { width: 0, color: SYSTEM.canvasText } })),
    ).toHaveLength(1);
  });

  it("fails a tool icon that is not CanvasText, and leaves previews and disabled tools alone", () => {
    expect(
      forcedColorsProblems(
        forced({
          entries: [
            tool({ icon: { kind: "::before", color: SYSTEM.canvas } }),
            tool({
              action: "create.box",
              group: "shapes",
              icon: { kind: "::before", color: "red" },
            }),
            tool({ action: "hand-tool", disabled: true, icon: { kind: "svg", color: "gray" } }),
          ],
        }),
      ),
    ).toEqual([
      'forced colours: the ::before icon of tool "lasso-tool" has color rgb(255, 255, 255), expected CanvasText (rgb(0, 0, 0)); icons stay visible (guide §5.14)',
    ]);
  });
});

describe("pressedToolProblems", () => {
  it("passes a 2px inset ring in Highlight among other shadows", () => {
    expect(
      pressedToolProblems(
        tool({
          pressed: true,
          boxShadow: "rgb(0, 0, 0) 0px 1px 2px 0px, rgba(5, 0, 73, 0.8) 0px 0px 0px 2px inset",
        }),
        SYSTEM,
      ),
    ).toEqual([]);
  });

  it("fails a ring the browser dropped, an outer one, a thinner one and one in another colour", () => {
    for (const boxShadow of [
      "none",
      "rgba(5, 0, 73, 0.8) 0px 0px 0px 2px",
      "rgba(5, 0, 73, 0.8) 0px 0px 0px 1px inset",
      "rgb(0, 0, 0) 0px 0px 0px 2px inset",
    ]) {
      expect(pressedToolProblems(tool({ pressed: true, boxShadow }), SYSTEM)).toEqual([
        `forced colours: the pressed tool "lasso-tool" shows box-shadow "${boxShadow}", expected its ring as a 2px inset shadow in Highlight (rgba(5, 0, 73, 0.8)), with forced-color-adjust: none so the browser keeps it (guide §5.14)`,
      ]);
    }
  });
});

describe("focusRingProblems", () => {
  const ring = (width: number, style: string, color: string) => ({
    focused: "button.cd-shell-target",
    inRoot: true,
    outline: { width, style, color },
  });

  it("passes a solid ring of 2px or more in Highlight", () => {
    expect(focusRingProblems(ring(2, "solid", SYSTEM.highlight), SYSTEM, "Tab")).toEqual([]);
    expect(focusRingProblems(ring(3, "solid", SYSTEM.highlight), SYSTEM, "Tab")).toEqual([]);
  });

  it("fails a ring that is missing, thinner or not Highlight", () => {
    for (const facts of [
      ring(0, "none", SYSTEM.highlight),
      ring(1, "solid", SYSTEM.highlight),
      ring(2, "solid", SYSTEM.canvasText),
    ]) {
      expect(focusRingProblems(facts, SYSTEM, "Tab from zoom out")).toEqual([
        `forced colours: after Tab from zoom out the focus ring of button.cd-shell-target is ${facts.outline.style} ${facts.outline.width}px in ${facts.outline.color}, expected a solid ring of at least 2px in Highlight (rgba(5, 0, 73, 0.8)) (guide §5.14, §8)`,
      ]);
    }
  });

  it("fails a Tab that leaves the shell root", () => {
    expect(
      focusRingProblems(
        { focused: "<body>", inRoot: false, outline: { width: 0, style: "none", color: "" } },
        SYSTEM,
        "Tab from zoom out",
      ),
    ).toEqual([
      "forced colours: after Tab from zoom out the focus is on <body>, outside the shell root",
    ]);
  });
});

describe("dialogBorderProblems", () => {
  it("passes no dialog (one the host shows) and a dialog panel in CanvasText", () => {
    expect(dialogBorderProblems("Keyboard shortcuts…", [], SYSTEM)).toEqual([]);
    expect(dialogBorderProblems("Keyboard shortcuts…", [part("dialog")], SYSTEM)).toEqual([]);
  });

  it("fails a dialog panel that keeps its own border colour", () => {
    expect(
      dialogBorderProblems(
        "Keyboard shortcuts…",
        [
          {
            name: "dialog",
            description: "dialog.demo-dialog",
            border: border(1, "solid", "rgb(228, 231, 236)"),
          },
        ],
        SYSTEM,
      ),
    ).toEqual([
      "forced colours: the dialog of \"Keyboard shortcuts…\" (dialog.demo-dialog) has its top, right, bottom, left border in rgb(228, 231, 236), expected CanvasText (rgb(0, 0, 0)); a modeler's dialog sets its forced-colours rules itself, the shell's do not reach it (guide §5.3, §8)",
    ]);
  });
});
