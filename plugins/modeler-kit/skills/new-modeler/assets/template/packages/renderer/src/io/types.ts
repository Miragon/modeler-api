/** The id of the canvas root. Element ids never take it (`ELEMENT_ID_PATTERN` has no `:`). */
export const ROOT_ID = 'diagram:root';

/** Document-level data kept on the root element while editing. */
export interface RootBusinessObject {
  title?: string | undefined;
  passthrough: string[];
  /** The document's fields beyond the schema, written back on export. */
  extensions?: Record<string, unknown>;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
