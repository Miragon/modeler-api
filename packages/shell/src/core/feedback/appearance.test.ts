import { Script, createContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  documentMode,
  parseAppearanceChoice,
  webHeadMarkup,
  webModeScript,
  type AppearanceChoice,
  type ThemeColors,
} from "./appearance.js";

const colors: ThemeColors = { light: "#335DE5", dark: "#1D1D1D" };
const LIGHT_ONLY = ["light"] as const;
const DARK_CAPABLE = ["light", "dark"] as const;

describe("parseAppearanceChoice", () => {
  it("passes light and dark, everything else is system", () => {
    expect(parseAppearanceChoice("light")).toBe("light");
    expect(parseAppearanceChoice("dark")).toBe("dark");
    for (const stored of [null, undefined, "", "system", "Dark", "auto", 1, {}]) {
      expect(parseAppearanceChoice(stored)).toBe("system");
    }
  });

  it("stores under miragon.darstellung (guide §13.3)", () => {
    expect(APPEARANCE_STORAGE_KEY).toBe("miragon.darstellung");
  });
});

describe("documentMode (guide §13.3)", () => {
  it.each<[AppearanceChoice, readonly ("light" | "dark")[], ReturnType<typeof documentMode>]>([
    [
      "system",
      LIGHT_ONLY,
      { theme: "light", colorScheme: "light", themeColor: { light: "#335DE5", dark: "#335DE5" } },
    ],
    [
      "light",
      LIGHT_ONLY,
      { theme: "light", colorScheme: "light", themeColor: { light: "#335DE5", dark: "#335DE5" } },
    ],
    [
      "dark",
      LIGHT_ONLY,
      { theme: "light", colorScheme: "light", themeColor: { light: "#335DE5", dark: "#335DE5" } },
    ],
    [
      "system",
      DARK_CAPABLE,
      { theme: "system", colorScheme: "light dark", themeColor: { light: "#335DE5", dark: "#1D1D1D" } },
    ],
    [
      "light",
      DARK_CAPABLE,
      { theme: "light", colorScheme: "light", themeColor: { light: "#335DE5", dark: "#335DE5" } },
    ],
    [
      "dark",
      DARK_CAPABLE,
      { theme: "dark", colorScheme: "dark", themeColor: { light: "#1D1D1D", dark: "#1D1D1D" } },
    ],
  ])("%s with themes %j", (choice, themes, expected) => {
    expect(documentMode(choice, themes, colors)).toEqual(expected);
  });

  it("treats a foreign choice from untyped code as system", () => {
    expect(documentMode("sepia" as AppearanceChoice, DARK_CAPABLE, colors).theme).toBe("system");
  });
});

interface FakeMeta {
  name: string;
  media: string | undefined;
  content: string;
}

interface PageSetup {
  stored?: string | null;
  storage?: "ok" | "throws on access" | "throws on read";
  contrast?: boolean;
  colorSchemeMeta?: boolean;
}

/** Runs the head script against a minimal page in a fresh V8 context (no Node globals in reach). */
function runOnFakePage(script: string, setup: PageSetup = {}) {
  const attributes = new Map<string, string>([["data-cd-theme", "system"]]);
  const metas: FakeMeta[] = [
    ...(setup.colorSchemeMeta === false
      ? []
      : [{ name: "color-scheme", media: undefined, content: "light dark" }]),
    { name: "theme-color", media: "(prefers-color-scheme: light)", content: colors.light },
    { name: "theme-color", media: "(prefers-color-scheme: dark)", content: colors.dark },
  ];
  const element = (meta: FakeMeta) => ({
    setAttribute(name: string, value: string) {
      if (name === "content") meta.content = value;
    },
  });
  const named = (selector: string): FakeMeta[] => {
    const match = /^meta\[name="?([\w-]+)"?\]$/.exec(selector);
    if (!match) throw new Error(`unexpected selector ${selector}`);
    return metas.filter((meta) => meta.name === match[1]);
  };
  const storageReads: string[] = [];
  const storage = {
    getItem(key: string) {
      storageReads.push(key);
      if (setup.storage === "throws on read") throw new Error("SecurityError");
      return key === APPEARANCE_STORAGE_KEY ? (setup.stored ?? null) : null;
    },
  };
  const window = {
    get localStorage() {
      if (setup.storage === "throws on access") throw new Error("SecurityError");
      return storage;
    },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-contrast: more)" && setup.contrast === true,
    }),
  };
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
    querySelector: (selector: string) => {
      const [first] = named(selector);
      return first ? element(first) : null;
    },
    querySelectorAll: (selector: string) => named(selector).map(element),
  };
  new Script(script).runInContext(createContext({ window, document }));
  return {
    theme: attributes.get("data-cd-theme"),
    kontrast: attributes.get("data-cd-kontrast"),
    metas: Object.fromEntries(metas.map((meta) => [`${meta.name} ${meta.media ?? ""}`.trim(), meta.content])),
    storageReads,
  };
}

const SYSTEM_METAS = {
  "color-scheme": "light dark",
  "theme-color (prefers-color-scheme: light)": "#335DE5",
  "theme-color (prefers-color-scheme: dark)": "#1D1D1D",
};

