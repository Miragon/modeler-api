/**
 * Element factory that assigns model-style random ids (`ctx_…`, `rel_…`) when
 * none is provided. diagram-js' stock factory numbers elements with a session
 * counter that restarts on every page load and is never advanced past ids
 * arriving via import — after a reload, drawing a connection would re-generate
 * an id already taken by an imported relationship (e.g. `connection_13`) and
 * the create command would die with "element already exists", silently
 * dropping the just-drawn line.
 */

import ElementFactory from "diagram-js/lib/core/ElementFactory";
import type { Connection, Label, Root, Shape } from "diagram-js/lib/model/Types";
import { newId } from "@miragon/context-maps-schema-model";

export default class CmDiagramElementFactory extends ElementFactory {
  override create(type: "root", attrs?: Partial<Root>): Root;
  override create(type: "shape", attrs?: Partial<Shape>): Shape;
  override create(type: "connection", attrs?: Partial<Connection>): Connection;
  override create(type: "label", attrs?: Partial<Label>): Label;
  override create(
    type: "root" | "shape" | "connection" | "label",
    attrs?: Partial<Root | Shape | Connection | Label>,
  ): Root | Shape | Connection | Label {
    if (!attrs?.id && (type === "shape" || type === "connection")) {
      attrs = { ...attrs, id: newId(type === "shape" ? "ctx" : "rel") };
    }
    return super.create(type as "shape", attrs as Partial<Shape>);
  }
}
