import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  THEME_RETRY_AFTER_MS,
  describeWorkbenchTheme,
  detourTheme,
  missedThemeSwitch,
  switchWorkbenchTheme,
  workbenchThemeKey,
  workbenchThemeOf,
  type WorkbenchThemeSwitchOptions,
} from "./theme-switch.js";
import { VSCODE_COLOR_THEMES, workbenchThemeClass, type VsCodeColorTheme } from "./themes.js";

const [LIGHT, DARK, HIGH_CONTRAST, HIGH_CONTRAST_LIGHT] = VSCODE_COLOR_THEMES as [
  VsCodeColorTheme,
  VsCodeColorTheme,
  VsCodeColorTheme,
  VsCodeColorTheme,
];

// The classes VS Code 1.143.1 on Linux gave .monaco-workbench in Docker, around the theme's two
const OWN_CLASSES: Readonly<Record<string, string>> = {
  [LIGHT.name]: "vscode-theme-defaults-themes-light_modern-json",
  [DARK.name]: "vscode-theme-defaults-themes-dark_modern-json",
  [HIGH_CONTRAST.name]: "vscode-theme-defaults-themes-hc_black-json",
  [HIGH_CONTRAST_LIGHT.name]: "vscode-theme-defaults-themes-hc_light-json",
};
const OTHER_CLASSES =
  "monaco-enable-motion modern-ui modern-ui-tabs modern-ui-connected-editor-tabs modern-ui-notifications-dialogs " +
  "monaco-workbench linux chromium nopanel noauxiliarybar floating-panels panel-position-bottom " +
  "panel-alignment-center file-icons-enabled";

// a class VS Code adds later goes after the theme's two
function workbenchClasses(theme: VsCodeColorTheme): string[] {
  return [
    ...OTHER_CLASSES.split(" "),
    workbenchThemeClass(theme.kind),
    OWN_CLASSES[theme.name]!,
    "fullscreen",
  ];
}

const NAMES: ReadonlyMap<string, string> = new Map(
  VSCODE_COLOR_THEMES.map((theme) => [
    workbenchThemeKey(workbenchThemeOf(workbenchClasses(theme))),
    theme.name,
  ]),
);

interface FakeVsCodeOptions {
  shows: VsCodeColorTheme;
  /** From a write VS Code notices to the workbench's switch. */
  latencyMs?: number;
  /** `latencyMs` of single writes, counted from 0. */
  writeLatenciesMs?: Readonly<Record<number, number>>;
  /** Writes, counted from 0, whose change VS Code's file watcher never reports. */
  missedWrites?: readonly number[];
  /** Writes VS Code reads into its configuration without applying the theme. */
  unappliedWrites?: readonly number[];
}

/**
 * VS Code's side of a theme switch: a reported write reloads the configuration, and only a changed
 * `workbench.colorTheme` switches the workbench.
 */
function fakeVsCode(options: FakeVsCodeOptions) {
  let shown = options.shows;
  let configured = options.shows.name;
  const writes: { colorTheme: string; at: number }[] = [];
  const switches: { colorTheme: string; at: number }[] = [];
  return {
    writes,
    switches,
    writeSettings: async (colorTheme: string) => {
      const index = writes.push({ colorTheme, at: performance.now() }) - 1;
      if (options.missedWrites?.includes(index)) return;
      setTimeout(
        () => {
          if (colorTheme === configured) return;
          configured = colorTheme;
          if (options.unappliedWrites?.includes(index)) return;
          shown = VSCODE_COLOR_THEMES.find((theme) => theme.name === colorTheme)!;
          switches.push({ colorTheme, at: performance.now() });
        },
        options.writeLatenciesMs?.[index] ?? options.latencyMs ?? 200,
      );
    },
    readWorkbench: async () => workbenchClasses(shown),
  };
}

