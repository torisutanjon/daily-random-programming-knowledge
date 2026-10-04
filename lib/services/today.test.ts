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
import { createTodayService, GenerationError } from "./today";

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

describe("getToday — retry and typed errors", () => {
  const invalid = { term: "" };

  async function seedMvcc(): Promise<void> {
    const seed = makeService({ results: [validWord("MVCC")], now: new Date(2026, 9, 3, 10, 0) });
    await seed.service.getToday();
  }

  it("retries a repeated term once and accepts a fresh one", async () => {
    await seedMvcc();
    const { service, stub } = makeService({ results: [validWord("  mvcc "), validWord("Fresh")] });
    expect((await service.getToday()).term).toBe("Fresh");
    expect(stub.calls()).toBe(2);
  });

  it("fails with GenerationError repeat after two repeats", async () => {
    await seedMvcc();
    const { service, stub, repo } = makeService({ results: [validWord("  mvcc ")] });
    const error = await service.getToday().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenerationError);
    expect((error as GenerationError).reason).toBe("repeat");
    expect(stub.calls()).toBe(2);
    expect(await repo.getWord("2026-10-04")).toBeNull();
  });

  it("retries invalid output once", async () => {
    const { service, stub } = makeService({ results: [invalid, validWord("Alpha")] });
    await expect(service.getToday()).resolves.toMatchObject({ term: "Alpha" });
    expect(stub.calls()).toBe(2);
  });

  it("fails with GenerationError invalid_output after two invalid results", async () => {
    const { service, stub } = makeService({ results: [invalid] });
    const error = await service.getToday().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenerationError);
    expect((error as GenerationError).reason).toBe("invalid_output");
    expect(stub.calls()).toBe(2);
  });

  it("propagates provider errors without retrying", async () => {
    const failure = new Error("network");
    const { service, stub } = makeService({ results: [failure] });
    await expect(service.getToday()).rejects.toBe(failure);
    expect(stub.calls()).toBe(1);
  });

  it("clears the in-flight entry after a failure", async () => {
    const { service } = makeService({ results: [invalid, invalid, validWord("Later")] });
    await expect(service.getToday()).rejects.toBeInstanceOf(GenerationError);
    await expect(service.getToday()).resolves.toMatchObject({ term: "Later" });
  });

  it("reports the last failure when the failures differ", async () => {
    await seedMvcc();
    const { service, stub } = makeService({ results: [invalid, validWord("  mvcc ")] });
    const error = await service.getToday().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GenerationError);
    expect((error as GenerationError).reason).toBe("repeat");
    expect(stub.calls()).toBe(2);
  });
});

describe("getToday — generations are serialized", () => {
  it("makes a later day see the term saved by an earlier in-flight generation", async () => {
    let clock = new Date(2026, 9, 3, 10, 0);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const later = [validWord("MVCC"), validWord("Fresh")];
    let count = 0;
    const llm: LlmProvider = {
      async generateWord() {
        count += 1;
        if (count === 1) {
          await gate;
          return validWord("MVCC");
        }
        return later[count - 2];
      },
      async gradeAnswer() {
        throw new Error("unused");
      },
    };
    const service = createTodayService({
      repo: createRepo(dir),
      getProvider: () => ({ llm, name: "fake" }),
      now: () => clock,
      rng: () => 0,
    });

    const first = service.getToday();
    await new Promise((resolve) => setTimeout(resolve, 20));
    clock = new Date(2026, 9, 4, 10, 0);
    const second = service.getToday();
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(a.term).toBe("MVCC");
    expect(a.dayKey).toBe("2026-10-03");
    expect(b.term).toBe("Fresh");
    expect(b.dayKey).toBe("2026-10-04");
  });
});