describe("webModeScript (guide §13.3)", () => {
  const darkScript = webModeScript({ themes: DARK_CAPABLE, themeColors: colors });
  const lightScript = webModeScript({ themes: LIGHT_ONLY, themeColors: colors });

  it("is plain ES5", () => {
    for (const script of [darkScript, lightScript]) {
      expect(() => new Script(script)).not.toThrow();
      expect(script).not.toMatch(/=>|`|\.\.\.|\b(?:const|let|class)\b|\bfor\s*\([^)]*\bof\b/);
    }
  });

  it("light-only: the contrast line alone, no storage, no theme", () => {
    expect(lightScript).not.toContain("localStorage");
    expect(lightScript).not.toContain("data-cd-theme");
    const page = runOnFakePage(lightScript, { stored: "dark", contrast: true });
    expect(page).toEqual({ theme: "system", kontrast: "hoch", metas: SYSTEM_METAS, storageReads: [] });
    expect(runOnFakePage(lightScript).kontrast).toBeUndefined();
  });

  it("dark-capable with dark stored: theme, color-scheme and both theme-colors dark", () => {
    const page = runOnFakePage(darkScript, { stored: "dark" });
    expect(page.theme).toBe("dark");
    expect(page.metas).toEqual({
      "color-scheme": "dark",
      "theme-color (prefers-color-scheme: light)": "#1D1D1D",
      "theme-color (prefers-color-scheme: dark)": "#1D1D1D",
    });
    expect(page.storageReads).toEqual(["miragon.darstellung"]);
  });

  it("dark-capable with light stored: both theme-colors the app's", () => {
    const page = runOnFakePage(darkScript, { stored: "light" });
    expect(page.theme).toBe("light");
    expect(page.metas).toEqual({
      "color-scheme": "light",
      "theme-color (prefers-color-scheme: light)": "#335DE5",
      "theme-color (prefers-color-scheme: dark)": "#335DE5",
    });
  });

  it("dark-capable with nothing or a foreign value stored: leaves the static system markup", () => {
    for (const stored of [null, "system", "sepia"]) {
      const page = runOnFakePage(darkScript, { stored });
      expect(page.theme).toBe("system");
      expect(page.metas).toEqual(SYSTEM_METAS);
      expect(page.kontrast).toBeUndefined();
    }
  });

  it("dark-capable with a storage that throws: system, and the contrast line still runs", () => {
    for (const storage of ["throws on access", "throws on read"] as const) {
      const page = runOnFakePage(darkScript, { storage, stored: "dark", contrast: true });
      expect(page.theme).toBe("system");
      expect(page.metas).toEqual(SYSTEM_METAS);
      expect(page.kontrast).toBe("hoch");
    }
  });

  it("dark-capable under prefers-contrast: more sets data-cd-kontrast next to the choice", () => {
    expect(runOnFakePage(darkScript, { stored: "dark", contrast: true })).toMatchObject({
      theme: "dark",
      kontrast: "hoch",
    });
  });

  it("survives a page without a color-scheme meta", () => {
    const page = runOnFakePage(darkScript, { stored: "dark", colorSchemeMeta: false });
    expect(page.theme).toBe("dark");
    expect(page.metas["theme-color (prefers-color-scheme: light)"]).toBe("#1D1D1D");
  });

  it("keeps a colour from ending the script element", () => {
    const script = webModeScript({
      themes: DARK_CAPABLE,
      themeColors: { light: "</script><script>alert(1)//", dark: "#1D1D1D " },
    });
    expect(script).not.toContain("</script");
    expect(script).not.toContain(" ");
    expect(() => new Script(script)).not.toThrow();
    const page = runOnFakePage(script, { stored: "light" });
    expect(page.metas["color-scheme"]).toBe("light");
    expect(page.metas["theme-color (prefers-color-scheme: dark)"]).toBe("</script><script>alert(1)//");
  });
});

describe("webHeadMarkup (guide §13.3)", () => {
  it("light-only: one theme-color without media and the contrast script", () => {
    const markup = webHeadMarkup({ themes: LIGHT_ONLY, themeColors: colors });
    expect(markup).toBe(
      [
        '<meta name="theme-color" content="#335DE5">',
        "<script>",
        webModeScript({ themes: LIGHT_ONLY, themeColors: colors }),
        "</script>",
      ].join("\n"),
    );
    expect(markup).not.toContain("color-scheme");
  });

  it("dark-capable: color-scheme, both theme-colors with media, then the script", () => {
    const markup = webHeadMarkup({ themes: DARK_CAPABLE, themeColors: colors });
    expect(markup).toBe(
      [
        '<meta name="color-scheme" content="light dark">',
        '<meta name="theme-color" content="#335DE5" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#1D1D1D" media="(prefers-color-scheme: dark)">',
        "<script>",
        webModeScript({ themes: DARK_CAPABLE, themeColors: colors }),
        "</script>",
      ].join("\n"),
    );
  });

  it("escapes the attribute values", () => {
    const markup = webHeadMarkup({
      themes: DARK_CAPABLE,
      themeColors: { light: `"><script>alert('x')</script>`, dark: "a&b<c>" },
    });
    expect(markup).toContain(
      'content="&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;" media="(prefers-color-scheme: light)"',
    );
    expect(markup).toContain('content="a&amp;b&lt;c&gt;" media="(prefers-color-scheme: dark)"');
    expect(markup.match(/<\/script>/g)).toHaveLength(1);
    expect(
      webHeadMarkup({ themes: LIGHT_ONLY, themeColors: { light: '"x', dark: "y" } }).split("\n")[0],
    ).toBe('<meta name="theme-color" content="&quot;x">');
  });
});
