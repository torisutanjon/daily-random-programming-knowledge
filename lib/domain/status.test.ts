/**
 * @jest-environment node
 */
import { applyVerdict, topicStatus, type TopicStatus, wordProgress } from "./status";
import type { QuestionStatus, Verdict } from "./types";

function questions(...statuses: QuestionStatus[]): { status: QuestionStatus }[] {
  return statuses.map((status) => ({ status }));
}

describe("applyVerdict", () => {
  it.each<[QuestionStatus, Verdict, QuestionStatus]>([
    ["unanswered", "pass", "learned"],
    ["unanswered", "partial", "partial"],
    ["unanswered", "fail", "unanswered"],
    ["partial", "pass", "learned"],
    ["partial", "partial", "partial"],
    ["partial", "fail", "partial"],
    ["learned", "pass", "learned"],
    ["learned", "partial", "learned"],
    ["learned", "fail", "learned"],
    ["revealed", "pass", "revealed"],
    ["revealed", "partial", "revealed"],
    ["revealed", "fail", "revealed"],
  ])("%s + %s → %s", (status, verdict, expected) => {
    expect(applyVerdict(status, verdict)).toBe(expected);
  });
});

describe("topicStatus", () => {
  it.each<[QuestionStatus[], TopicStatus]>([
    [["learned", "learned"], "learned"],
    [["learned", "revealed"], "revealed"],
    [["revealed"], "revealed"],
    [["learned", "unanswered"], "in-progress"],
    [["partial"], "in-progress"],
    [["unanswered", "unanswered"], "unanswered"],
  ])("%p → %s", (statuses, expected) => {
    expect(topicStatus(questions(...statuses))).toBe(expected);
  });
});

describe("wordProgress", () => {
  it("counts learned and revealed questions", () => {
    const word = {
      topics: [
        { questions: questions("learned", "revealed") },
        { questions: questions("partial", "unanswered", "learned") },
      ],
    };
    expect(wordProgress(word)).toEqual({ learned: 2, revealed: 1, total: 5, done: false });
  });

  it("is done when every question is learned or revealed", () => {
    expect(wordProgress({ topics: [{ questions: questions("learned", "revealed") }] }).done).toBe(true);
  });
});
