/**
 * @jest-environment node
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pickArea } from "../domain/coverage";
import { defaultSettings } from "../domain/settings";
import { FAKE_WORDS } from "../llm/fake-words";
import type { GeneratedWord, LlmProvider } from "../llm/types";
import { createRepo } from "../store/repo";
import { createTodayService } from "./today";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-today-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validWord(term: string): GeneratedWord {
  const copy: GeneratedWord = JSON.parse(JSON.stringify(FAKE_WORDS[0].word));
  copy.term = term;
  return copy;
}

function stubProvider(results: Array<unknown | Error>): { llm: LlmProvider; calls: () => number } {
  let count = 0;
  const llm: LlmProvider = {
    async generateWord() {
      const result = results[Math.min(count, results.length - 1)];
      count += 1;
      if (result instanceof Error) throw result;
      return result as GeneratedWord;
    },
    async gradeAnswer() {
      throw new Error("unused");
    },
  };
  return { llm, calls: () => count };
}

function makeService(opts: { results: Array<unknown | Error>; now?: Date }) {
  const now = opts.now ?? new Date(2026, 9, 4, 10, 0);
  const repo = createRepo(dir);
  const stub = stubProvider(opts.results);
  const service = createTodayService({
    repo,
    getProvider: () => ({ llm: stub.llm, name: "fake" }),
    now: () => now,
    rng: () => 0,
  });
  return { repo, stub, service, now };
}

describe("getToday — one word per day", () => {
  it("generates and saves a word on an empty store", async () => {
    const { repo, service } = makeService({ results: [validWord("Alpha")] });
    const word = await service.getToday();
    expect(word.dayKey).toBe("2026-10-04");
    expect(await repo.getWord("2026-10-04")).toEqual(word);
  });

  it("files the word under the previous day before notifyTime", async () => {
    const { service } = makeService({ results: [validWord("Alpha")], now: new Date(2026, 9, 4, 7, 0) });
    expect((await service.getToday()).dayKey).toBe("2026-10-03");
  });

  it("is idempotent across sequential calls", async () => {
    const { service, stub } = makeService({ results: [validWord("Alpha"), validWord("Beta")] });
    const first = await service.getToday();
    const second = await service.getToday();
    expect(second).toEqual(first);
    expect(stub.calls()).toBe(1);
  });

  it("generates once under concurrent calls", async () => {
    const { service, stub } = makeService({ results: [validWord("Alpha"), validWord("Beta")] });
    const words = await Promise.all(Array.from({ length: 10 }, () => service.getToday()));
    expect(stub.calls()).toBe(1);
    const ids = words[0].topics.map((t) => t.id);
    for (const word of words) expect(word.topics.map((t) => t.id)).toEqual(ids);
  });

  it("saves a well-formed word", async () => {
    const { service, now } = makeService({ results: [validWord("Alpha")] });
    const word = await service.getToday();
    const ids = word.topics.flatMap((t) => [t.id, ...t.questions.map((q) => q.id)]);
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
    for (const question of word.topics.flatMap((t) => t.questions)) {
      expect(question.status).toBe("unanswered");
      expect(question.revealedAt).toBeNull();
      expect(question.attempts).toEqual([]);
    }
    expect(word.provider).toBe("fake");
    expect(word.area).toBe(pickArea([], defaultSettings().areas, () => 0));
    expect(word.level).toBe("mid-senior");
    expect(word.createdAt).toBe(now.toISOString());
  });
});
