import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Element } from 'diagram-js/lib/model/Types';
import { ROOT_ID, type RootBusinessObject } from '../io/types.js';
import type { NodeShape } from '../model/di-types.js';
import UpdatePropertiesHandler from './UpdatePropertiesHandler.js';

const UPDATE_PROPERTIES = 'element.updateProperties';

type DiagramRoot = Element & { businessObject?: RootBusinessObject };

/**
 * The notation's own edits. Every document change goes through the command stack, so it is
 * undoable and reaches a host as a `commandStack.changed` (law L3): document settings such as
 * the title included, never an event of their own.
 */
export default class DomainModeling {
  static $inject = ['commandStack', 'elementRegistry'];

  constructor(
    private readonly commandStack: CommandStack,
    private readonly elementRegistry: ElementRegistry,
  ) {
    commandStack.registerHandler(UPDATE_PROPERTIES, UpdatePropertiesHandler);
  }

  updateLabel(element: NodeShape, label: string): void {
    if (label === element.elementLabel) return;
    this.commandStack.execute(UPDATE_PROPERTIES, { element, properties: { elementLabel: label } });
  }

  getTitle(): string | undefined {
    return this.root()?.businessObject?.title;
  }

  /** A document setting: one undoable command on the root's business object. */
  setTitle(title: string): void {
    const root = this.root();
    const data = root?.businessObject;
    if (!root || !data || data.title === title) return;
    this.commandStack.execute(UPDATE_PROPERTIES, {
      element: root,
      properties: { businessObject: { ...data, title } },
    });
  }

  private root(): DiagramRoot | undefined {
    return this.elementRegistry.get(ROOT_ID) as DiagramRoot | undefined;
  }
}
