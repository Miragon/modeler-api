// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { activate } from "../src/extension.js";
import { vscodeMock } from "./__mocks__/vscode.js";

interface Manifest {
  contributes: {
    commands: Array<{ command: string; title: string; category: string }>;
    menus: Record<string, Array<{ command: string; when?: string; group?: string }>>;
    walkthroughs: Array<{ steps: Array<{ id: string; completionEvents: string[] }> }>;
    keybindings?: unknown;
  };
}

const manifestText = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const manifest = JSON.parse(manifestText) as Manifest;

beforeEach(() => vscodeMock.reset());

describe("the extension's contributions (guide §13.5)", () => {
  it("shows no em dash in a title or description of the manifest", () => {
    expect(manifestText).not.toContain("\u2014");
  });

  it("registers every contributed command on activation", () => {
    activate({ subscriptions: [], extensionUri: { path: "/extension" } } as never);
    expect(vscodeMock.registeredCommandIds().sort()).toEqual(
      manifest.contributes.commands.map((command) => command.command).sort(),
    );
  });

  it("offers Fit to View and the exports as commands of the category, in Title Case", () => {
    const titles = Object.fromEntries(
      manifest.contributes.commands.map((command) => [command.command, command.title]),
    );
    expect(titles).toMatchObject({
      "contextMaps.fitView": "Fit to View",
      "contextMaps.exportPng": "Export as PNG",
      "contextMaps.exportSvg": "Export as SVG",
      "contextMaps.exportJson": "Export as JSON",
      "contextMaps.exportCml": "Export as CML",
      "contextMaps.openSource": "Open Source to the Side",
      "contextMaps.openDiagram": "Open Diagram to the Side",
    });
    for (const command of manifest.contributes.commands) {
      expect(command.category).toBe("Context Maps");
    }
  });

  it("puts source and diagram side by side in the editor title's navigation", () => {
    const title = manifest.contributes.menus["editor/title"]!;
    expect(
      title.filter((entry) => entry.group === "navigation").map((entry) => entry.command),
    ).toEqual(["contextMaps.openSource", "contextMaps.openDiagram"]);
  });

  it("walks through New, Example and Source, and binds no keys of its own", () => {
    expect(manifest.contributes.walkthroughs[0]!.steps.map((step) => step.id)).toEqual([
      "new",
      "example",
      "source",
      "learn",
    ]);
    expect(manifest.contributes.keybindings).toBeUndefined();
  });
});
