/** @jest-environment node */
import { defaultSettings } from "@/lib/domain/settings";
import { getProvider } from "./provider";

describe("getProvider", () => {
  it("returns fake provider when apiKey is null", () => {
    const provider = getProvider({ ...defaultSettings(), apiKey: null });
    expect(provider.name).toBe("fake");
  });

  it("returns anthropic provider when apiKey is set", () => {
    const provider = getProvider({ ...defaultSettings(), apiKey: "k" });
    expect(provider.name).toBe("anthropic");
  });

  it("returns claude-code provider when useClaudeCode is on, even with an apiKey", () => {
    const provider = getProvider({ ...defaultSettings(), apiKey: "k", useClaudeCode: true });
    expect(provider.name).toBe("claude-code");
  });

  it("defaults useClaudeCode to false", () => {
    expect(defaultSettings().useClaudeCode).toBe(false);
  });
});
