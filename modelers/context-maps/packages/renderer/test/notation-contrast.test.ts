import { describe, expect, it } from "vitest";
import {
  ALL_PATTERN_SPECS,
  ALL_SUBDOMAIN_SPECS,
  DOWNSTREAM_ROLE_SPECS,
  MARK_COLORS,
  UPSTREAM_ROLE_SPECS,
  type DownstreamRole,
  type UpstreamRole,
} from "@miragon/context-maps-schema-model";
import {
  contextBadgeColour,
  contextFill,
  contextNameColour,
  contextStroke,
  contextTeamColour,
} from "../src/draw/contextColours.js";
import {
  contextIconSvg,
  relationshipIconSvg,
  roleChipSvg,
  subdomainIconSvg,
} from "../src/draw/palette-icons.js";
import {
  directionLetterColour,
  markFill,
  markTextColour,
  patternChipColours,
} from "../src/draw/relationshipColours.js";
import { INK, PAPER } from "../src/draw/styles.js";
import vendoredTokens from "../src/theme/cd-tokens.generated.json";
import { MIRAGON } from "../src/theme/palette.js";
import { NON_TEXT_CONTRAST, TEXT_CONTRAST, pairBelow } from "./support/contrast.js";

/**
 * Guide §10.6 measures a line against the resting surface: on the canvas the ground. The palette's
 * and the legend's glass is lighter than the ground, so the same bound covers their previews.
 */
const CANVAS_GROUND = vendoredTokens.hell["--cd-ui-grund"];

const ROLES = [...Object.keys(UPSTREAM_ROLE_SPECS), ...Object.keys(DOWNSTREAM_ROLE_SPECS)] as Array<
  UpstreamRole | DownstreamRole
>;
const DIRECTIONS = ["U", "D", "S", "C"];
const SYMMETRIC_PATTERNS = ALL_PATTERN_SPECS.filter((spec) => spec.symmetric);

/** Every context the notation colours on its own: the three subdomain types and none. */
const DEFAULT_CONTEXTS = [
  ...ALL_SUBDOMAIN_SPECS.map((spec) => ({
    name: spec.label,
    context: { subdomainType: spec.type },
  })),
  { name: "unclassified", context: {} },
];

function failures(pairs: Array<string | undefined>): string[] {
  return pairs.filter((pair): pair is string => pair !== undefined);
}

function parseSvg(markup: string): Element {
  return new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
}

function attributeOf(svg: Element, selector: string, name: string): string {
  const value = svg.querySelector(selector)?.getAttribute(name);
  expect(value, `${selector} ${name}`).toBeTruthy();
  return value!;
}

/** The glyph's colour: the star and the hand are filled paths, the dotted circle is a stroke. */
function glyphColourOf(svg: Element): string {
  return svg.querySelector("path")
    ? attributeOf(svg, "path", "fill")
    : attributeOf(svg, "circle", "stroke");
}

describe("notation contrast: every text reaches 4.5:1, no exception (guide §3.6, §10.6)", () => {
  it("names, subdomain badges and team captions on every default fill", () => {
    const pairs = DEFAULT_CONTEXTS.flatMap(({ name, context }) => {
      const fill = contextFill(context);
      return [
        pairBelow(`${name} name`, contextNameColour(context), fill, TEXT_CONTRAST),
        pairBelow(`${name} team`, contextTeamColour(context), fill, TEXT_CONTRAST),
        ...("subdomainType" in context
          ? [pairBelow(`${name} badge`, contextBadgeColour(context), fill, TEXT_CONTRAST)]
          : []),
      ];
    });
    expect(failures(pairs)).toEqual([]);
  });

  it("every marker's text on its chip", () => {
    const pairs = Object.keys(MARK_COLORS).map((token) =>
      pairBelow(`${token} text`, markTextColour(token), markFill(token), TEXT_CONTRAST),
    );
    expect(failures(pairs)).toEqual([]);
  });

  it("picks schwarz for PL and CF, weiss for OHS, ACL and the direction colours", () => {
    const textColours = Object.fromEntries(
      Object.keys(MARK_COLORS).map((token) => [token, markTextColour(token)]),
    );
    expect(textColours).toEqual({
      OHS: MIRAGON.weiss,
      PL: INK,
      ACL: MIRAGON.weiss,
      CF: INK,
      U: MIRAGON.weiss,
      D: MIRAGON.weiss,
      S: MIRAGON.weiss,
      C: MIRAGON.weiss,
    });
  });

  it("the direction letters on their paper halo", () => {
    const pairs = DIRECTIONS.map((direction) =>
      pairBelow(`${direction} letter`, directionLetterColour(direction), PAPER, TEXT_CONTRAST),
    );
    expect(failures(pairs)).toEqual([]);
  });

  it("the symmetric patterns' chips, in schwarz on paper", () => {
    const pairs = SYMMETRIC_PATTERNS.map((spec) => {
      const chip = patternChipColours(spec);
      expect(chip.text, spec.label).toBe(INK);
      return pairBelow(`${spec.label} chip text`, chip.text, chip.fill, TEXT_CONTRAST);
    });
    expect(failures(pairs)).toEqual([]);
  });
});

