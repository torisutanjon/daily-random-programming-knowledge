import type { Settings } from "../domain/settings";
import { sanitizeQuestion, type PublicQuestion } from "../domain/sanitize";
import { applyVerdict } from "../domain/status";
import type { Question, Word } from "../domain/types";
import { gradeSchema, type LlmProvider } from "../llm/types";
import { getProvider } from "../llm/provider";
import { createRepo, getDataDir, type Repo } from "../store/repo";

export class NotFoundError extends Error {
  constructor(message: "Word not found" | "Question not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type GradingFailure = "provider" | "invalid_output";

export class GradingError extends Error {
  readonly reason: GradingFailure;

  constructor(reason: GradingFailure, options?: { cause?: unknown }) {
    super(reason === "provider" ? "Grading failed" : "The grader returned an invalid result", options);
    this.name = "GradingError";
    this.reason = reason;
  }
}

export interface QuestionDeps {
  repo: Repo;
  getProvider(settings: Settings): { llm: LlmProvider; name: Word["provider"] };
  now(): Date;
}
export interface AnswerInput {
  dayKey: string;
  questionId: string;
  answer: string;
}
export interface RevealInput {
  dayKey: string;
  questionId: string;
}
export interface QuestionService {
  answer(input: AnswerInput): Promise<PublicQuestion>;
  reveal(input: RevealInput): Promise<PublicQuestion>;
}

function findQuestion(word: Word, questionId: string): Question {
  for (const topic of word.topics) {
    const question = topic.questions.find((candidate) => candidate.id === questionId);
    if (question) return question;
  }
  throw new NotFoundError("Question not found");
}

async function loadWord(repo: Repo, dayKey: string): Promise<Word> {
  const word = await repo.getWord(dayKey);
  if (!word) throw new NotFoundError("Word not found");
  return word;
}

export function createQuestionService(deps: QuestionDeps): QuestionService {
  const { repo, getProvider, now } = deps;
  // Writes to one word run one at a time, so concurrent answers never overwrite each other.
  const locks = new Map<string, Promise<unknown>>();
  function withWordLock<T>(dayKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(dayKey) ?? Promise.resolve();
    const run = previous.then(fn);
    const tail = run.catch(() => undefined); // a failure never blocks the next writer
    locks.set(dayKey, tail);
    void tail.then(() => {
      if (locks.get(dayKey) === tail) locks.delete(dayKey);
    });
    return run;
  }
  return {
    async answer({ dayKey, questionId, answer }) {
      const question = findQuestion(await loadWord(repo, dayKey), questionId);
      const { llm } = getProvider(await repo.getSettings());
      let raw: unknown;
      try {
        raw = await llm.gradeAnswer({ prompt: question.prompt, rubric: question.rubric, answer });
      } catch (cause) {
        throw new GradingError("provider", { cause });
      }
      const parsed = gradeSchema.safeParse(raw);
      if (!parsed.success) throw new GradingError("invalid_output");
      const grade = parsed.data;
      return withWordLock(dayKey, async () => {
        const word = await loadWord(repo, dayKey);
        const current = findQuestion(word, questionId);
        current.attempts.push({ answer, verdict: grade.verdict, feedback: grade.feedback, at: now().toISOString() });
        current.status = applyVerdict(current.status, grade.verdict);
        await repo.saveWord(word);
        return sanitizeQuestion(current);
      });
    },
    reveal({ dayKey, questionId }) {
      return withWordLock(dayKey, async () => {
        const word = await loadWord(repo, dayKey);
        const question = findQuestion(word, questionId);
        if (question.status !== "revealed") {
          question.status = "revealed";
          question.revealedAt = now().toISOString();
          await repo.saveWord(word);
        }
        return sanitizeQuestion(question);
      });
    },
  };
}

let instance: QuestionService | undefined;

/** One service per server process, shared by /api/answer and /api/reveal so they share one write lock. */
export function questionService(): QuestionService {
  instance ??= createQuestionService({ repo: createRepo(getDataDir()), getProvider, now: () => new Date() });
  return instance;
}
