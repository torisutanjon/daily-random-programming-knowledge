import { randomUUID } from "node:crypto";
import { pickArea } from "../domain/coverage";
import { currentDayKey } from "../domain/day";
import type { Settings } from "../domain/settings";
import type { Question, Topic, Word } from "../domain/types";
import { generatedWordSchema, type GeneratedWord, type LlmProvider } from "../llm/types";
import type { Repo } from "../store/repo";

export interface TodayDeps {
  repo: Repo;
  getProvider(settings: Settings): { llm: LlmProvider; name: Word["provider"] };
  now(): Date;
  rng(): number;
}

export interface TodayService {
  getToday(): Promise<Word>;
}

export type GenerationFailure = "invalid_output" | "repeat";

export class GenerationError extends Error {
  readonly reason: GenerationFailure;

  constructor(reason: GenerationFailure) {
    super(reason === "repeat" ? "The model repeated a past word twice" : "The model returned an invalid word twice");
    this.name = "GenerationError";
    this.reason = reason;
  }
}

const MAX_ATTEMPTS = 2;

function normalize(term: string): string {
  return term.trim().toLowerCase();
}

function toWord(
  dayKey: string,
  generated: GeneratedWord,
  meta: Pick<Word, "area" | "level" | "createdAt" | "provider">,
): Word {
  const topics: Topic[] = generated.topics.map((topic) => ({
    id: randomUUID(),
    title: topic.title,
    questions: topic.questions.map(
      (question): Question => ({
        id: randomUUID(),
        prompt: question.prompt,
        rubric: question.rubric,
        modelAnswer: question.modelAnswer,
        status: "unanswered",
        revealedAt: null,
        attempts: [],
      }),
    ),
  }));
  return { dayKey, term: generated.term, subtitle: generated.subtitle, ...meta, topics };
}

export function createTodayService(deps: TodayDeps): TodayService {
  const { repo, getProvider, now, rng } = deps;
  // In-flight generations, keyed by dayKey: concurrent callers share one promise.
  const inFlight = new Map<string, Promise<Word>>();
  // Generations run one at a time, so each sees the terms saved by the one before it.
  let queue: Promise<unknown> = Promise.resolve();

  async function generate(dayKey: string, settings: Settings): Promise<Word> {
    const existing = await repo.getWord(dayKey);
    if (existing) return existing;

    const words = await repo.listWords();
    const area = pickArea(
      words.map((w) => w.area),
      settings.areas,
      rng,
    );
    const { llm, name } = getProvider(settings);
    const pastTerms = new Set(words.map((w) => normalize(w.term)));
    let failure: GenerationFailure = "invalid_output";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await llm.generateWord({
        area,
        level: settings.level,
        stackProfile: settings.stackProfile,
        pastTerms: words.map((w) => w.term),
      });
      const result = generatedWordSchema.safeParse(raw);
      if (!result.success) {
        failure = "invalid_output";
        continue;
      }
      if (pastTerms.has(normalize(result.data.term))) {
        failure = "repeat";
        continue;
      }
      const word = toWord(dayKey, result.data, {
        area,
        level: settings.level,
        createdAt: now().toISOString(),
        provider: name,
      });
      await repo.saveWord(word);
      return word;
    }
    throw new GenerationError(failure);
  }

  return {
    async getToday() {
      const settings = await repo.getSettings();
      const dayKey = currentDayKey(now(), settings.notifyTime);
      const pending = inFlight.get(dayKey);
      if (pending) return pending;
      const promise = queue.then(() => generate(dayKey, settings)).finally(() => inFlight.delete(dayKey));
      queue = promise.catch(() => undefined); // a failure must not block later generations
      inFlight.set(dayKey, promise);
      return promise;
    },
  };
}