describe("notation contrast: every structural line reaches 3:1 on the canvas ground", () => {
  it("box outlines, relationship lines and the symmetric chips' borders", () => {
    const lines: Array<readonly [string, string]> = [
      ...DEFAULT_CONTEXTS.map(
        ({ name, context }) => [`${name} outline`, contextStroke(context)] as const,
      ),
      ...ALL_PATTERN_SPECS.map((spec) => [`${spec.label} line`, spec.stroke] as const),
      ...SYMMETRIC_PATTERNS.map(
        (spec) => [`${spec.label} chip border`, patternChipColours(spec).border] as const,
      ),
    ];
    const pairs = lines.map(([name, stroke]) =>
      pairBelow(name, stroke, CANVAS_GROUND, NON_TEXT_CONTRAST),
    );
    expect(failures(pairs)).toEqual([]);
  });

  it("keeps the pattern's colour on the symmetric chips' borders", () => {
    for (const spec of SYMMETRIC_PATTERNS) {
      expect(patternChipColours(spec).border, spec.label).toBe(spec.stroke);
    }
  });

  it("the subdomain glyph on its box", () => {
    const pairs = ALL_SUBDOMAIN_SPECS.map((spec) =>
      pairBelow(
        `${spec.label} glyph`,
        contextBadgeColour({ subdomainType: spec.type }),
        spec.fill,
        NON_TEXT_CONTRAST,
      ),
    );
    expect(failures(pairs)).toEqual([]);
  });
});

describe("notation contrast: the palette and legend previews draw the canvas colours", () => {
  it.each(ROLES)("the %s chip", (role) => {
    const svg = parseSvg(roleChipSvg(role));
    const fill = attributeOf(svg, "rect", "fill");
    const text = attributeOf(svg, "text", "fill");
    expect(fill).toBe(markFill(role));
    expect(text).toBe(markTextColour(role));
    expect(pairBelow(`${role} chip text`, text, fill, TEXT_CONTRAST)).toBeUndefined();
  });

  it.each(ALL_SUBDOMAIN_SPECS.map((spec) => [spec.label, spec] as const))(
    "the %s box and its glyph",
    (_label, spec) => {
      const box = parseSvg(contextIconSvg(spec.type));
      const fill = attributeOf(box, "rect", "fill");
      const stroke = attributeOf(box, "rect", "stroke");
      const glyph = glyphColourOf(box);
      expect(glyph).toBe(contextBadgeColour({ subdomainType: spec.type }));
      expect(
        failures([
          pairBelow("outline", stroke, CANVAS_GROUND, NON_TEXT_CONTRAST),
          pairBelow("glyph", glyph, fill, NON_TEXT_CONTRAST),
          pairBelow(
            "bare glyph",
            glyphColourOf(parseSvg(subdomainIconSvg(spec.type))),
            CANVAS_GROUND,
            NON_TEXT_CONTRAST,
          ),
        ]),
      ).toEqual([]);
    },
  );

  it("the unclassified box", () => {
    const stroke = attributeOf(parseSvg(contextIconSvg()), "rect", "stroke");
    expect(pairBelow("outline", stroke, CANVAS_GROUND, NON_TEXT_CONTRAST)).toBeUndefined();
  });

  it.each(ALL_PATTERN_SPECS.map((spec) => [spec.label, spec] as const))(
    "the %s line",
    (_label, spec) => {
      const stroke = attributeOf(parseSvg(relationshipIconSvg(spec.pattern)), "g", "stroke");
      expect(pairBelow("line", stroke, CANVAS_GROUND, NON_TEXT_CONTRAST)).toBeUndefined();
    },
  );
});
