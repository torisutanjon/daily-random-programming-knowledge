/** @jest-environment node */
import { defaultSettings, toPublicSettings } from "./settings";

describe("toPublicSettings", () => {
  it("excludes apiKey and sets hasApiKey false with default settings", () => {
    const publicSettings = toPublicSettings(defaultSettings());
    expect("apiKey" in publicSettings).toBe(false);
    expect(publicSettings.hasApiKey).toBe(false);
  });

  it("sets hasApiKey true when apiKey is present", () => {
    const settings = { ...defaultSettings(), apiKey: "k" };
    const publicSettings = toPublicSettings(settings);
    expect(publicSettings.hasApiKey).toBe(true);
    expect("apiKey" in publicSettings).toBe(false);
  });

  it("copies areas as a new array so mutations don't affect input", () => {
    const settings = defaultSettings();
    const publicSettings = toPublicSettings(settings);
    // The returned areas is a different array instance
    expect(publicSettings.areas).not.toBe(settings.areas);
    expect(publicSettings.areas).toEqual(settings.areas);
  });

  it("copies stackProfile as a new array so mutations don't affect input", () => {
    const settings = defaultSettings();
    const publicSettings = toPublicSettings(settings);
    const original = [...settings.stackProfile];
    publicSettings.stackProfile.push("test");
    expect(settings.stackProfile).toEqual(original);
  });
});
