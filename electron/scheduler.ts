export interface SchedulerDeps {
  baseUrl: string;
  fetch: typeof fetch;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  notify: (body: string) => void; // title is always "drpk"
  applyLaunchAtLogin: (on: boolean) => void;
}

export interface Scheduler {
  start(): void;
  check(): Promise<void>;
  stop(): void;
}

interface Schedule {
  dayKey: string;
  hasWord: boolean;
  nextFireAt: string;
  launchAtLogin: boolean;
}

const MIN_MS = 1_000;
const MAX_MS = 60_000;
const FAILURE_TOAST = "Couldn't fetch today's word — open to retry";

export function createScheduler(deps: SchedulerDeps): Scheduler {
  let running = false;
  let timer: unknown = null;
  let lastHandledDayKey: string | null = null;
  let appliedLaunch: boolean | null = null;

  function clear(): void {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  }

  function arm(ms: number): void {
    clear();
    timer = deps.setTimer(() => void check(), Number.isFinite(ms) ? Math.min(MAX_MS, Math.max(MIN_MS, ms)) : MAX_MS);
  }

  async function getSchedule(): Promise<Schedule | null> {
    try {
      const res = await deps.fetch(`${deps.baseUrl}/api/schedule`);
      if (!res.ok) return null;
      return (await res.json()) as Schedule;
    } catch {
      return null;
    }
  }

  async function generate(): Promise<string | null> {
    try {
      const res = await deps.fetch(`${deps.baseUrl}/api/today`);
      if (!res.ok) return null;
      const body = (await res.json()) as { term?: unknown };
      return typeof body.term === "string" ? body.term : null;
    } catch {
      return null;
    }
  }

  async function check(): Promise<void> {
    if (running) return;
    running = true;
    try {
      clear();
      const schedule = await getSchedule();
      if (!schedule) {
        arm(MAX_MS);
        return;
      }
      if (schedule.launchAtLogin !== appliedLaunch) {
        appliedLaunch = schedule.launchAtLogin;
        deps.applyLaunchAtLogin(schedule.launchAtLogin);
      }
      if (!schedule.hasWord && schedule.dayKey !== lastHandledDayKey) {
        lastHandledDayKey = schedule.dayKey;
        const term = await generate();
        deps.notify(term === null ? FAILURE_TOAST : `Today's word: ${term}`);
      }
      arm(Date.parse(schedule.nextFireAt) - deps.now());
    } finally {
      running = false;
    }
  }

  return {
    start: () => void check(),
    check,
    stop: clear,
  };
}
