import type { Settings } from "../domain/settings";
import type { Word } from "../domain/types";
import { createAnthropicClient, createAnthropicProvider } from "./anthropic";
import { createFakeProvider } from "./fake";
import type { LlmProvider } from "./types";

/** The provider for the current settings. Uses Anthropic when `settings.apiKey` is set, else the fake provider. */
export function getProvider(settings: Settings): { llm: LlmProvider; name: Word["provider"] } {
  if (settings.apiKey) {
    return {
      llm: createAnthropicProvider({
        client: createAnthropicClient(settings.apiKey),
        model: settings.model,
      }),
      name: "anthropic",
    };
  }
  return { llm: createFakeProvider(), name: "fake" };
}
