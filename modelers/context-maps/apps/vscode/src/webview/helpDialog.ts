/**
 * A small modal explaining the notation and keyboard shortcuts — vanilla-DOM
 * twin of the webapp's `HelpDialog.tsx`. Built once and toggled; closes on
 * backdrop click or Escape, restores focus to the trigger, and traps Tab.
 */

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ["Double-click element", "Rename"],
  ["Arrow on a selected context, click target", "Create a relationship"],
  ["⌘/Ctrl + Z", "Undo"],
  ["⇧⌘/Ctrl + Z, ⌘/Ctrl + Y", "Redo"],
  ["Delete / Backspace", "Remove selection"],
  ["Drag corner of context", "Resize"],
];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function createHelpDialog(root: HTMLElement): { open: () => void } {
  const overlay = document.createElement("div");
  overlay.className = "tt-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Help");
  overlay.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "tt-modal__backdrop";

  const panel = document.createElement("div");
  panel.className = "tt-modal__panel";

  const header = document.createElement("header");
  header.className = "tt-modal__header";
  const heading = document.createElement("h2");
  heading.textContent = "How to model with Context Maps";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "tt-legend__close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  header.append(heading, close);

  const body = document.createElement("div");
  body.className = "tt-modal__body";

  const intro = document.createElement("p");
  intro.innerHTML =
    "Model your system as <strong>bounded contexts</strong> (boxes, coloured by subdomain: core, " +
    "supporting, generic) connected by <strong>context-mapping relationships</strong> (Partnership, " +
    "Shared Kernel, Customer-Supplier, Upstream-Downstream, Separate Ways). Add integration roles — " +
    "OHS/PL upstream, ACL/CF downstream — and the inspector flags any combinations the strategic-DDD " +
    "rules disallow.";

  const shortcutsHeading = document.createElement("h3");
  shortcutsHeading.textContent = "Shortcuts";

  const table = document.createElement("table");
  table.className = "tt-shortcuts";
  const tbody = document.createElement("tbody");
  for (const [keys, action] of SHORTCUTS) {
    const row = document.createElement("tr");
    const keyCell = document.createElement("td");
    const kbd = document.createElement("kbd");
    kbd.textContent = keys;
    keyCell.append(kbd);
    const actionCell = document.createElement("td");
    actionCell.textContent = action;
    row.append(keyCell, actionCell);
    tbody.append(row);
  }
  table.append(tbody);

  const foot = document.createElement("p");
  foot.className = "tt-modal__foot";
  foot.innerHTML =
    "The <strong>.cm</strong>/<strong>.cm.json</strong> file is the source of truth — edit it here " +
    "or as text, version-control it with Git. Import Context Mapper <strong>CML</strong> via the menu.";

  body.append(intro, shortcutsHeading, table, foot);
  panel.append(header, body);
  overlay.append(backdrop, panel);
  root.append(overlay);

  let previouslyFocused: HTMLElement | null = null;

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function hide(): void {
    if (overlay.hidden) return;
    overlay.hidden = true;
    window.removeEventListener("keydown", onKey);
    previouslyFocused?.focus?.();
  }

  function open(): void {
    if (!overlay.hidden) return;
    previouslyFocused = document.activeElement as HTMLElement | null;
    overlay.hidden = false;
    window.addEventListener("keydown", onKey);
    close.focus();
  }

  backdrop.addEventListener("click", hide);
  close.addEventListener("click", hide);

  return { open };
}
