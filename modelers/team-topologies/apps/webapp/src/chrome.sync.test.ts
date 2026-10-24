import { describe, expect, it } from "vitest";
import {
  commandKeyLabel,
  defaultMessages,
  formatPercent,
  resolveMessages,
  shortcutLabel,
  type ChromeKey,
  type LegendOptions,
  type MenuGroups,
  type Platform,
  type ShellHandle,
  type ShellMessages,
} from "@miragon/modeler-shell";
import {
  diagramMenu,
  diagramShortcuts,
  renderLegend,
  type DiagramMenu,
  type ShortcutsDialogChrome,
  type TitleDialogChrome,
} from "@miragon/team-topologies-renderer";

/*
 * The renderer builds the diagram's menu entries, shortcut tables and legend without importing the
 * shell (only the apps mount it), so it mirrors the shell's types and its key labels. These tests
 * pin the mirror: the View rows of the shortcuts dialog say what the zoom panel's tooltips say, the
 * File rows use the chips the shell writes, and menu, dialogs and legend take what the shell hands
 * them.
 */

const VIEW_KEYS: readonly ChromeKey[] = ["zoomIn", "zoomOut", "zoomToActual", "fit"];

const GERMAN = resolveMessages({
  zoomIn: "Vergrößern",
  zoomOut: "Verkleinern",
  zoomToActual: (percent) => `Auf ${percent}`,
  fit: "Einpassen",
  openFile: "Öffnen…",
  keyNames: { ctrl: "Strg", shift: "Umschalt" },
});

function viewActions(messages: ShellMessages, lang: string): string[] {
  return [
    messages.zoomIn,
    messages.zoomOut,
    messages.zoomToActual(formatPercent(1, lang)),
    messages.fit,
  ];
}

describe("the renderer's chrome content against @miragon/modeler-shell", () => {
  for (const [lang, messages] of [
    ["en", defaultMessages],
    ["de", GERMAN],
  ] as const) {
    for (const platform of ["mac", "other"] as const satisfies readonly Platform[]) {
      it(`the View rows equal the chrome tooltips (${lang}, ${platform})`, () => {
        const view = diagramShortcuts({ platform, lang, messages }).find(
          (group) => group.title === "View",
        );

        expect(view?.rows).toEqual(
          viewActions(messages, lang).map((action, index) => ({
            action,
            keys: [shortcutLabel(VIEW_KEYS[index]!, platform, messages.keyNames)],
          })),
        );
      });

      it(`the File rows name the shell's Open… and write its key chips (${lang}, ${platform})`, () => {
        const [file] = diagramShortcuts({ platform, lang, messages }, { fileKeys: true });

        expect(file).toEqual({
          title: "File",
          rows: [
            {
              action: messages.openFile,
              keys: [commandKeyLabel("O", platform, messages.keyNames)],
            },
            { action: "Export as JSON", keys: [commandKeyLabel("S", platform, messages.keyNames)] },
          ],
        });
      });
    }
  }

  it("falls back to English for a language tag the shell falls back on", () => {
    const [view] = diagramShortcuts({ platform: "mac", lang: "", messages: defaultMessages });
    expect(view?.rows[2]?.action).toBe(defaultMessages.zoomToActual(formatPercent(1, "")));
  });

  it("hands the shell a menu, a legend renderer, and takes a shell handle as dialog chrome", () => {
    const menu: DiagramMenu = diagramMenu({
      editTitle: () => undefined,
      exports: { png: { onSelect: () => undefined }, svg: { onSelect: () => undefined } },
      showKeyboardShortcuts: () => undefined,
      shortcutsKey: "?",
    });
    const groups: MenuGroups = menu;
    const render: LegendOptions["render"] = renderLegend;
    const shortcutsChrome = (shell: ShellHandle): ShortcutsDialogChrome => shell;
    const titleChrome = (shell: ShellHandle): TitleDialogChrome => shell;

    expect(groups.model?.map((entry) => entry.id)).toEqual(["diagram-title"]);
    expect(render).toBe(renderLegend);
    expect(shortcutsChrome).toBeTypeOf("function");
    expect(titleChrome).toBeTypeOf("function");
  });
});