async function runSwitch(
  vsCode: ReturnType<typeof fakeVsCode>,
  options: Omit<WorkbenchThemeSwitchOptions, "writeSettings" | "readWorkbench">,
) {
  const lines: string[] = [];
  const pending = switchWorkbenchTheme({
    ...options,
    writeSettings: vsCode.writeSettings,
    readWorkbench: vsCode.readWorkbench,
    names: NAMES,
    log: (line) => lines.push(line),
  });
  await vi.runAllTimersAsync();
  const outcome = await pending;
  return { outcome, lines };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("switchWorkbenchTheme", () => {
  it("writes the setting once when VS Code switches at once", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT, latencyMs: 300 });
    const { outcome, lines } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

    expect(outcome.switched).toBe(true);
    expect(outcome.written).toEqual([DARK.name]);
    expect(outcome.shown).toEqual({ type: "vs-dark", id: OWN_CLASSES[DARK.name] });
    expect(outcome.ms).toBe(300);
    expect(lines).toEqual([]);
  });

  it("writes the setting again when VS Code missed the first write", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT, latencyMs: 300, missedWrites: [0] });
    const { outcome, lines } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

    expect(outcome.switched).toBe(true);
    expect(outcome.written).toEqual([DARK.name, DARK.name]);
    expect(vsCode.writes[1]!.at - vsCode.writes[0]!.at).toBe(THEME_RETRY_AFTER_MS);
    expect(outcome.ms).toBe(THEME_RETRY_AFTER_MS + 300);
    expect(lines).toEqual([
      "Default Dark Modern: the workbench still shows Default Light Modern " +
        "(.vs.vscode-theme-defaults-themes-light_modern-json) after 2.0 s, writing the setting again",
      "Default Dark Modern: the workbench switched 2.3 s after the first write, on write 2",
    ]);
  });

  it("switches through another theme and back when VS Code read the setting without applying it", async () => {
    const vsCode = fakeVsCode({ shows: HIGH_CONTRAST, latencyMs: 300, unappliedWrites: [0] });
    const { outcome, lines } = await runSwitch(vsCode, {
      theme: HIGH_CONTRAST_LIGHT,
      timeoutMs: 30_000,
    });

    expect(outcome.switched).toBe(true);
    // the same text again changes nothing in VS Code's configuration, so it takes a theme of a third kind
    expect(outcome.written).toEqual([
      HIGH_CONTRAST_LIGHT.name,
      HIGH_CONTRAST_LIGHT.name,
      LIGHT.name,
      HIGH_CONTRAST_LIGHT.name,
    ]);
    // the way back is written only once the workbench showed the detour, so VS Code read both
    expect(vsCode.writes[3]!.at - vsCode.writes[2]!.at).toBeGreaterThanOrEqual(300);
    expect(outcome.ms).toBe(2 * THEME_RETRY_AFTER_MS + 300 + 300);
    expect(lines).toEqual([
      "Default High Contrast Light: the workbench still shows Default High Contrast " +
        "(.hc-black.vscode-theme-defaults-themes-hc_black-json) after 2.0 s, writing the setting again",
      "Default High Contrast Light: the workbench still shows Default High Contrast " +
        "(.hc-black.vscode-theme-defaults-themes-hc_black-json) after 4.0 s, switching through Default Light Modern",
      "Default High Contrast Light: the workbench switched 4.6 s after the first write, on write 4",
    ]);
  });

  it("gives up after timeoutMs when VS Code never switches, and says what it shows", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT, missedWrites: [0, 1, 2, 3] });
    const { outcome } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

    expect(outcome.switched).toBe(false);
    expect(outcome.written).toEqual([DARK.name, DARK.name, HIGH_CONTRAST.name, DARK.name]);
    expect(outcome.ms).toBe(30_000);
    expect(missedThemeSwitch(DARK, outcome, NAMES)).toBe(
      "Default Dark Modern: the workbench never switched (no .vs-dark): requested Default Dark Modern, " +
        "VS Code shows Default Light Modern (.vs.vscode-theme-defaults-themes-light_modern-json) after 30.0 s, " +
        "though the driver wrote the setting 4 times " +
        "(Default Dark Modern, Default Dark Modern, Default High Contrast, Default Dark Modern)",
    );
  });

  it("keeps every retry within a short timeoutMs", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT, missedWrites: [0, 1, 2, 3] });
    const { outcome } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 1_000 });

    expect(outcome.switched).toBe(false);
    // retryAfterMs is a quarter of timeoutMs, and the way back is written that long before the deadline
    expect(vsCode.writes.map(({ at }) => at - vsCode.writes[0]!.at)).toEqual([0, 300, 600, 800]);
    expect(outcome.ms).toBe(1_000);
  });

  it.each([4_100, 4_500, 5_000, 7_000])(
    "waits for a VS Code that takes %i ms to show the detour before writing the way back",
    async (latencyMs) => {
      const vsCode = fakeVsCode({ shows: LIGHT, latencyMs });
      const { outcome } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

      expect(outcome.switched).toBe(true);
      expect(outcome.written).toEqual([DARK.name, DARK.name, HIGH_CONTRAST.name, DARK.name]);
      expect(vsCode.switches.map(({ colorTheme }) => colorTheme)).toEqual([
        DARK.name,
        HIGH_CONTRAST.name,
        DARK.name,
      ]);
      // nothing switches the workbench away once the driver went on with the switched theme
      expect(vsCode.switches.at(-1)!.at - vsCode.writes[0]!.at).toBe(outcome.ms);
      expect(outcome.ms).toBeLessThan(30_000);
    },
  );

  it("writes the setting again when VS Code missed the detour too, and checks it at the deadline", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT, latencyMs: 300, missedWrites: [0, 1, 2] });
    const { outcome, lines } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

    expect(outcome.switched).toBe(true);
    expect(outcome.written).toEqual([DARK.name, DARK.name, HIGH_CONTRAST.name, DARK.name]);
    expect(vsCode.writes[3]!.at - vsCode.writes[0]!.at).toBe(30_000 - THEME_RETRY_AFTER_MS);
    expect(outcome.ms).toBe(30_000);
    expect(lines.slice(2)).toEqual([
      "Default Dark Modern: the workbench never showed Default High Contrast and shows Default Light Modern " +
        "(.vs.vscode-theme-defaults-themes-light_modern-json) after 28.0 s, writing the setting again",
      "Default Dark Modern: the workbench shows it at the deadline, 30.0 s after the first write, on write 4",
    ]);
  });

  it("fails when the detour shows only after the way back, as the workbench then ends on the detour", async () => {
    const vsCode = fakeVsCode({
      shows: LIGHT,
      latencyMs: 300,
      missedWrites: [0, 1],
      writeLatenciesMs: { 2: 25_000 },
    });
    const { outcome } = await runSwitch(vsCode, { theme: DARK, timeoutMs: 30_000 });

    expect(vsCode.switches.map(({ colorTheme }) => colorTheme)).toEqual([
      DARK.name,
      HIGH_CONTRAST.name,
    ]);
    expect(outcome.switched).toBe(false);
    expect(outcome.ms).toBe(30_000);
    expect(missedThemeSwitch(DARK, outcome, NAMES)).toContain(
      "requested Default Dark Modern, VS Code shows Default High Contrast " +
        "(.hc-black.vscode-theme-defaults-themes-hc_black-json) after 30.0 s",
    );
  });

  it("writes the theme the workbench already shows once and returns at once", async () => {
    const vsCode = fakeVsCode({ shows: LIGHT });
    const { outcome } = await runSwitch(vsCode, { theme: LIGHT, timeoutMs: 30_000 });

    expect(outcome).toMatchObject({ switched: true, written: [LIGHT.name], ms: 0 });
  });
});

