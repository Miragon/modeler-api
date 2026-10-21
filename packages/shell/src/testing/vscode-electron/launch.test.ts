import { describe, expect, it } from "vitest";

import {
  customEditorViewType,
  extensionIdOf,
  isPlainFileName,
  matchesFilenamePattern,
  platformKeys,
  vsCodeEnvironment,
  vsCodeLaunchArgs,
  vsCodeUserSettings,
  type ExtensionManifest,
} from "./launch.js";

const paths = {
  userDataDir: "/tmp/run/user-data",
  extensionsDir: "/tmp/run/extensions",
  workspaceDir: "/tmp/run/workspace",
  file: "/tmp/run/workspace/board.storm",
};

describe("vsCodeLaunchArgs", () => {
  const args = vsCodeLaunchArgs("/repo/apps/vscode", paths);

  it("starts VS Code the way its own test runner does, without telemetry, updates and prompts", () => {
    expect(args).toEqual(
      expect.arrayContaining([
        "--no-sandbox",
        "--disable-gpu-sandbox",
        "--disable-updates",
        "--skip-welcome",
        "--skip-release-notes",
        "--disable-workspace-trust",
        "--disable-telemetry",
        "--disable-crash-reporter",
        "--new-window",
      ]),
    );
  });

  it("runs on a throwaway profile with the modeler's extension in development mode", () => {
    expect(args).toContain("--user-data-dir=/tmp/run/user-data");
    expect(args).toContain("--extensions-dir=/tmp/run/extensions");
    expect(args).toContain("--extensionDevelopmentPath=/repo/apps/vscode");
  });

  it("opens the workspace and then the fixture in it, last", () => {
    expect(args.slice(-2)).toEqual(["/tmp/run/workspace", "/tmp/run/workspace/board.storm"]);
    expect(args.filter((arg) => !arg.startsWith("--"))).toHaveLength(2);
  });
});

describe("vsCodeUserSettings", () => {
  const settings = vsCodeUserSettings({
    colorTheme: "Default Dark Modern",
    fileName: "board.storm",
    viewType: "eventStorming.boardEditor",
  });

  it("sets the color theme and associates the fixture with the custom editor", () => {
    expect(settings["workbench.colorTheme"]).toBe("Default Dark Modern");
    expect(settings["workbench.editorAssociations"]).toEqual({ "board.storm": "eventStorming.boardEditor" });
  });

  it("dispatches keys by key code, so Playwright's US keys mean the same on every keyboard layout", () => {
    expect(settings["keyboard.dispatch"]).toBe("keyCode");
  });

  it("keeps the OS's mode and contrast from overriding the theme under test", () => {
    expect(settings["window.autoDetectColorScheme"]).toBe(false);
    expect(settings["window.autoDetectHighContrast"]).toBe(false);
  });

  it("turns off telemetry, updates, the start page, the chat and auto save", () => {
    expect(settings).toMatchObject({
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "workbench.startupEditor": "none",
      "chat.disableAIFeatures": true,
      "files.autoSave": "off",
      "files.insertFinalNewline": false,
      "files.trimTrailingWhitespace": false,
    });
  });

  it("lets extra settings win", () => {
    const extra = vsCodeUserSettings({
      colorTheme: "Default Light Modern",
      fileName: "map.wmap",
      viewType: "wardley.mapEditor",
      extra: { "workbench.reduceMotion": "on", "files.autoSave": "afterDelay" },
    });
    expect(extra["workbench.reduceMotion"]).toBe("on");
    expect(extra["files.autoSave"]).toBe("afterDelay");
  });
});

describe("vsCodeEnvironment", () => {
  it("drops the variables of a surrounding VS Code and ELECTRON_RUN_AS_NODE", () => {
    expect(
      vsCodeEnvironment({
        PATH: "/usr/bin",
        HOME: "/home/ci",
        VSCODE_IPC_HOOK_CLI: "/tmp/ipc.sock",
        vscode_pid: "12",
        ELECTRON_RUN_AS_NODE: "1",
        UNSET: undefined,
      }),
    ).toEqual({ PATH: "/usr/bin", HOME: "/home/ci" });
  });
});

