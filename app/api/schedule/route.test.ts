/** @jest-environment node */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { currentDayKey, nextFireAt } from "@/lib/domain/day";
import { defaultSettings } from "@/lib/domain/settings";
import { createRepo } from "@/lib/store/repo";
import { makeWord } from "@/lib/test-utils/word";

type ScheduleBody = {
  dayKey: string;
  hasWord: boolean;
  nextFireAt: string;
  launchAtLogin: boolean;
};

// 2026-10-08 10:00 in America/New_York (global setup) — after 09:00, so the day key is today.
const NOW = new Date(2026, 9, 8, 10, 0);

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-schedule-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
  // Fake only Date so async fs keeps working.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
});

afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function get(): Promise<Response> {
  const { GET } = await import("@/app/api/schedule/route");
  return GET();
}

describe("GET /api/schedule", () => {
  it("returns the schedule when there is no word yet", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body: ScheduleBody = await response.json();
    expect(body).toEqual({
      dayKey: currentDayKey(NOW, "09:00"),
      hasWord: false,
      nextFireAt: nextFireAt(NOW, "09:00").toISOString(),
      launchAtLogin: true,
    });
    expect(body.dayKey).toBe("2026-10-08");
  });

  it("reports hasWord when today's word is saved", async () => {
    await createRepo(dir).saveWord(makeWord("2026-10-08"));
    const body: ScheduleBody = await (await get()).json();
    expect(body.hasWord).toBe(true);
    expect(body.dayKey).toBe("2026-10-08");
  });

  it("honours the saved notifyTime and launchAtLogin", async () => {
    await createRepo(dir).saveSettings({
      ...defaultSettings(),
      notifyTime: "11:30",
      launchAtLogin: false,
    });
    const body: ScheduleBody = await (await get()).json();
    expect(body.dayKey).toBe("2026-10-07");
    expect(body.nextFireAt).toBe(nextFireAt(NOW, "11:30").toISOString());
    expect(body.launchAtLogin).toBe(false);
  });

  it("never leaks the api key or word content", async () => {
    await createRepo(dir).saveSettings({ ...defaultSettings(), apiKey: "sk-secret-123" });
    await createRepo(dir).saveWord(makeWord("2026-10-08"));
    const text = await (await get()).text();
    expect(text).not.toContain("sk-");
    expect(text).not.toContain("apiKey");
    expect(text).not.toContain("Fixture");
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      "dayKey",
      "hasWord",
      "launchAtLogin",
      "nextFireAt",
    ]);
  });

  it("falls back to default settings when settings.json is corrupt", async () => {
    await writeFile(path.join(dir, "settings.json"), "{not json");
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await get();
    expect(response.status).toBe(200);
    const body: ScheduleBody = await response.json();
    expect(body.nextFireAt).toBe(nextFireAt(NOW, "09:00").toISOString());
  });

  it("returns 500 corrupt_file when today's word file is corrupt", async () => {
    await createRepo(dir).saveWord(makeWord("2026-10-01")); // ensures words/ exists
    await writeFile(path.join(dir, "words", "2026-10-08.json"), "{not json");
    const response = await get();
    expect(response.status).toBe(500);
    const body: { error: { code: string } } = await response.json();
    expect(body.error.code).toBe("corrupt_file");
  });
});
