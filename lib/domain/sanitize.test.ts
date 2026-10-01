/**
 * @jest-environment node
 */
import { sanitizeWord } from "./sanitize";
import type { Attempt, Question, Word } from "./types";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    prompt: "What is MVCC?",
    rubric: ["SECRET-RUBRIC"],
    modelAnswer: "SECRET-ANSWER",
    status: "unanswered",
    revealedAt: null,
    attempts: [],
    ...overrides,
  };
}

function word(questions: Question[]): Word {
  return {
    dayKey: "2026-10-01",
    term: "MVCC",
    subtitle: "Multi-version concurrency control",
    area: "postgres-databases",
    level: "mid-senior",
    topics: [{ id: "t1", title: "Snapshots", questions }],
    createdAt: "2026-10-01T01:00:00.000Z",
    provider: "fake",
  };
}

describe("sanitizeWord", () => {
  it("hides rubric and modelAnswer for questions that aren't revealed", () => {
    const out = sanitizeWord(
      word([question(), question({ id: "q2", status: "partial" }), question({ id: "q3", status: "learned" })]),
    );
    for (const q of out.topics[0].questions) {
      expect(q).not.toHaveProperty("rubric");
      expect(q).not.toHaveProperty("modelAnswer");
    }
    const json = JSON.stringify(out);
    expect(json).not.toContain("SECRET-RUBRIC");
    expect(json).not.toContain("SECRET-ANSWER");
  });

  it("keeps rubric and modelAnswer once revealed", () => {
    const out = sanitizeWord(word([question({ status: "revealed", revealedAt: "2026-10-01T02:00:00.000Z" })]));
    expect(out.topics[0].questions[0]).toMatchObject({
      rubric: ["SECRET-RUBRIC"],
      modelAnswer: "SECRET-ANSWER",
      revealedAt: "2026-10-01T02:00:00.000Z",
    });
  });

  it("keeps the public fields", () => {
    const attempt: Attempt = { answer: "a", verdict: "partial", feedback: "f", at: "2026-10-01T01:30:00.000Z" };
    const out = sanitizeWord(word([question({ attempts: [attempt] })]));
    expect(out).toMatchObject({
      dayKey: "2026-10-01",
      term: "MVCC",
      subtitle: "Multi-version concurrency control",
      area: "postgres-databases",
      level: "mid-senior",
      createdAt: "2026-10-01T01:00:00.000Z",
      provider: "fake",
    });
    expect(out.topics[0]).toMatchObject({ id: "t1", title: "Snapshots" });
    expect(out.topics[0].questions[0]).toEqual({
      id: "q1",
      prompt: "What is MVCC?",
      status: "unanswered",
      revealedAt: null,
      attempts: [attempt],
    });
  });

  it("does not leak unknown question fields", () => {
    const leaky = { ...question(), secret: "LEAK" } as Question;
    expect(JSON.stringify(sanitizeWord(word([leaky])))).not.toContain("LEAK");
  });

  it("does not mutate the input", () => {
    const input = word([question({ status: "revealed", revealedAt: "2026-10-01T02:00:00.000Z" })]);
    const before = JSON.parse(JSON.stringify(input));
    const out = sanitizeWord(input);
    out.topics[0].questions[0].attempts.push({ answer: "x", verdict: "fail", feedback: "", at: "" });
    out.topics[0].questions[0].rubric?.push("x");
    expect(input).toEqual(before);
  });
});
