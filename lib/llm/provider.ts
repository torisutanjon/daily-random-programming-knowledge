import type { Settings } from "../domain/settings";
import type { Word } from "../domain/types";
import { createFakeProvider } from "./fake";
import type { LlmProvider } from "./types";

/** The provider for the current settings. DRPK-010 adds Anthropic when `settings.apiKey` is set. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- settings drive provider choice from DRPK-010
export function getProvider(_settings: Settings): { llm: LlmProvider; name: Word["provider"] } {
  return { llm: createFakeProvider(), name: "fake" };
}
