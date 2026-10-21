import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultMessages, type AppearanceChoice } from "../../core/index.js";
import { createMenu } from "../menu.js";
import { createTooltip } from "../tooltip.js";
import type { AppearanceHandle, MenuEntry, MenuRadioGroup } from "../types.js";
import { appearanceMenuEntries, fileMenuEntries } from "./menu-groups.js";

afterEach(() => {
  document.body.replaceChildren();
});

function summary(entries: readonly MenuEntry[]) {
  return entries.map((entry) => ({
    kind: entry.kind,
    id: entry.id,
    label: entry.label,
    icon: "icon" in entry ? entry.icon : undefined,
  }));
}

describe("File group (guide §5.4, §2)", () => {
  it("builds New diagram, Open…, Show example and Import… in this order", () => {
    const entries = fileMenuEntries(
      {
        import: { onSelect() {} },
        showExample: { onSelect() {} },
        open: { onSelect() {} },
        newDiagram: { onSelect() {} },
      },
      defaultMessages,
    );
    expect(summary(entries)).toEqual([
      { kind: "action", id: "new-diagram", label: "New diagram", icon: "file-plus" },
      { kind: "action", id: "open", label: "Open…", icon: "folder-open" },
      { kind: "action", id: "show-example", label: "Show example", icon: undefined },
      { kind: "action", id: "import", label: "Import…", icon: "import" },
    ]);
  });

  it("has only the entries the modeler gives", () => {
    expect(fileMenuEntries({}, defaultMessages)).toEqual([]);
    expect(
      fileMenuEntries({ open: { onSelect() {} }, showExample: { onSelect() {} } }, defaultMessages).map(
        (entry) => entry.id,
      ),
    ).toEqual(["open", "show-example"]);
  });

  it("passes shortcut, disabled and the dialog kind through", () => {
    const disabled = () => true;
    const onImport = vi.fn();
    const [open, importEntry] = fileMenuEntries(
      {
        open: { onSelect() {}, shortcut: "⌘O", disabled },
        import: { onSelect: onImport, dialog: true, shortcut: "⌘I" },
      },
      defaultMessages,
    );
    expect(open).toMatchObject({ kind: "action", shortcut: "⌘O", disabled });
    expect(importEntry).toMatchObject({ kind: "dialog", id: "import", shortcut: "⌘I" });
    expect(importEntry && "disabled" in importEntry ? importEntry.disabled : undefined).toBeUndefined();
    if (importEntry?.kind !== "dialog") throw new Error("expected a dialog entry");
    importEntry.onSelect();
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("renders in the menu's file group, a dialog entry with aria-haspopup", () => {
    const root = document.createElement("div");
    const layer = document.createElement("div");
    root.append(layer);
    document.body.append(root);
    const file = fileMenuEntries(
      { newDiagram: { onSelect() {} }, open: { onSelect() {}, dialog: true } },
      defaultMessages,
    );
    const menu = createMenu({
      root,
      layer,
      id: "menu",
      messages: defaultMessages,
      tooltip: createTooltip({ root, layer, id: "tooltip" }),
      groups: {},
      shellEntries: (group) => (group === "file" ? file : []),
      isReadOnly: () => true,
      focusCanvas: () => false,
    });
    menu.open();
    const items = [...menu.dropdown.querySelectorAll("[data-menu-id]")];
    expect(items.map((item) => item.getAttribute("data-menu-group"))).toEqual(["file", "file"]);
    expect(items[1]?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(items.some((item) => item.getAttribute("aria-disabled") === "true")).toBe(false);
  });
});

describe("Appearance group (guide §5.4, §13.3)", () => {
  function handle(initial: AppearanceChoice = "system") {
    let choice = initial;
    const appearance: AppearanceHandle = {
      choice: () => choice,
      setChoice: vi.fn((next: AppearanceChoice) => {
        choice = next;
      }),
    };
    return appearance;
  }

  it("is one radio group System, Light, Dark", () => {
    const entries = appearanceMenuEntries(handle(), defaultMessages);
    expect(entries).toHaveLength(1);
    const group = entries[0] as MenuRadioGroup;
    expect(group.kind).toBe("radio");
    expect(group.id).toBe("appearance");
    expect(group.label).toBe("Appearance");
    expect(group.options).toEqual([
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ]);
    expect(group.disabled).toBeUndefined();
  });

  it("reads and writes the choice through the AppearanceHandle", () => {
    const appearance = handle("dark");
    const group = appearanceMenuEntries(appearance, defaultMessages)[0] as MenuRadioGroup;
    expect(group.value()).toBe("dark");
    group.onSelect("light");
    expect(appearance.setChoice).toHaveBeenLastCalledWith("light");
    expect(group.value()).toBe("light");
    group.onSelect("sepia");
    expect(appearance.setChoice).toHaveBeenLastCalledWith("system");
  });
});
