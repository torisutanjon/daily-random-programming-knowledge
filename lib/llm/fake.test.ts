/**
 * @jest-environment node
 */
import { createFakeProvider } from "./fake";
import { FAKE_WORDS } from "./fake-words";
import { generatedWordSchema } from "./types";

const provider = createFakeProvider();
const base = { level: "mid-senior" as const, stackProfile: ["TypeScript"] };
const allTerms = FAKE_WORDS.map((fake) => fake.word.term);

describe("FAKE_WORDS", () => {
  it("has five schema-valid words with unique terms", () => {
    expect(FAKE_WORDS).toHaveLength(5);
    for (const fake of FAKE_WORDS) {
      expect(generatedWordSchema.safeParse(fake.word).success).toBe(true);
    }
    expect(new Set(allTerms.map((term) => term.toLowerCase())).size).toBe(5);
  });
});

describe("generateWord", () => {
  it("prefers an unused word in the requested area", async () => {
    const word = await provider.generateWord({ ...base, area: "node-runtime", pastTerms: [] });
    expect(word.term).toBe("Backpressure");
  });

  it("falls back to the first unused word when the area has none", async () => {
    const word = await provider.generateWord({ ...base, area: "security", pastTerms: [] });
    expect(word.term).toBe("MVCC");
  });

  it("skips past terms case-insensitively", async () => {
    const word = await provider.generateWord({ ...base, area: "postgres-databases", pastTerms: ["  mvcc "] });
    expect(word.term).not.toBe("MVCC");
  });

  it("makes up schema-valid demo words once the canned ones are used", async () => {
    const first = await provider.generateWord({ ...base, area: "security", pastTerms: allTerms });
    expect(first.term).toBe("Demo word 1");
    expect(generatedWordSchema.safeParse(first).success).toBe(true);

    const second = await provider.generateWord({ ...base, area: "security", pastTerms: [...allTerms, "demo word 1"] });
    expect(second.term).toBe("Demo word 2");
    expect(generatedWordSchema.safeParse(second).success).toBe(true);
  });

  it("never repeats a demo word even with gaps in history", async () => {
    const word = await provider.generateWord({ ...base, area: "security", pastTerms: [...allTerms, "Demo word 2"] });
    expect(word.term).toBe("Demo word 1");
  });

  it("is deterministic and returns a fresh copy each time", async () => {
    const input = { ...base, area: "react-internals" as const, pastTerms: [] };
    const first = await provider.generateWord(input);
    first.topics[0].title = "changed";
    const second = await provider.generateWord(input);
    expect(second.topics[0].title).not.toBe("changed");
    expect(second).toEqual(await provider.generateWord(input));
  });
});

describe("gradeAnswer", () => {
  const question = { prompt: "Why?", rubric: ["SECRET-RUBRIC"] };

  it.each<[number, string]>([
    [69, "fail"],
    [70, "partial"],
    [199, "partial"],
    [200, "pass"],
  ])("grades a %i-character answer as %s", async (length, verdict) => {
    const grade = await provider.gradeAnswer({ ...question, answer: "x".repeat(length) });
    expect(grade.verdict).toBe(verdict);
  });

  it("ignores surrounding whitespace", async () => {
    const grade = await provider.gradeAnswer({ ...question, answer: `   ${"x".repeat(69)}   ` });
    expect(grade.verdict).toBe("fail");
  });

  it("never puts rubric or model-answer text in feedback", async () => {
    for (const { word } of FAKE_WORDS) {
      for (const topic of word.topics) {
        for (const q of topic.questions) {
          for (const length of [10, 100, 300]) {
            const { feedback } = await provider.gradeAnswer({ prompt: q.prompt, rubric: q.rubric, answer: "x".repeat(length) });
            expect(feedback.length).toBeGreaterThan(0);
            for (const point of q.rubric) expect(feedback).not.toContain(point);
            expect(feedback).not.toContain(q.modelAnswer);
          }
        }
      }
    }
  });
});
