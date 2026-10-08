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
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-answer-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
  word = makeWord(DAY);
  await createRepo(dir).saveWord(word);
});

afterEach(async () => {
  jest.dontMock("@/lib/llm/provider");
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function post(body: unknown | string): Promise<Response> {
  const { POST } = await import("@/app/api/answer/route");
  return POST(
    new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/answer", () => {
  it("grades, records and returns the question without hidden fields", async () => {
    const q = word.topics[0].questions[0];
    const answer = "x".repeat(250);
    const response = await post({ dayKey: DAY, questionId: q.id, answer });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("learned");
    expect(body).not.toHaveProperty("rubric");
    expect(body).not.toHaveProperty("modelAnswer");
    const stored = (await createRepo(dir).getWord(DAY))!.topics[0].questions[0];
    expect(stored.attempts).toHaveLength(1);
    expect(stored.attempts[0].answer).toBe(answer);
  });

  it("stores the trimmed answer", async () => {
    const q = word.topics[0].questions[0];
    const response = await post({ dayKey: DAY, questionId: q.id, answer: "  hi  " });
    expect(response.status).toBe(200);
    const stored = (await createRepo(dir).getWord(DAY))!.topics[0].questions[0];
    expect(stored.attempts[0].answer).toBe("hi");
  });

  it.each([
    ["bad JSON", () => "{not json"],
    ["whitespace answer", (id: string) => ({ dayKey: DAY, questionId: id, answer: "   " })],
    ["5001-char answer", (id: string) => ({ dayKey: DAY, questionId: id, answer: "x".repeat(5001) })],
    ["bad dayKey", (id: string) => ({ dayKey: "../etc", questionId: id, answer: "hi" })],
    ["missing questionId", () => ({ dayKey: DAY, answer: "hi" })],
  ])("returns 400 invalid_request for %s", async (_name, build) => {
    const response = await post(build(word.topics[0].questions[0].id));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("returns 404 not_found for an unknown question", async () => {
    const response = await post({ dayKey: DAY, questionId: "nope", answer: "hi" });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("returns 404 not_found for an unknown word", async () => {
    const response = await post({ dayKey: "2026-09-30", questionId: word.topics[0].questions[0].id, answer: "hi" });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("returns 502 provider_unavailable when provider.gradeAnswer throws ProviderError(unavailable)", async () => {
    jest.resetModules();
    const { ProviderError } = await import("@/lib/llm/errors");
    jest.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({
        name: "anthropic",
        llm: {
          generateWord: jest.fn(),
          gradeAnswer: () => Promise.reject(new ProviderError("unavailable")),
        },
      }),
    }));
    const q = word.topics[0].questions[0];
    const response = await post({ dayKey: DAY, questionId: q.id, answer: "hi" });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "provider_unavailable" } });
  });

  it("returns 502 invalid_key when getProvider itself throws ProviderError(auth)", async () => {
    jest.resetModules();
    const { ProviderError } = await import("@/lib/llm/errors");
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.doMock("@/lib/llm/provider", () => ({
      getProvider: () => {
        throw new ProviderError("auth");
      },
    }));
    const q = word.topics[0].questions[0];
    const response = await post({ dayKey: DAY, questionId: q.id, answer: "hi" });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_key" } });
    jest.restoreAllMocks();
  });
});
