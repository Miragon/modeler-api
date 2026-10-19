import { describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT, serializeDocumentText } from "@miragon/context-maps-schema-model";
import { mapProblems, problemCounts } from "../src/problems.js";

const sample = serializeDocumentText(SAMPLE_DOCUMENT);

function textOf(text: string, problem: { start: number; end: number }): string {
  return text.slice(problem.start, problem.end);
}

describe("mapProblems", () => {
  it("finds nothing in the example or in an empty file", () => {
    expect(mapProblems(sample)).toEqual([]);
    expect(mapProblems("")).toEqual([]);
  });

  it("reports a JSON syntax error at its position", () => {
    const text = '{ "version": 1, "title": }';
    const [problem] = mapProblems(text);
    expect(problem).toMatchObject({
      severity: "error",
      message: "Not valid JSON: value expected.",
    });
    expect(problem!.start).toBe(text.indexOf("}"));
  });

  it("points a structural error at the offending property", () => {
    const text = sample.replace('"x": 340', '"x": "left"');
    const [problem] = mapProblems(text);
    expect(problem!.severity).toBe("error");
    expect(problem!.message).toMatch(/^contexts\.1\.position\.x: /);
    expect(textOf(text, problem!)).toBe('"x": "left"');
  });

  it("puts a semantic finding on the relationship's object", () => {
    const text = sample.replace(
      '"pattern": "customer-supplier",\n      "upstreamRoles": [\n        "PL"\n      ],',
      '"pattern": "customer-supplier",\n      "upstreamRoles": [\n        "OHS"\n      ],',
    );
    const problems = mapProblems(text);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ severity: "error", rule: "generic-vs-custom-service" });
    const object = textOf(text, problems[0]!);
    expect(object.startsWith("{")).toBe(true);
    expect(object).toContain('"id": "rel_evaluation_schedule"');
    expect(object.endsWith("}")).toBe(true);
  });

  it("reports warnings as warnings and counts the errors among them", () => {
    const text = sample.replace(
      '"pattern": "customer-supplier",\n      "upstreamRoles": [\n        "PL"\n      ],',
      '"pattern": "customer-supplier",\n      "downstreamRoles": [\n        "ACL"\n      ],',
    );
    const problems = mapProblems(text);
    expect(problems.map((problem) => problem.severity)).toEqual(["warning"]);
    expect(problemCounts(problems)).toEqual({ count: 1, errors: 0 });
  });

  it("names an id the canvas keeps for itself at that id", () => {
    const text = sample.replace('"id": "ctx_cfp"', '"id": "cm-root"');
    const problems = mapProblems(text);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toMatch(/^contexts\.\d+\.id: the id "cm-root" is reserved/);
    expect(textOf(text, problems[0]!)).toBe('"id": "cm-root"');
  });

  it("puts a duplicate id on its copy", () => {
    const text = sample.replace('"id": "ctx_cfp"', '"id": "ctx_auth"');
    const duplicate = mapProblems(text).find((problem) => problem.rule === "unique-ids");
    expect(textOf(text, duplicate!)).toContain('"label": "CfP Management"');
  });
});
