/** @jest-environment node */
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AREA_IDS } from "@/lib/domain/areas";
import { makeWord } from "@/lib/test-utils/word";
import { createRepo } from "@/lib/store/repo";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("GET /api/history", () => {
  it("returns empty words and coverage for an empty directory", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.words).toEqual([]);
    expect(body.coverage.length).toBe(16);
    expect(body.coverage.every((c: any) => c.count === 0)).toBe(true);
    expect(body.coverage.map((c: any) => c.area)).toEqual(AREA_IDS);
  });

  it("returns words in reverse date order and sanitized with coverage counts", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(makeWord("2026-10-01"));
    await repo.saveWord(makeWord("2026-10-02"));

    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json() as any;

    expect(body.words.map((w: any) => w.dayKey)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(body.words.every((w: any) => !w.topics.some((t: any) => t.questions.some((q: any) => q.rubric || q.modelAnswer)))).toBe(true);

    const postgresEntry = body.coverage.find((c: any) => c.area === "postgres-databases");
    expect(postgresEntry.count).toBe(2);
  });

  it("returns words and skips corrupt word files", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(makeWord("2026-10-01"));

    // Create corrupt file
    await mkdir(path.join(dir, "words"), { recursive: true });
    await writeFile(path.join(dir, "words", "2026-10-03.json"), "{not json");

    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.words.length).toBe(1);
    expect(body.words[0].dayKey).toBe("2026-10-01");
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
