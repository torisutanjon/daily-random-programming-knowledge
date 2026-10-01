import type { Attempt, Question, QuestionStatus, Topic, Word } from "./types";

export interface PublicQuestion {
  id: string;
  prompt: string;
  status: QuestionStatus;
  revealedAt: string | null;
  attempts: Attempt[];
  rubric?: string[]; // only once revealed
  modelAnswer?: string; // only once revealed
}

export interface PublicTopic {
  id: string;
  title: string;
  questions: PublicQuestion[];
}

export type PublicWord = Omit<Word, "topics"> & { topics: PublicTopic[] };

/** Built from an allowlist, so any field added to Question later stays server-side by default. */
export function sanitizeQuestion(question: Question): PublicQuestion {
  const { id, prompt, status, revealedAt, attempts } = question;
  const safe: PublicQuestion = { id, prompt, status, revealedAt, attempts: attempts.map((attempt) => ({ ...attempt })) };
  if (status !== "revealed") return safe;
  return { ...safe, rubric: [...question.rubric], modelAnswer: question.modelAnswer };
}

function sanitizeTopic(topic: Topic): PublicTopic {
  return { id: topic.id, title: topic.title, questions: topic.questions.map(sanitizeQuestion) };
}

export function sanitizeWord(word: Word): PublicWord {
  return { ...word, topics: word.topics.map(sanitizeTopic) };
}
