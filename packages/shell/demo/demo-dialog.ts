/**
 * The Help group's "Keyboard shortcuts…" as a modeler shows it (guide §8): a modal `<dialog>` in the
 * shell root with a title and Close; Escape, Close and closing return the focus to where it was
 * (the menu trigger, which takes it before the entry's `onSelect` runs).
 */
export function openShortcutsDialog(root: HTMLElement): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement("dialog");
  dialog.className = "demo-dialog";
  dialog.setAttribute("aria-labelledby", "demo-dialog-title");
  const title = document.createElement("h2");
  title.id = "demo-dialog-title";
  title.className = "demo-dialog-title";
  title.textContent = "Keyboard shortcuts";
  const text = document.createElement("p");
  text.textContent = "Shift+1 fits the diagram, Cmd/Ctrl+0 shows it at 100 %.";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "demo-dialog-close";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    dialog.remove();
    opener?.focus();
  });
  dialog.append(title, text, close);
  root.append(dialog);
  dialog.showModal();
}
