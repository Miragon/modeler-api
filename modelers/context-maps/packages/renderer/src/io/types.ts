/** ID of the diagram-js root element holding the Context Maps diagram. */
export const ROOT_ID = "cm-root";

export interface ImportWarning {
  readonly message: string;
  readonly elementId?: string;
}

/** Diagram-level metadata stashed on the root element. */
export interface RootBusinessObject {
  title: string;
}
