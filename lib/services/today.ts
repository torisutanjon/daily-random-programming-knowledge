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
    const raw = await llm.generateWord({
      area,
      level: settings.level,
      stackProfile: settings.stackProfile,
      pastTerms: words.map((w) => w.term),
    });
    const parsed = generatedWordSchema.parse(raw);
    const word = toWord(dayKey, parsed, {
      area,
      level: settings.level,
      createdAt: now().toISOString(),
      provider: name,
    });
    await repo.saveWord(word);
    return word;
  }

  return {
    async getToday() {
      const settings = await repo.getSettings();
      const dayKey = currentDayKey(now(), settings.notifyTime);
      const pending = inFlight.get(dayKey);
      if (pending) return pending;
      const promise = generate(dayKey, settings).finally(() => inFlight.delete(dayKey));
      inFlight.set(dayKey, promise);
      return promise;
    },
  };
}
