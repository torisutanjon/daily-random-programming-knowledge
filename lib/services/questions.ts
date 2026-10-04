import type { Settings } from "../domain/settings";
import { sanitizeQuestion, type PublicQuestion } from "../domain/sanitize";
import { applyVerdict } from "../domain/status";
import type { Question, Word } from "../domain/types";
import { gradeSchema, type LlmProvider } from "../llm/types";
import type { Repo } from "../store/repo";

export class NotFoundError extends Error {
  constructor(message: "Word not found" | "Question not found") {
    super(message);
    this.name = "NotFoundError";
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
  return {
    async answer({ dayKey, questionId, answer }) {
      const question = findQuestion(await loadWord(repo, dayKey), questionId);
      const { llm } = getProvider(await repo.getSettings());
      const grade = gradeSchema.parse(await llm.gradeAnswer({ prompt: question.prompt, rubric: question.rubric, answer }));
      const word = await loadWord(repo, dayKey);
      const current = findQuestion(word, questionId);
      current.attempts.push({ answer, verdict: grade.verdict, feedback: grade.feedback, at: now().toISOString() });
      current.status = applyVerdict(current.status, grade.verdict);
      await repo.saveWord(word);
      return sanitizeQuestion(current);
    },
    async reveal() {
      throw new Error("Not implemented");
    },
  };
}
