/*
 * The diagram's entries of the chrome menu (guide §5.4), the same in every host. The types mirror
 * the menu groups of `@miragon/modeler-shell` structurally, so an app hands the result to the
 * shell as it is while the renderer never imports the shell. The Model group's "Legend" checkbox
 * is the shell's own, added with its legend.
 */

/** The icons the guide gives these entries (guide §5.14, the shell's common set). */
export type DiagramMenuIcon = "file-image" | "file-code-corner" | "keyboard";

interface DiagramMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: DiagramMenuIcon;
  readonly keepEnabledWhenReadOnly?: boolean;
}

export interface DiagramMenuAction extends DiagramMenuItem {
  readonly kind: "action";
  readonly shortcut?: string;
  onSelect(): void;
}

export interface DiagramMenuDialog extends DiagramMenuItem {
  readonly kind: "dialog";
  /** The chip of a key that opens the dialog as well, e.g. "?". */
  readonly shortcut?: string;
  onSelect(): void;
}

export type DiagramMenuEntry = DiagramMenuAction | DiagramMenuDialog;

export interface DiagramMenu {
  readonly model: readonly DiagramMenuEntry[];
  readonly export: readonly DiagramMenuEntry[];
  readonly help: readonly DiagramMenuEntry[];
}

export interface DiagramExport {
  onSelect(): void;
  /** The chip of an app key that runs the same export, e.g. "⌘S". */
  readonly shortcut?: string | undefined;
}

/**
 * The exports a host offers, in the guide's order: PNG first (the more frequent target), then SVG,
 * then the document itself where the host is not the file (the web app).
 */
export interface DiagramExports {
  readonly png: DiagramExport;
  readonly svg: DiagramExport;
  readonly json?: DiagramExport | undefined;
}

export interface DiagramMenuActions {
  readonly exports: DiagramExports;
  showKeyboardShortcuts(): void;
  /** Opens the "Diagram title…" dialog; without it the Model group has no title entry. */
  editTitle?: (() => void) | undefined;
  /** The chip of a key the host binds to the shortcuts dialog as well, e.g. "?" in the web app. */
  readonly shortcutsKey?: string | undefined;
}

/** The label of the JSON export, also its row in the shortcuts dialog's File group. */
export const JSON_EXPORT_LABEL = "Export as JSON";

/** The key the web app opens the shortcuts dialog with, listed in the dialog's View group. */
export const SHORTCUTS_DIALOG_KEY = "?";

function exportEntry(
  id: string,
  label: string,
  action: DiagramExport,
  icon?: DiagramMenuIcon,
): DiagramMenuAction {
  return {
    kind: "action",
    id,
    label,
    ...(icon ? { icon } : {}),
    ...(action.shortcut ? { shortcut: action.shortcut } : {}),
    onSelect: () => action.onSelect(),
  };
}

/**
 * The menu groups of the diagram (guide §5.4): Model with "Diagram title…" where the host renames
 * the diagram (it changes the document, so a read-only canvas disables it), Export with PNG first,
 * Help with the shortcuts dialog.
 */
export function diagramMenu(actions: DiagramMenuActions): DiagramMenu {
  const { editTitle, exports, shortcutsKey } = actions;
  return {
    model: editTitle
      ? [
          {
            kind: "dialog",
            id: "diagram-title",
            label: "Diagram title…",
            onSelect: () => editTitle(),
          },
        ]
      : [],
    export: [
      exportEntry("export-png", "Export as PNG", exports.png, "file-image"),
      exportEntry("export-svg", "Export as SVG", exports.svg, "file-code-corner"),
      ...(exports.json ? [exportEntry("export-json", JSON_EXPORT_LABEL, exports.json)] : []),
    ],
    help: [
      {
        kind: "dialog",
        id: "keyboard-shortcuts",
        label: "Keyboard shortcuts…",
        icon: "keyboard",
        ...(shortcutsKey ? { shortcut: shortcutsKey } : {}),
        onSelect: () => actions.showKeyboardShortcuts(),
      },
    ],
  };
}
