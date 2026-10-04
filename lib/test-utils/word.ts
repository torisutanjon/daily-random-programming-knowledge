import { randomUUID } from "node:crypto";
import type { Question, Topic, Word } from "../domain/types";

function makeTopic(n: number): Topic {
  const question: Question = {
    id: randomUUID(),
    prompt: `Explain ${n}`,
    rubric: [`Point ${n}`],
    modelAnswer: `Answer ${n}`,
    status: "unanswered",
    revealedAt: null,
    attempts: [],
  };
  return { id: randomUUID(), title: `Topic ${n}`, questions: [question] };
}

/** A stored word with 2 topics × 1 question, all unanswered. */
export function makeWord(dayKey: string): Word {
  return {
    dayKey,
    term: "Fixture",
    subtitle: "Test word",
    area: "postgres-databases",
    level: "mid-senior",
    topics: [makeTopic(1), makeTopic(2)],
    createdAt: "2026-10-01T13:00:00.000Z",
    provider: "fake",
  };
}
