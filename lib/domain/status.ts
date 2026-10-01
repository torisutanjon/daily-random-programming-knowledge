import type { QuestionStatus, Verdict } from "./types";

export type TopicStatus = "unanswered" | "in-progress" | "learned" | "revealed";

export interface WordProgress {
  learned: number;
  revealed: number;
  total: number;
  done: boolean;
}

/** A question's status after a graded attempt. Revealed is terminal; learned is never lost by practising again. */
export function applyVerdict(status: QuestionStatus, verdict: Verdict): QuestionStatus {
  if (status === "revealed" || status === "learned") return status;
  if (verdict === "pass") return "learned";
  if (verdict === "partial") return "partial";
  return status;
}

function isDone(status: QuestionStatus): boolean {
  return status === "learned" || status === "revealed";
}

export function topicStatus(questions: readonly { status: QuestionStatus }[]): TopicStatus {
  const statuses = questions.map((question) => question.status);
  if (statuses.every((status) => status === "learned")) return "learned";
  if (statuses.every(isDone)) return "revealed";
  if (statuses.some((status) => status !== "unanswered")) return "in-progress";
  return "unanswered";
}

export function wordProgress(word: {
  topics: readonly { questions: readonly { status: QuestionStatus }[] }[];
}): WordProgress {
  const statuses = word.topics.flatMap((topic) => topic.questions.map((question) => question.status));
  const learned = statuses.filter((status) => status === "learned").length;
  const revealed = statuses.filter((status) => status === "revealed").length;
  return { learned, revealed, total: statuses.length, done: learned + revealed === statuses.length };
}
