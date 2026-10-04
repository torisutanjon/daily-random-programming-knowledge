/** @jest-environment node */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Word } from "@/lib/domain/types";
import { createRepo } from "@/lib/store/repo";
import { makeWord } from "@/lib/test-utils/word";

const DAY = "2026-10-01";

let dir: string;
let word: Word;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-reveal-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
  word = makeWord(DAY);
  await createRepo(dir).saveWord(word);
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function post(body: unknown | string): Promise<Response> {
  const { POST } = await import("@/app/api/reveal/route");
  return POST(
    new Request("http://localhost/api/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/reveal", () => {
  it("reveals the question with its rubric and model answer", async () => {
    const q = word.topics[0].questions[0];
    const response = await post({ dayKey: DAY, questionId: q.id });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("revealed");
    expect(body.modelAnswer).toBe(q.modelAnswer);
    expect(body.rubric).toEqual(q.rubric);
    const stored = (await createRepo(dir).getWord(DAY))!.topics[0].questions[0];
    expect(stored.revealedAt).not.toBeNull();
  });

  it.each([
    ["bad JSON", () => "{not json"],
    ["bad dayKey", (id: string) => ({ dayKey: "../etc", questionId: id })],
  ])("returns 400 invalid_request for %s", async (_name, build) => {
    const response = await post(build(word.topics[0].questions[0].id));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("returns 404 not_found for an unknown word", async () => {
    const response = await post({ dayKey: "2026-09-30", questionId: word.topics[0].questions[0].id });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
