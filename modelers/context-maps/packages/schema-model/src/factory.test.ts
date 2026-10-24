import { describe, expect, it } from "vitest";
import { createBoundedContext, createRelationship, emptyDocument } from "./factory";
import { SUBDOMAIN_TYPE_SPECS } from "./notation";

describe("factory", () => {
  it("creates a bounded context with notation defaults", () => {
    const ctx = createBoundedContext("core", { x: 5, y: 6 });
    expect(ctx.subdomainType).toBe("core");
    expect(ctx.position).toEqual({ x: 5, y: 6 });
    expect(ctx.size).toEqual(SUBDOMAIN_TYPE_SPECS.core.defaultSize);
    expect(ctx.id).toMatch(/^ctx_/);
  });

  it("creates unique ids", () => {
    const a = createBoundedContext("generic", { x: 0, y: 0 });
    const b = createBoundedContext("generic", { x: 0, y: 0 });
    expect(a.id).not.toBe(b.id);
  });

  it("creates a relationship with roles on asymmetric patterns", () => {
    const rel = createRelationship("a", "b", "upstream-downstream", {
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
    });
    expect(rel.from).toBe("a");
    expect(rel.to).toBe("b");
    expect(rel.upstreamRoles).toEqual(["OHS"]);
    expect(rel.downstreamRoles).toEqual(["ACL"]);
    expect(rel.id).toMatch(/^rel_/);
  });

  it("drops roles on symmetric patterns", () => {
    const rel = createRelationship("a", "b", "partnership", {
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
    });
    expect(rel.upstreamRoles).toBeUndefined();
    expect(rel.downstreamRoles).toBeUndefined();
  });

  it("creates an empty document", () => {
    const doc = emptyDocument("My map");
    expect(doc).toMatchObject({
      version: 1,
      title: "My map",
      contexts: [],
      relationships: [],
    });
  });
});
