/**
 * @jest-environment node
 */
import { generatedWordSchema, gradeSchema } from "./types";

function makeWord(topicCount: number, questionsPerTopic: number) {
  return {
    term: "MVCC",
    subtitle: "Multi-version concurrency control",
    topics: Array.from({ length: topicCount }, (_, t) => ({
      title: `Topic ${t + 1}`,
      questions: Array.from({ length: questionsPerTopic }, (_, q) => ({
        prompt: `Question ${t + 1}.${q + 1}?`,
        rubric: ["A key point"],
        modelAnswer: "An answer.",
      })),
    })),
  };
}

describe("generatedWordSchema", () => {
  it("accepts 4 topics with 1 question each", () => {
    expect(generatedWordSchema.safeParse(makeWord(4, 1)).success).toBe(true);
  });

  it.each([3, 9])("rejects %i topics", (topics) => {
    expect(generatedWordSchema.safeParse(makeWord(topics, 1)).success).toBe(false);
  });

  it.each([0, 3])("rejects a topic with %i questions", (count) => {
    const word = makeWord(4, 1);
    word.topics[0].questions = makeWord(1, count).topics[0].questions;
    expect(generatedWordSchema.safeParse(word).success).toBe(false);
  });

  it("accepts exactly 12 questions", () => {
    expect(generatedWordSchema.safeParse(makeWord(6, 2)).success).toBe(true);
  });

  it("rejects more than 12 questions in total", () => {
    const result = generatedWordSchema.safeParse(makeWord(7, 2));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("A word has at most 12 questions");
  });

  it.each(["term", "subtitle"])("rejects a blank %s", (field) => {
    expect(generatedWordSchema.safeParse({ ...makeWord(4, 1), [field]: "   " }).success).toBe(false);
  });

  it("rejects a blank topic title, prompt or rubric item", () => {
    const blankTitle = makeWord(4, 1);
    blankTitle.topics[0].title = "";
    const blankPrompt = makeWord(4, 1);
    blankPrompt.topics[0].questions[0].prompt = " ";
    const blankRubricItem = makeWord(4, 1);
    blankRubricItem.topics[0].questions[0].rubric = ["ok", ""];
    for (const word of [blankTitle, blankPrompt, blankRubricItem]) {
      expect(generatedWordSchema.safeParse(word).success).toBe(false);
    }
  });

  it("rejects an empty rubric", () => {
    const word = makeWord(4, 1);
    word.topics[0].questions[0].rubric = [];
    expect(generatedWordSchema.safeParse(word).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(generatedWordSchema.parse({ ...makeWord(4, 1), term: "  MVCC  " }).term).toBe("MVCC");
  });
});

describe("gradeSchema", () => {
  it.each(["pass", "partial", "fail"])("accepts verdict %s", (verdict) => {
    expect(gradeSchema.safeParse({ verdict, feedback: "Good." }).success).toBe(true);
  });

  it("rejects an unknown verdict", () => {
    expect(gradeSchema.safeParse({ verdict: "maybe", feedback: "Good." }).success).toBe(false);
  });

  it("rejects empty feedback", () => {
    expect(gradeSchema.safeParse({ verdict: "pass", feedback: "  " }).success).toBe(false);
  });
});
