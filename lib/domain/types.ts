import type { AreaId } from "./areas";

export type Level = "mid" | "mid-senior" | "senior";
export type QuestionStatus = "unanswered" | "partial" | "learned" | "revealed";
export type Verdict = "pass" | "partial" | "fail";

export interface Attempt {
  answer: string;
  verdict: Verdict;
  feedback: string;
  at: string; // ISO
}

export interface Question {
  id: string;
  prompt: string;
  rubric: string[]; // hidden: key points a passing answer must cover
  modelAnswer: string; // hidden until revealed
  status: QuestionStatus;
  revealedAt: string | null; // ISO; set when revealed
  attempts: Attempt[];
}

export interface Topic {
  id: string;
  title: string;
  questions: Question[]; // 1–2
}

export interface Word {
  dayKey: string; // "YYYY-MM-DD"
  term: string;
  subtitle: string;
  area: AreaId;
  level: Level;
  topics: Topic[]; // 4–8
  createdAt: string; // ISO
  provider: "anthropic" | "fake";
}
