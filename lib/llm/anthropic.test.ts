/** @jest-environment node */
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, createAnthropicProvider, testKey } from "./anthropic";
import { ProviderError, type ProviderFailure } from "./errors";
import type { GenerateWordInput, GradeAnswerInput } from "./types";

const MODEL = "m";

function fakeClient(): { client: Anthropic; create: jest.Mock; retrieve: jest.Mock } {
  const create = jest.fn();
  const retrieve = jest.fn();
  const client = { beta: { messages: { create } }, models: { retrieve } } as unknown as Anthropic;
  return { client, create, retrieve };
}

function message(stopReason: string, text: string): unknown {
  return { stop_reason: stopReason, content: [{ type: "text", text }] };
}

const GEN_INPUT: GenerateWordInput = {
  area: "nextjs",
  level: "mid-senior",
  stackProfile: ["React"],
  pastTerms: ["Hydration"],
};
const GRADE_INPUT: GradeAnswerInput = {
  prompt: "Explain X",
  rubric: ["Point A"],
  answer: "Because…",
};

const headers = new Headers();
const apiError = (
  Cls: new (status: never, error: object, message: string, headers: Headers) => Error,
  status: number,
): Error => new Cls(status as never, {}, "boom", headers);

describe("createAnthropicProvider", () => {
  it("generateWord sends the expected request", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValue(message("end_turn", "{}"));
    await createAnthropicProvider({ client, model: MODEL }).generateWord(GEN_INPUT);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe(MODEL);
    expect(params.max_tokens).toBe(16000);
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.fallbacks).toBe("default");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config.effort).toBe("high");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(typeof params.system).toBe("string");
    expect(params.system.length).toBeGreaterThan(0);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe("user");
  });

  it("gradeAnswer uses low effort and 16000 max_tokens", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValue(message("end_turn", "{}"));
    await createAnthropicProvider({ client, model: MODEL }).gradeAnswer(GRADE_INPUT);
    const params = create.mock.calls[0][0];
    expect(params.output_config.effort).toBe("low");
    expect(params.max_tokens).toBe(16000);
  });

  it("returns the parsed object on end_turn with JSON text", async () => {
    const { client, create } = fakeClient();
    const grade = { verdict: "pass", feedback: "Good." };
    create.mockResolvedValue(message("end_turn", JSON.stringify(grade)));
    const result = await createAnthropicProvider({ client, model: MODEL }).gradeAnswer(GRADE_INPUT);
    expect(result).toEqual(grade);
  });

  it("resolves null on max_tokens", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValue(message("max_tokens", '{"verdict"'));
    await expect(
      createAnthropicProvider({ client, model: MODEL }).gradeAnswer(GRADE_INPUT),
    ).resolves.toBeNull();
  });

  it("resolves null on non-JSON text", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValue(message("end_turn", "not json"));
    await expect(
      createAnthropicProvider({ client, model: MODEL }).generateWord(GEN_INPUT),
    ).resolves.toBeNull();
  });

  it("rejects with ProviderError refused on refusal", async () => {
    const { client, create } = fakeClient();
    create.mockResolvedValue(message("refusal", ""));
    const promise = createAnthropicProvider({ client, model: MODEL }).generateWord(GEN_INPUT);
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toMatchObject({ reason: "refused" });
  });

  const cases: [string, () => Error, ProviderFailure][] = [
    ["AuthenticationError", () => apiError(Anthropic.AuthenticationError, 401), "auth"],
    ["PermissionDeniedError", () => apiError(Anthropic.PermissionDeniedError, 403), "auth"],
    ["RateLimitError", () => apiError(Anthropic.RateLimitError, 429), "unavailable"],
    ["InternalServerError", () => apiError(Anthropic.InternalServerError, 529), "unavailable"],
    ["APIConnectionError", () => new Anthropic.APIConnectionError({ message: "down" }), "unavailable"],
    ["APIConnectionTimeoutError", () => new Anthropic.APIConnectionTimeoutError(), "unavailable"],
    ["BadRequestError", () => apiError(Anthropic.BadRequestError, 400), "rejected"],
    ["NotFoundError", () => apiError(Anthropic.NotFoundError, 404), "rejected"],
  ];

  it.each(cases)("maps %s to a ProviderError", async (_name, make, reason) => {
    const { client, create } = fakeClient();
    create.mockRejectedValue(make());
    const promise = createAnthropicProvider({ client, model: MODEL }).generateWord(GEN_INPUT);
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toMatchObject({ reason });
  });

  it("rethrows a plain Error unchanged", async () => {
    const { client, create } = fakeClient();
    const boom = new Error("boom");
    create.mockRejectedValue(boom);
    await expect(
      createAnthropicProvider({ client, model: MODEL }).generateWord(GEN_INPUT),
    ).rejects.toBe(boom);
  });
});

describe("testKey", () => {
  it("resolves when models.retrieve resolves", async () => {
    const { client, retrieve } = fakeClient();
    retrieve.mockResolvedValue({});
    await expect(testKey(client, MODEL)).resolves.toBeUndefined();
    expect(retrieve).toHaveBeenCalledWith(MODEL, {}, { timeout: 15_000, maxRetries: 0 });
  });

  it("maps AuthenticationError to ProviderError auth", async () => {
    const { client, retrieve } = fakeClient();
    retrieve.mockRejectedValue(apiError(Anthropic.AuthenticationError, 401));
    const promise = testKey(client, MODEL);
    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    await expect(promise).rejects.toMatchObject({ reason: "auth" });
  });
});

describe("createAnthropicClient", () => {
  it.each([
    ["a newline", "sk-ant-x\ny"],
    ["an em dash", "sk-ant-x\u2014y"],
  ])("rejects a key with %s as ProviderError auth without leaking it", (_name, key) => {
    let thrown: unknown;
    try {
      createAnthropicClient(key);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ProviderError);
    expect(thrown).toMatchObject({ reason: "auth" });
    expect((thrown as Error).message).not.toContain(key);
    expect((thrown as Error).message).not.toContain("sk-ant");
  });

  it("returns an Anthropic client for a printable key", () => {
    expect(createAnthropicClient("sk-ant-ok")).toBeInstanceOf(Anthropic);
  });
});
