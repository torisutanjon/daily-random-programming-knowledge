import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ProviderError } from "./errors";
import { generationPrompt, gradingPrompt, type Prompt } from "./prompts";
import {
  generatedWordSchema,
  gradeSchema,
  type GeneratedWord,
  type Grade,
  type LlmProvider,
} from "./types";

const MAX_TOKENS = 16000;

// An API key is printable ASCII; anything else (a pasted newline, an em dash) would make the SDK
// throw a TypeError that quotes the key. Reject it as a bad key instead.
const API_KEY_PATTERN = /^[\x21-\x7E]+$/;

export function createAnthropicClient(apiKey: string): Anthropic {
  if (!API_KEY_PATTERN.test(apiKey)) throw new ProviderError("auth");
  return new Anthropic({ apiKey });
}

/** SDK error → ProviderError; anything else is returned unchanged. */
export function toProviderError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError("auth", { cause: error });
  }
  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    return new ProviderError("unavailable", { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError("rejected", { cause: error });
  }
  return error;
}

async function request(
  client: Anthropic,
  model: string,
  effort: "high" | "low",
  schema: z.ZodType,
  prompt: Prompt,
): Promise<unknown> {
  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
  } catch (error) {
    throw toProviderError(error);
  }
  if (response.stop_reason === "refusal") throw new ProviderError("refused");
  if (response.stop_reason === "max_tokens") return null;
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createAnthropicProvider({ client, model }: { client: Anthropic; model: string }): LlmProvider {
  return {
    generateWord: async (input) =>
      (await request(client, model, "high", generatedWordSchema, generationPrompt(input))) as GeneratedWord,
    gradeAnswer: async (input) =>
      (await request(client, model, "low", gradeSchema, gradingPrompt(input))) as Grade,
  };
}

export async function testKey(client: Anthropic, model: string): Promise<void> {
  try {
    await client.models.retrieve(model, {}, { timeout: 15_000, maxRetries: 0 });
  } catch (error) {
    throw toProviderError(error);
  }
}
