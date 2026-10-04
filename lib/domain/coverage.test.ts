/**
 * @jest-environment node
 */
import { AREA_IDS, type AreaId } from "./areas";
import { areaCounts, pickArea } from "./coverage";

// mulberry32: a small seedable PRNG returning [0, 1).
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const A: AreaId = "react-internals";
const B: AreaId = "nextjs";
const C: AreaId = "node-runtime";

describe("pickArea", () => {
  it("picks the first enabled area when rng returns 0", () => {
    expect(pickArea([], [B, A], () => 0)).toBe(B);
  });

  it("weights each area by 1 / (1 + count)", () => {
    // A seen 3 times → weight 0.25; B → 1; total 1.25.
    const history = [A, A, A];
    expect(pickArea(history, [A, B], () => 0.1)).toBe(A);
    expect(pickArea(history, [A, B], () => 0.3)).toBe(B);
    expect(pickArea(history, [A, B], () => 0.9999)).toBe(B);
  });

  it("ignores history for areas that aren't enabled", () => {
    expect(pickArea([A, A], [B, C], () => 0.49)).toBe(B);
    expect(pickArea([A, A], [B, C], () => 0.51)).toBe(C);
  });

  it("treats duplicate enabled areas as one", () => {
    // Deduped to [A, B]: 0.6 lands on B (it would land on A if A counted twice).
    expect(pickArea([], [A, A, B], () => 0.6)).toBe(B);
  });

  it("throws when no areas are enabled", () => {
    expect(() => pickArea([A], [], () => 0)).toThrow("No enabled areas");
  });

  it("favours the least-covered area over many draws", () => {
    const rng = seeded(42);
    let picksOfB = 0;
    for (let i = 0; i < 10_000; i++) {
      if (pickArea([A, A, A], [A, B], rng) === B) picksOfB++;
    }
    expect(picksOfB / 10_000).toBeGreaterThan(0.77);
    expect(picksOfB / 10_000).toBeLessThan(0.83);
  });
});

describe("areaCounts", () => {
  it("returns all 16 areas with count 0 for empty input", () => {
    const counts = areaCounts([]);
    expect(counts.length).toBe(16);
    expect(counts.every((c) => c.count === 0)).toBe(true);
    expect(counts.map((c) => c.area)).toEqual(AREA_IDS);
  });

  it("counts words by area, ignoring unknown areas", () => {
    const words = [
      { area: "nextjs" as const },
      { area: "nextjs" as const },
      { area: "security" as const },
      { area: "unknown-area" }, // unknown area, ignored
    ];
    const counts = areaCounts(words);
    expect(counts.filter((c) => c.count > 0)).toEqual([
      { area: "nextjs", count: 2 },
      { area: "security", count: 1 },
    ]);
  });

  it("ignores unknown areas and returns all known areas", () => {
    const words = [{ area: "unknown-area" }];
    const counts = areaCounts(words);
    expect(counts.length).toBe(16);
    expect(counts.every((c) => c.count === 0)).toBe(true);
  });
});
