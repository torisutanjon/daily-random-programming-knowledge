/**
 * @jest-environment node
 */
import { createScheduler } from "./scheduler";

const NOW = Date.parse("2026-10-08T13:00:00.000Z");
const BASE = "http://127.0.0.1:4000";

interface SetupOpts {
  scheduleFails?: boolean;
  todayFails?: boolean;
  scheduleThrows?: boolean;
  scheduleGate?: Promise<void>;
}

function setup(opts: SetupOpts = {}) {
  const state = { ...opts };
  const schedule = {
    dayKey: "2026-10-08",
    hasWord: false,
    nextFireAt: new Date(NOW + 30_000).toISOString(),
    launchAtLogin: true,
  };
  const timers: { fn: () => void; ms: number }[] = [];
  const fetchMock = jest.fn(async (url: string) => {
    if (url.endsWith("/api/schedule")) {
      if (state.scheduleThrows) throw new Error("network down");
      if (state.scheduleGate) await state.scheduleGate;
      if (state.scheduleFails) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => schedule };
    }
    if (state.todayFails) {
      return { ok: false, status: 502, json: async () => ({ error: { code: "invalid_key" } }) };
    }
    return { ok: true, json: async () => ({ term: "MVCC" }) };
  });
  const setTimer = jest.fn((fn: () => void, ms: number) => {
    timers.push({ fn, ms });
    return timers.length;
  });
  const clearTimer = jest.fn();
  const notify = jest.fn();
  const applyLaunchAtLogin = jest.fn();
  const scheduler = createScheduler({
    baseUrl: BASE,
    fetch: fetchMock as unknown as typeof fetch,
    now: () => NOW,
    setTimer,
    clearTimer,
    notify,
    applyLaunchAtLogin,
  });
  const lastDelay = (): number | undefined => timers.at(-1)?.ms;
  return { state, schedule, timers, fetchMock, setTimer, clearTimer, notify, applyLaunchAtLogin, scheduler, lastDelay };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));
const calls = (f: jest.Mock, suffix: string): number =>
  f.mock.calls.filter(([u]) => String(u).endsWith(suffix)).length;

describe("createScheduler", () => {
  it("no word yet: generates and toasts once", async () => {
    const t = setup();
    await t.scheduler.check();
    expect(t.fetchMock.mock.calls.some(([u]) => u === `${BASE}/api/today`)).toBe(true);
    expect(t.notify).toHaveBeenCalledTimes(1);
    expect(t.notify).toHaveBeenCalledWith("Today's word: MVCC");
  });

  it("word exists: no toast", async () => {
    const t = setup();
    t.schedule.hasWord = true;
    await t.scheduler.check();
    expect(calls(t.fetchMock, "/api/today")).toBe(0);
    expect(t.notify).not.toHaveBeenCalled();
  });

  it("same day checked twice toasts once", async () => {
    const t = setup();
    await t.scheduler.check();
    await t.scheduler.check();
    expect(t.notify).toHaveBeenCalledTimes(1);
  });

  it("a new day toasts again", async () => {
    const t = setup();
    await t.scheduler.check();
    t.schedule.dayKey = "2026-10-09";
    await t.scheduler.check();
    expect(t.notify).toHaveBeenCalledTimes(2);
  });

  it("generation failure retries up to 3 times and toasts once", async () => {
    const t = setup({ todayFails: true });
    for (let i = 0; i < 2; i++) await t.scheduler.check();
    expect(t.notify).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++) await t.scheduler.check();
    expect(calls(t.fetchMock, "/api/today")).toBe(3);
    expect(t.notify).toHaveBeenCalledTimes(1);
    expect(t.notify).toHaveBeenCalledWith("Couldn't fetch today's word — open to retry");
  });

  it("a retry that succeeds toasts the word, no failure toast", async () => {
    const t = setup({ todayFails: true });
    await t.scheduler.check();
    t.state.todayFails = false;
    await t.scheduler.check();
    await t.scheduler.check();
    expect(t.notify).toHaveBeenCalledTimes(1);
    expect(t.notify).toHaveBeenCalledWith("Today's word: MVCC");
  });

  it("the word appearing between retries stops retrying", async () => {
    const t = setup({ todayFails: true });
    await t.scheduler.check();
    t.schedule.hasWord = true;
    await t.scheduler.check();
    expect(calls(t.fetchMock, "/api/today")).toBe(1);
    expect(t.notify).not.toHaveBeenCalled();
  });

  it("timer arms for nextFireAt when under a minute", async () => {
    const t = setup();
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(30_000);
  });

  it("timer caps at 60 s", async () => {
    const t = setup();
    t.schedule.nextFireAt = new Date(NOW + 2 * 60 * 60_000).toISOString();
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(60_000);
  });

  it("timer floors at 1 s", async () => {
    const t = setup();
    t.schedule.nextFireAt = new Date(NOW - 5_000).toISOString();
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(1_000);
  });

  it("unparseable nextFireAt waits 60 s", async () => {
    const t = setup();
    t.schedule.nextFireAt = "garbage";
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(60_000);
  });

  it("notify throwing still resolves and re-arms", async () => {
    const t = setup();
    t.notify.mockImplementation(() => {
      throw new Error("toast failed");
    });
    await expect(t.scheduler.check()).resolves.toBeUndefined();
    expect(t.lastDelay()).toBe(30_000);
  });

  it("schedule failure re-arms at 60 s without toasting", async () => {
    const t = setup({ scheduleFails: true });
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(60_000);
    expect(t.notify).not.toHaveBeenCalled();
  });

  it("network error re-arms at 60 s", async () => {
    const t = setup({ scheduleThrows: true });
    await t.scheduler.check();
    expect(t.lastDelay()).toBe(60_000);
  });

  it("launch at login applied once per change", async () => {
    const t = setup();
    await t.scheduler.check();
    await t.scheduler.check();
    expect(t.applyLaunchAtLogin).toHaveBeenCalledTimes(1);
    expect(t.applyLaunchAtLogin).toHaveBeenCalledWith(true);
    t.schedule.launchAtLogin = false;
    await t.scheduler.check();
    expect(t.applyLaunchAtLogin).toHaveBeenCalledTimes(2);
    expect(t.applyLaunchAtLogin).toHaveBeenLastCalledWith(false);
  });

  it("a check while one runs is skipped", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const t = setup({ scheduleGate: gate });
    const first = t.scheduler.check();
    const second = t.scheduler.check();
    await flush();
    expect(calls(t.fetchMock, "/api/schedule")).toBe(1);
    release();
    await Promise.all([first, second]);
    await flush();
  });

  it("start runs a check", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    expect(calls(t.fetchMock, "/api/schedule")).toBe(1);
  });

  it("stop clears the armed timer", async () => {
    const t = setup();
    await t.scheduler.check();
    t.scheduler.stop();
    expect(t.clearTimer).toHaveBeenLastCalledWith(t.timers.length);
  });
});