describe("platformKeys", () => {
  it("uses Cmd on macOS, with Cmd+Shift+Z for redo", () => {
    expect(platformKeys("darwin")).toEqual({
      modifier: "Meta",
      save: "Meta+s",
      undo: "Meta+z",
      redo: "Meta+Shift+z",
      close: "Meta+w",
    });
  });

  it("uses Ctrl elsewhere, with Ctrl+Y for redo", () => {
    for (const platform of ["linux", "win32"]) {
      expect(platformKeys(platform)).toEqual({
        modifier: "Control",
        save: "Control+s",
        undo: "Control+z",
        redo: "Control+y",
        close: "Control+w",
      });
    }
  });
});

const manifest: ExtensionManifest = {
  name: "team-topologies-modeler",
  publisher: "miragon-gmbh",
  main: "./dist/extension.cjs",
  contributes: {
    customEditors: [
      {
        viewType: "teamTopologies.editor",
        selector: [{ filenamePattern: "*.tt" }, { filenamePattern: "*.ttm.json" }],
      },
      {
        viewType: "teamTopologies.pngEditor",
        selector: [{ filenamePattern: "*.tt.png" }, { filenamePattern: "*.ttm.png" }],
      },
    ],
  },
};

describe("extensionIdOf", () => {
  it("is publisher.name", () => {
    expect(extensionIdOf(manifest)).toBe("miragon-gmbh.team-topologies-modeler");
  });

  it("is undefined without a publisher", () => {
    expect(extensionIdOf({ name: "modeler" })).toBeUndefined();
  });
});

describe("matchesFilenamePattern", () => {
  it("matches the base name against a star pattern", () => {
    expect(matchesFilenamePattern("*.storm", "board.storm")).toBe(true);
    expect(matchesFilenamePattern("*.storm", "board.storm.bak")).toBe(false);
    expect(matchesFilenamePattern("*.ttm.json", "teams.ttm.json")).toBe(true);
    expect(matchesFilenamePattern("*.ttm.json", "teams.json")).toBe(false);
  });

  it("knows ?, braces and VS Code's case-insensitive matching", () => {
    expect(matchesFilenamePattern("map.?map", "map.wmap")).toBe(true);
    expect(matchesFilenamePattern("*.{wmap,owm}", "tea.owm")).toBe(true);
    expect(matchesFilenamePattern("*.{wmap,owm}", "tea.md")).toBe(false);
    expect(matchesFilenamePattern("*.WMAP", "tea.wmap")).toBe(true);
  });

  it("takes dots and other regular-expression characters literally", () => {
    expect(matchesFilenamePattern("*.vc", "chainxvc")).toBe(false);
    expect(matchesFilenamePattern("(a)+.vc", "(a)+.vc")).toBe(true);
  });
});

describe("customEditorViewType", () => {
  it("is the first custom editor whose selector matches", () => {
    expect(customEditorViewType(manifest, "teams.ttm.json")).toBe("teamTopologies.editor");
    expect(customEditorViewType(manifest, "teams.tt.png")).toBe("teamTopologies.pngEditor");
  });

  it("is undefined when no editor opens the file", () => {
    expect(customEditorViewType(manifest, "notes.md")).toBeUndefined();
    expect(customEditorViewType({}, "board.storm")).toBeUndefined();
  });
});

describe("isPlainFileName", () => {
  it("takes a file name without a path or glob characters", () => {
    expect(isPlainFileName("board.storm")).toBe(true);
    expect(isPlainFileName("teams.ttm.json")).toBe(true);
    for (const name of ["", ".hidden", "dir/board.storm", "*.storm", "a b.storm", "../board.storm"]) {
      expect(isPlainFileName(name)).toBe(false);
    }
  });
});
