/*
 * The context map's entries of the chrome menu (guide §5.4), the same in every host. The types
 * mirror the menu groups of `@miragon/modeler-shell` structurally, so an app hands the result to
 * the shell as it is while the renderer never imports the shell. The Model group's "Legend"
 * checkbox is the shell's own, added with its legend.
 */

/** The icons the guide gives these entries (guide §5.14, the shell's common set). */
export type MapMenuIcon = "file-image" | "file-code-corner" | "keyboard";

interface MapMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: MapMenuIcon;
  readonly keepEnabledWhenReadOnly?: boolean;
}

export interface MapMenuAction extends MapMenuItem {
  readonly kind: "action";
  readonly shortcut?: string;
  onSelect(): void;
}

export interface MapMenuDialog extends MapMenuItem {
  readonly kind: "dialog";
  onSelect(): void;
}

export type MapMenuEntry = MapMenuAction | MapMenuDialog;

export interface MapMenu {
  readonly model: readonly MapMenuEntry[];
  readonly export: readonly MapMenuEntry[];
  readonly help: readonly MapMenuEntry[];
}

export interface MapExport {
  onSelect(): void;
  /** The chip of an app key that runs the same export, e.g. "⌘S". */
  readonly shortcut?: string | undefined;
}

/**
 * The exports a host offers, in the guide's order: PNG first (the more frequent target), then
 * SVG, then the map's own JSON and Context Mapper's CML.
 */
export interface MapExports {
  readonly png: MapExport;
  readonly svg: MapExport;
  readonly json: MapExport;
  readonly cml: MapExport;
}

export interface MapMenuActions {
  readonly exports: MapExports;
  showKeyboardShortcuts(): void;
  /** Opens the dialog that renames the map; without it the Model group has no title entry. */
  editTitle?: (() => void) | undefined;
}

/** The map's native file in the Export group and in the shortcuts dialog. */
export const JSON_EXPORT_LABEL = "Export as JSON";

function exportEntry(
  id: string,
  label: string,
  action: MapExport,
  icon?: MapMenuIcon,
): MapMenuAction {
  return {
    kind: "action",
    id,
    label,
    ...(icon ? { icon } : {}),
    ...(action.shortcut ? { shortcut: action.shortcut } : {}),
    onSelect: () => action.onSelect(),
  };
}

/** The menu groups of the context map (guide §5.4): Model, Export with PNG first, Help. */
export function contextMapMenu(actions: MapMenuActions): MapMenu {
  const { editTitle } = actions;
  return {
    model: editTitle
      ? [{ kind: "dialog", id: "map-title", label: "Map title…", onSelect: () => editTitle() }]
      : [],
    export: [
      exportEntry("export-png", "Export as PNG", actions.exports.png, "file-image"),
      exportEntry("export-svg", "Export as SVG", actions.exports.svg, "file-code-corner"),
      exportEntry("export-json", JSON_EXPORT_LABEL, actions.exports.json),
      exportEntry("export-cml", "Export as CML", actions.exports.cml),
    ],
    help: [
      {
        kind: "dialog",
        id: "keyboard-shortcuts",
        label: "Keyboard shortcuts…",
        icon: "keyboard",
        onSelect: () => actions.showKeyboardShortcuts(),
      },
    ],
  };
}
