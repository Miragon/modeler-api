/**
 * The React context + hook for the diagram-js modeler, kept in its own
 * (component-free) module so Fast Refresh stays stable: editing the provider
 * never swaps the context identity out from under its consumers.
 */

import { createContext, useContext } from "react";
import type { Modeler } from "@miragon/context-maps-renderer";

export interface ModelerContextValue {
  modeler: Modeler;
  canUndo: boolean;
  canRedo: boolean;
  title: string;
  /** True while the document has no contexts and no relationships (drives the welcome card). */
  isEmpty: boolean;
  setTitle: (title: string) => void;
}

export const ModelerContext = createContext<ModelerContextValue | null>(null);

export function useModeler(): ModelerContextValue {
  const ctx = useContext(ModelerContext);
  if (!ctx) throw new Error("useModeler must be used within <ModelerProvider>");
  return ctx;
}
