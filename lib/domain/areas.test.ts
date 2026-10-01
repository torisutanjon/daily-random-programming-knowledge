/**
 * @jest-environment node
 */
import { AREA_IDS, AREAS } from "./areas";

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
