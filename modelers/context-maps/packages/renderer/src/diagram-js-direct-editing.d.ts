/**
 * Ambient module declaration for diagram-js-direct-editing (plain-JS bpmn.io
 * package, ships no types). Only the bare module is declared — the service
 * surface this package uses is typed locally in CmLabelEditing so no untyped
 * import ever leaks into the published declaration files.
 */

declare module "diagram-js-direct-editing" {
  import type { ModuleDeclaration } from "didi";

  const directEditingModule: ModuleDeclaration;
  export default directEditingModule;
}
