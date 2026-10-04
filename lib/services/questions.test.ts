/**
 * @jest-environment node
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { QuestionStatus, Word } from "../domain/types";
import type { GradeAnswerInput, LlmProvider } from "../llm/types";
import { createRepo, type Repo } from "../store/repo";
import { makeWord } from "../test-utils/word";
import { createQuestionService, GradingError, NotFoundError, type QuestionService } from "./questions";

const NOW = new Date("2026-10-04T14:00:00.000Z");
const DAY = "2026-10-01";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-questions-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function stubGrader(results: Array<unknown | Error>): { llm: LlmProvider; calls(): number; inputs: GradeAnswerInput[] } {
  const inputs: GradeAnswerInput[] = [];
  let index = 0;
  const llm: LlmProvider = {
    async generateWord() {
      throw new Error("unused");
    },
    async gradeAnswer(input) {
      inputs.push(input);
      const next = results[index++];
      if (next instanceof Error) throw next;
      return next as Awaited<ReturnType<LlmProvider["gradeAnswer"]>>;
    },
  };
  return { llm, calls: () => inputs.length, inputs };
}

async function setup(
  results: Array<unknown | Error>,
  status?: QuestionStatus,
): Promise<{ repo: Repo; service: QuestionService; stub: ReturnType<typeof stubGrader>; word: Word }> {
  const repo = createRepo(dir);
  const word = makeWord(DAY);
  if (status) word.topics[0].questions[0].status = status;
  await repo.saveWord(word);
  const stub = stubGrader(results);
  const service = createQuestionService({ repo, getProvider: () => ({ llm: stub.llm, name: "fake" }), now: () => NOW });
  return { repo, service, stub, word };
}

const pass = { verdict: "pass", feedback: "Good." };
const partial = { verdict: "partial", feedback: "Close." };
const fail = { verdict: "fail", feedback: "Not quite." };

describe("answer", () => {
  it("records a pass on an unanswered question and marks it learned", async () => {
    const { repo, service, stub, word } = await setup([pass]);
    const q = word.topics[0].questions[0];
    const result = await service.answer({ dayKey: DAY, questionId: q.id, answer: "my answer" });
    const attempts = [{ answer: "my answer", verdict: "pass", feedback: "Good.", at: NOW.toISOString() }];
    expect(result.status).toBe("learned");
    expect(result.attempts).toEqual(attempts);
    expect(result).not.toHaveProperty("rubric");
    expect(result).not.toHaveProperty("modelAnswer");
    const stored = (await repo.getWord(DAY))!.topics[0].questions[0];
    expect(stored.status).toBe("learned");
    expect(stored.attempts).toEqual(attempts);
    expect(stub.inputs[0]).toEqual({ prompt: q.prompt, rubric: q.rubric, answer: "my answer" });
  });

  it("marks a partial on an unanswered question as partial", async () => {
    const { service, word } = await setup([partial]);
    const result = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    expect(result.status).toBe("partial");
  });

  it("keeps an unanswered question unanswered on fail, with one attempt", async () => {
    const { service, word } = await setup([fail]);
    const result = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    expect(result.status).toBe("unanswered");
    expect(result.attempts).toHaveLength(1);
  });

  it("keeps a learned question learned on fail", async () => {
    const { service, word } = await setup([fail], "learned");
    const result = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    expect(result.status).toBe("learned");
  });

  it("keeps a revealed question revealed and appends the attempt", async () => {
    const { service, word } = await setup([pass], "revealed");
    const result = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    expect(result.status).toBe("revealed");
    expect(result.attempts).toHaveLength(1);
  });

  it("leaves the other question untouched", async () => {
    const { repo, service, word } = await setup([pass]);
    await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    const stored = await repo.getWord(DAY);
    expect(stored!.topics[1].questions[0]).toEqual(word.topics[1].questions[0]);
  });

  it("rejects an unknown day or question with NotFoundError and never calls the grader", async () => {
    const { service, stub, word } = await setup([pass]);
    await expect(service.answer({ dayKey: "2026-09-30", questionId: word.topics[0].questions[0].id, answer: "a" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.answer({ dayKey: DAY, questionId: "nope", answer: "a" })).rejects.toBeInstanceOf(NotFoundError);
    expect(stub.calls()).toBe(0);
  });
});

describe("answer — failures and concurrency", () => {
  const file = (): string => path.join(dir, "words", `${DAY}.json`);

  it("wraps a provider error in GradingError and writes nothing", async () => {
    const cause = new Error("network");
    const { service, word } = await setup([cause]);
    const before = await readFile(file(), "utf8");
    const error = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GradingError);
    expect((error as GradingError).reason).toBe("provider");
    expect((error as GradingError).cause).toBe(cause);
    expect(await readFile(file(), "utf8")).toBe(before);
  });

  it("rejects an invalid grade with GradingError and writes nothing", async () => {
    const { service, word } = await setup([{ verdict: "maybe", feedback: "" }]);
    const before = await readFile(file(), "utf8");
    const error = await service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GradingError);
    expect((error as GradingError).reason).toBe("invalid_output");
    expect(await readFile(file(), "utf8")).toBe(before);
  });

  it("keeps both attempts when two answers to one word run concurrently", async () => {
    const realRepo = createRepo(dir);
    const word = makeWord(DAY);
    await realRepo.saveWord(word);
    const repo: Repo = {
      ...realRepo,
      getWord: async (dayKey) => {
        const found = await realRepo.getWord(dayKey);
        await new Promise((resolve) => setImmediate(resolve));
        return found;
      },
    };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const llm: LlmProvider = {
      async generateWord() {
        throw new Error("unused");
      },
      async gradeAnswer() {
        calls++;
        await gate;
        return { verdict: "pass", feedback: "Good." };
      },
    };
    const service = createQuestionService({ repo, getProvider: () => ({ llm, name: "fake" }), now: () => NOW });
    const first = service.answer({ dayKey: DAY, questionId: word.topics[0].questions[0].id, answer: "a" });
    const second = service.answer({ dayKey: DAY, questionId: word.topics[1].questions[0].id, answer: "b" });
    while (calls < 2) await new Promise((resolve) => setImmediate(resolve));
    release();
    await Promise.all([first, second]);
    const stored = (await realRepo.getWord(DAY))!;
    expect(stored.topics[0].questions[0].attempts).toHaveLength(1);
    expect(stored.topics[1].questions[0].attempts).toHaveLength(1);
  });
});
