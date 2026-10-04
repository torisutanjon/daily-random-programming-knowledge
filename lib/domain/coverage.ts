import { AREAS, type AreaId } from "./areas";

export interface AreaCount {
  area: AreaId;
  count: number;
}

/** One entry per area in AREAS order, zero included; words with an unknown area are ignored. */
export function areaCounts(words: readonly { area: string }[]): AreaCount[] {
  const tally = new Map<string, number>();
  for (const word of words) {
    tally.set(word.area, (tally.get(word.area) ?? 0) + 1);
  }
  return AREAS.map(({ id }) => ({ area: id, count: tally.get(id) ?? 0 }));
}

/** Weighted-random area, favouring areas with the fewest past words (weight = 1 / (1 + count)). */
export function pickArea(
  history: readonly AreaId[],
  enabledAreas: readonly AreaId[],
  rng: () => number,
): AreaId {
  const areas = [...new Set(enabledAreas)];
  if (areas.length === 0) throw new Error("No enabled areas");

  const counts = new Map<AreaId, number>();
  for (const area of history) counts.set(area, (counts.get(area) ?? 0) + 1);

  const weights = areas.map((area) => 1 / (1 + (counts.get(area) ?? 0)));
  let remaining = rng() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < areas.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return areas[i];
  }
  return areas[areas.length - 1]; // float rounding when rng() is close to 1
}
