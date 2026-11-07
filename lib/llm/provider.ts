import type { Settings } from "../domain/settings";
import type { Word } from "../domain/types";
import { createAnthropicClient, createAnthropicProvider } from "./anthropic";
import { createClaudeCodeProvider } from "./claude-code";
import { createFakeProvider } from "./fake";
import type { LlmProvider } from "./types";

/** The provider for the current settings. Claude Code CLI when `useClaudeCode` is on, else Anthropic when `apiKey` is set, else the fake provider. */
export function getProvider(settings: Settings): { llm: LlmProvider; name: Word["provider"] } {
  if (settings.useClaudeCode) {
    return { llm: createClaudeCodeProvider({ model: settings.model }), name: "claude-code" };
  }
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
