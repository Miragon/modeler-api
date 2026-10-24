/**
 * Renames the diagram: the title lives on the root's business object, not on an element, so it
 * gets a command of its own. Through the command stack the rename is undoable and reaches every
 * `commandStack.changed` listener (a host that saves on it, the collaborative-modeler contract's
 * content events) like any element edit.
 */

import type CommandHandler from "diagram-js/lib/command/CommandHandler";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Element, Root } from "diagram-js/lib/model/Types";
import { ROOT_ID, type RootBusinessObject } from "../../io/types.js";

export interface UpdateTitleContext {
  title: string;
  /** set by the handler (for revert). */
  oldTitle?: string;
}

type DocumentRoot = Root & { businessObject?: RootBusinessObject };

export default class UpdateTitleHandler implements CommandHandler {
  static $inject = ["elementRegistry"];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  private root(): DocumentRoot {
    const root = this.elementRegistry.get(ROOT_ID) as DocumentRoot | undefined;
    if (!root?.businessObject) throw new Error("No context map is loaded to rename.");
    return root;
  }

  execute(context: UpdateTitleContext): Element[] {
    const root = this.root();
    const current = root.businessObject!;
    context.oldTitle = current.title;
    root.businessObject = { ...current, title: context.title };
    return [];
  }

  revert(context: UpdateTitleContext): Element[] {
    const root = this.root();
    root.businessObject = { ...root.businessObject!, title: context.oldTitle ?? "" };
    return [];
  }
}
