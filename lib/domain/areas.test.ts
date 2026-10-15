/**
 * @jest-environment node
 */
import { AREA_IDS, AREAS, customAreaError } from "./areas";

describe("AREAS", () => {
  it("has 16 unique ids", () => {
    expect(AREAS).toHaveLength(16);
    expect(new Set(AREA_IDS).size).toBe(16);
  });

  it("uses the spec's labels in order", () => {
    expect(AREAS.map((area) => area.label)).toEqual([
      "React internals",
      "Next.js",
      "Node runtime",
      "Advanced TypeScript",
      "Postgres & databases",
      "GraphQL & API design",
      "Testing strategy",
      "Web performance",
      "Security",
      "System design",
      "Architecture patterns",
      "Distributed systems",
      "CI/CD & DevOps",
      "Observability",
      "CS fundamentals",
      "Engineering leadership & practices",
    ]);
  });
});

describe("customAreaError", () => {
  it.each([
    ["", [], "Type an area name."],
    ["x".repeat(41), [], "Keep it under 40 characters."],
    ["next.JS", [], "That area already exists."],
    ["NextJS", [], "That area already exists."],
    ["foo", ["Foo"], "That area already exists."],
    ["My area", [], null],
  ])("%p with %p -> %p", (name, others, expected) => {
    expect(customAreaError(name, others)).toBe(expected);
  });
});
