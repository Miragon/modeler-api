import {
  commandKeyLabel,
  defaultMessages,
  detectPlatform,
  iconElement,
  shortcutLabel,
  type ChromeKey,
} from "../src/index.js";

/** One table of the dialog: a group of shortcuts, each an action and its chip (guide §5.4). */
interface ShortcutGroup {
  title: string;
  rows: ReadonlyArray<readonly [action: string, chip: string]>;
}

function shortcutGroups(): ShortcutGroup[] {
  const platform = detectPlatform(navigator);
  const { keyNames } = defaultMessages;
  const chrome = (key: ChromeKey) => shortcutLabel(key, platform, keyNames);
  return [
    {
      title: "View",
      rows: [
        [defaultMessages.zoomIn, chrome("zoomIn")],
        [defaultMessages.zoomOut, chrome("zoomOut")],
        [defaultMessages.zoomToActual("100 %"), chrome("zoomToActual")],
        [defaultMessages.fit, chrome("fit")],
      ],
    },
    {
      title: "Edit",
      rows: [
        ["Select all", commandKeyLabel("A", platform, keyNames)],
        ["Delete", "Delete"],
      ],
    },
    {
      title: "Tools",
      rows: [
        ["Lasso tool", "L"],
        ["Hand tool", "H"],
      ],
    },
  ];
}

function shortcutTable({ title, rows }: ShortcutGroup): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "demo-shortcuts";
  table.createCaption().textContent = title;
  const body = table.createTBody();
  for (const [action, chip] of rows) {
    const row = body.insertRow();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = action;
    const keys = document.createElement("kbd");
    keys.className = "cd-shell-kbd";
    keys.textContent = chip;
    row.append(name);
    row.insertCell().append(keys);
  }
  return table;
}

/**
 * The Help group's "Keyboard shortcuts…" as a modeler shows it (guide §5.4, §8): a modal
 * `<dialog>` in the shell root with a title, Close and a table per group. Escape, Close and a click
 * on the backdrop close it and return the focus to where it was (the menu trigger, which takes it
 * before the entry's `onSelect` runs).
 */
export function openShortcutsDialog(root: HTMLElement): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement("dialog");
  dialog.className = "demo-dialog";
  dialog.setAttribute("aria-labelledby", "demo-dialog-title");
  const header = document.createElement("div");
  header.className = "demo-dialog-header";
  const title = document.createElement("h3");
  title.id = "demo-dialog-title";
  title.className = "demo-dialog-title";
  title.textContent = "Keyboard shortcuts";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "demo-dialog-close";
  close.setAttribute("aria-label", defaultMessages.close);
  close.append(iconElement("x"));
  close.addEventListener("click", () => dialog.close());
  header.append(title, close);
  const body = document.createElement("div");
  body.className = "demo-dialog-body";
  body.append(...shortcutGroups().map(shortcutTable));
  // Header and body cover the whole panel, so a click on the dialog itself is one on its backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    opener?.focus();
  });
  dialog.append(header, body);
  root.append(dialog);
  dialog.showModal();
}