describe("detourTheme", () => {
  it("is a default theme of neither the requested kind nor the shown one", () => {
    for (const requested of VSCODE_COLOR_THEMES) {
      for (const shownType of [undefined, "vs", "vs-dark", "hc-black", "hc-light"]) {
        const detour = detourTheme(requested.kind, shownType);
        expect(VSCODE_COLOR_THEMES).toContain(detour);
        expect(detour.kind).not.toBe(requested.kind);
        expect(workbenchThemeClass(detour.kind)).not.toBe(shownType);
      }
    }
  });
});

describe("workbenchThemeOf", () => {
  it("reads the type class and the theme's own class that VS Code adds right after it", () => {
    expect(workbenchThemeOf(workbenchClasses(HIGH_CONTRAST_LIGHT))).toEqual({
      type: "hc-light",
      id: "vscode-theme-defaults-themes-hc_light-json",
    });
  });

  it("has neither without a theme class", () => {
    expect(workbenchThemeOf(OTHER_CLASSES.split(" "))).toEqual({ type: undefined, id: undefined });
    expect(workbenchThemeOf([])).toEqual({ type: undefined, id: undefined });
  });
});

describe("describeWorkbenchTheme", () => {
  it("names a theme the run showed before, and gives the classes of any other", () => {
    expect(describeWorkbenchTheme({ type: "vs", id: OWN_CLASSES[LIGHT.name] }, NAMES)).toBe(
      "Default Light Modern (.vs.vscode-theme-defaults-themes-light_modern-json)",
    );
    expect(
      describeWorkbenchTheme(
        { type: "vs-dark", id: "vscode-theme-defaults-themes-2026-dark-json" },
        NAMES,
      ),
    ).toBe(".vs-dark.vscode-theme-defaults-themes-2026-dark-json");
    expect(describeWorkbenchTheme({ type: undefined, id: undefined }, NAMES)).toBe(
      "no theme class on .monaco-workbench",
    );
  });
});

describe("missedThemeSwitch", () => {
  it("keeps the wording modelers match a missed switch by", () => {
    const message = missedThemeSwitch(
      HIGH_CONTRAST_LIGHT,
      {
        switched: false,
        shown: { type: "hc-black", id: undefined },
        written: [HIGH_CONTRAST_LIGHT.name],
        ms: 500,
      },
      NAMES,
    );
    expect(message).toMatch(/^.+: the workbench never switched/);
    expect(message).toBe(
      "Default High Contrast Light: the workbench never switched (no .hc-light): " +
        "requested Default High Contrast Light, VS Code shows .hc-black after 0.5 s",
    );
  });
});
