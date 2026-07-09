/**
 * High-level Context Maps mutations that go through the command stack
 * (undo/redo). Registers the generic property command handler.
 */

import type CommandStack from "diagram-js/lib/command/CommandStack";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type GraphicsFactory from "diagram-js/lib/core/GraphicsFactory";
import {
  isSymmetricPattern,
  type DownstreamRole,
  type RelationshipPattern,
  type SubdomainType,
  type UpstreamRole,
} from "@miragon/context-maps-schema-model";
import type { CmContext, CmElement, CmRelationship } from "../model/di-types.js";
import { isCmRelationship } from "../model/di-types.js";
import UpdatePropertiesHandler from "./cmd/UpdatePropertiesHandler.js";
import SwapEndsHandler, { type SwapEndsContext } from "./cmd/SwapEndsHandler.js";

const UPDATE_PROPERTIES = "element.updateProperties";
const SWAP_ENDS = "relationship.swapEnds";

export default class CmModeling {
  static $inject = ["commandStack", "elementRegistry", "graphicsFactory"];

  constructor(
    private readonly commandStack: CommandStack,
    private readonly elementRegistry: ElementRegistry,
    private readonly graphicsFactory: GraphicsFactory,
  ) {
    commandStack.registerHandler(UPDATE_PROPERTIES, UpdatePropertiesHandler);
    commandStack.registerHandler(SWAP_ENDS, SwapEndsHandler);
  }

  /**
   * Force an immediate re-render of an element's graphics. diagram-js'
   * ChangeSupport only redraws on `elements.changed` when `element.parent` is
   * set; this guarantees the visual reflects a property/swap change regardless
   * (a redundant redraw is harmless — the visual layer is cleared first).
   */
  private redraw(element: CmElement): void {
    const gfx = this.elementRegistry.getGraphics(element);
    if (!gfx) return;
    this.graphicsFactory.update(isCmRelationship(element) ? "connection" : "shape", element, gfx);
  }

  /** Swap the two ends of a relationship (reverse upstream/downstream). */
  swapEnds(relationship: CmRelationship): void {
    this.commandStack.execute(SWAP_ENDS, {
      connection: relationship,
    } as unknown as SwapEndsContext);
    this.redraw(relationship);
  }

  updateProperties(element: CmElement, properties: Record<string, unknown>): void {
    this.commandStack.execute(UPDATE_PROPERTIES, { element, properties });
    this.redraw(element);
  }

  /** Rename / relabel any element. */
  updateLabel(element: CmElement, label: string): void {
    this.updateProperties(element, { cmLabel: label || undefined });
  }

  // --- context ------------------------------------------------------------

  setSubdomainType(context: CmContext, subdomainType: SubdomainType | undefined): void {
    this.updateProperties(context, { subdomainType });
  }

  setTeam(context: CmContext, team: string | undefined): void {
    this.updateProperties(context, { team: team || undefined });
  }

  setDescription(context: CmContext, description: string | undefined): void {
    this.updateProperties(context, { description: description || undefined });
  }

  /** Set or clear per-element colour overrides (`undefined` reverts to default). */
  setColors(context: CmContext, fill: string | undefined, stroke: string | undefined): void {
    this.updateProperties(context, { fill, stroke });
  }

  // --- relationship -------------------------------------------------------

  /**
   * Switch the pattern and sanitise the roles so the result is always valid:
   * symmetric patterns carry no roles; customer-supplier drops the inapplicable
   * OHS (upstream) and CF (downstream).
   */
  setPattern(relationship: CmRelationship, pattern: RelationshipPattern): void {
    const props: Record<string, unknown> = { pattern };
    if (isSymmetricPattern(pattern)) {
      props.upstreamRoles = undefined;
      props.downstreamRoles = undefined;
    } else if (pattern === "customer-supplier") {
      const up = (relationship.upstreamRoles ?? []).filter((r) => r !== "OHS");
      const down = (relationship.downstreamRoles ?? []).filter((r) => r !== "CF");
      props.upstreamRoles = up.length ? up : undefined;
      props.downstreamRoles = down.length ? down : undefined;
    }
    this.updateProperties(relationship, props);
  }

  setUpstreamRoles(relationship: CmRelationship, roles: UpstreamRole[]): void {
    this.updateProperties(relationship, { upstreamRoles: roles.length ? roles : undefined });
  }

  setDownstreamRoles(relationship: CmRelationship, roles: DownstreamRole[]): void {
    this.updateProperties(relationship, { downstreamRoles: roles.length ? roles : undefined });
  }

  setImplementationTechnology(relationship: CmRelationship, tech: string | undefined): void {
    this.updateProperties(relationship, { implementationTechnology: tech || undefined });
  }
}
