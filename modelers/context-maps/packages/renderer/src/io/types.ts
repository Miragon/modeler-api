import { DIAGRAM_ROOT_ID, type Relationship } from "@miragon/context-maps-schema-model";

export { isReservedId } from "@miragon/context-maps-schema-model";

/** ID of the diagram-js root element holding the Context Maps diagram. */
export const ROOT_ID = DIAGRAM_ROOT_ID;

export interface ImportWarning {
  readonly message: string;
  readonly elementId?: string;
}

/** Diagram-level data stashed on the root element. */
export interface RootBusinessObject {
  title: string;
  /** Keys of the document this version does not know, written back on export. */
  foreign?: Record<string, unknown>;
  /**
   * Relationships whose ends are not both contexts of the map. The canvas cannot draw them, but
   * they stay in the document (and in the Problems view) until the text fixes them.
   */
  unplacedRelationships?: Relationship[];
}
