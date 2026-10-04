/** @jest-environment node */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AREA_IDS } from "@/lib/domain/areas";
import type { AreaCount } from "@/lib/domain/coverage";
import type { PublicWord } from "@/lib/domain/sanitize";
import { makeWord } from "@/lib/test-utils/word";
import { createRepo } from "@/lib/store/repo";

type HistoryBody = { words: PublicWord[]; coverage: AreaCount[] };

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-history-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function get(): Promise<Response> {
  const { GET } = await import("@/app/api/history/route");
  return GET();
}

describe("GET /api/history", () => {
  it("returns empty words and coverage for an empty directory", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body: HistoryBody = await response.json();
    expect(body.words).toEqual([]);
    expect(body.coverage.length).toBe(16);
    expect(body.coverage.every((c) => c.count === 0)).toBe(true);
    expect(body.coverage.map((c) => c.area)).toEqual(AREA_IDS);
  });

  it("returns words in reverse date order and sanitized with coverage counts", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(makeWord("2026-10-01"));
    await repo.saveWord(makeWord("2026-10-02"));

    const response = await get();
    expect(response.status).toBe(200);
    const body: HistoryBody = await response.json();

    expect(body.words.map((w) => w.dayKey)).toEqual(["2026-10-02", "2026-10-01"]);

    const questions = body.words.flatMap((w) => w.topics.flatMap((t) => t.questions));
    expect(questions.length).toBe(4);
    for (const q of questions) {
      expect(q).not.toHaveProperty("rubric");
      expect(q).not.toHaveProperty("modelAnswer");
    }

    expect(body.coverage.find((c) => c.area === "postgres-databases")?.count).toBe(2);
  });

  it("returns words and skips corrupt word files", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(makeWord("2026-10-01"));

    await writeFile(path.join(dir, "words", "2026-10-03.json"), "{not json");

    const response = await get();
    expect(response.status).toBe(200);
    const body: HistoryBody = await response.json();
    expect(body.words.length).toBe(1);
    expect(body.words[0].dayKey).toBe("2026-10-01");
  });
});
