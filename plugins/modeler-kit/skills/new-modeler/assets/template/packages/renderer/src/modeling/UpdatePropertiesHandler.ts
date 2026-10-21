import type { Element } from 'diagram-js/lib/model/Types';

export interface UpdatePropertiesContext {
  element: Element;
  properties: Record<string, unknown>;
  oldProperties?: Record<string, unknown>;
}

/** One undoable property change; the returned element is re-rendered through `elements.changed`. */
export default class UpdatePropertiesHandler {
  execute(context: UpdatePropertiesContext): Element[] {
    const target = context.element as unknown as Record<string, unknown>;
    const old: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context.properties)) {
      old[key] = target[key];
      target[key] = value;
    }
    context.oldProperties = old;
    return [context.element];
  }

  revert(context: UpdatePropertiesContext): Element[] {
    const target = context.element as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(context.oldProperties ?? {})) target[key] = value;
    return [context.element];
  }
}
