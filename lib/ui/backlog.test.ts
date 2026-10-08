import { AREAS } from "@/lib/domain/areas";
import { defaultSettings } from "@/lib/domain/settings";
import type { Word } from "@/lib/domain/types";
import { makeWord } from "@/lib/test-utils/word";
import { buildBacklog } from "./backlog";

const NOW = new Date("2026-10-08T18:00:00.000Z"); // 14:00 New York, after default notify time
const TODAY = "2026-10-08";

function withStatuses(word: Word, ...statuses: Word["topics"][number]["questions"][number]["status"][]): Word {
  let i = 0;
  for (const topic of word.topics) for (const q of topic.questions) q.status = statuses[i++];
  return word;
}
const inArea = (word: Word, area: string): Word => ({ ...word, area: area as Word["area"] });
const build = (words: Word[], settings = defaultSettings()) => buildBacklog(words, settings, NOW);

describe("buildBacklog rows", () => {
  it("excludes today's word", () => {
    expect(build([makeWord(TODAY), makeWord("2026-10-07")]).rows.map((r) => r.dayKey)).toEqual(["2026-10-07"]);
  });

  it("orders newest first", () => {
    const rows = build([makeWord("2026-10-05"), makeWord("2026-10-07"), makeWord("2026-10-06")]).rows;
    expect(rows.map((r) => r.dayKey)).toEqual(["2026-10-07", "2026-10-06", "2026-10-05"]);
  });

  it("maps status: all revealed -> learned, some answered -> in-progress, none -> unanswered", () => {
    const rows = build([
      withStatuses(makeWord("2026-10-07"), "revealed", "revealed"),
      withStatuses(makeWord("2026-10-06"), "partial", "unanswered"),
      makeWord("2026-10-05"),
    ]).rows;
    expect(rows.map((r) => r.status)).toEqual(["learned", "in-progress", "unanswered"]);
  });

  it("fills date, area, level, term, segments and progress", () => {
    const [row] = build([withStatuses(makeWord("2026-10-05"), "learned", "revealed")]).rows;
    expect(row).toMatchObject({
      term: "Fixture",
      date: "Mon 5 Oct",
      area: AREAS.find((a) => a.id === "postgres-databases")?.label,
      level: "mid-senior",
      segments: ["learned", "revealed"],
      progress: "2/2",
    });
    expect(build([withStatuses(makeWord("2026-10-05"), "learned", "unanswered")]).rows[0].progress).toBe("1/2");
  });
});

describe("buildBacklog coverage", () => {
  it("lists all areas in AREAS order and counts today's word too", () => {
    const { coverage } = build([makeWord(TODAY), makeWord("2026-10-07")]);
    expect(coverage.map((c) => c.area)).toEqual(AREAS.map((a) => a.id));
    expect(coverage.find((c) => c.area === "postgres-databases")?.count).toBe(2);
  });

  it("counts a disabled area but marks it disabled", () => {
    const settings = { ...defaultSettings(), areas: defaultSettings().areas.filter((a) => a !== "postgres-databases") };
    const row = build([makeWord("2026-10-07")], settings).coverage.find((c) => c.area === "postgres-databases");
    expect(row).toMatchObject({ count: 1, enabled: false });
  });

  it("ignores unknown area ids without crashing", () => {
    const data = build([inArea(makeWord("2026-10-07"), "not-an-area")]);
    expect(data.coverage.reduce((n, c) => n + c.count, 0)).toBe(0);
    expect(data.covered).toBe(0);
    expect(data.rows).toHaveLength(1);
  });

  it("scales percent to the largest count (100 / 50 / 0) and counts covered areas", () => {
    const data = build([
      makeWord("2026-10-07"),
      makeWord("2026-10-06"),
      inArea(makeWord("2026-10-05"), "system-design"),
    ]);
    const pct = (id: string) => data.coverage.find((c) => c.area === id)?.percent;
    expect(pct("postgres-databases")).toBe(100);
    expect(pct("system-design")).toBe(50);
    expect(data.coverage.find((c) => c.count === 0)?.percent).toBe(0);
    expect(data.covered).toBe(2);
  });

  it("is all zero with no words", () => {
    const data = build([]);
    expect(data.rows).toEqual([]);
    expect(data.covered).toBe(0);
    expect(data.coverage.every((c) => c.percent === 0)).toBe(true);
  });
});

describe("buildBacklog client safety", () => {
  it("leaks no prompts, rubric, model answers or attempt text", () => {
    const word = makeWord("2026-10-07");
    word.topics[0].questions[0].attempts.push({
      answer: "SECRET-ATTEMPT-ANSWER",
      verdict: "partial",
      feedback: "SECRET-FEEDBACK",
      at: "2026-10-07T13:00:00.000Z",
    });
    const json = JSON.stringify(build([word, makeWord(TODAY)]));
    for (const hidden of ["Explain 1", "Point 1", "Answer 1", "SECRET-ATTEMPT-ANSWER", "SECRET-FEEDBACK"]) {
      expect(json).not.toContain(hidden);
    }
  });
});
