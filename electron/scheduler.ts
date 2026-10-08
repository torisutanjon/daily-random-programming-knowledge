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
const MAX_ATTEMPTS = 3;
const FAILURE_TOAST = "Couldn't fetch today's word — open to retry";

export function createScheduler(deps: SchedulerDeps): Scheduler {
  let running = false;
  let timer: unknown = null;
  let lastHandledDayKey: string | null = null;
  let appliedLaunch: boolean | null = null;
  let failures = { dayKey: "", count: 0 };

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
    let nextFireAt: string | null = null;
    try {
      clear();
      const schedule = await getSchedule();
      if (!schedule) return;
      nextFireAt = schedule.nextFireAt;
      if (schedule.launchAtLogin !== appliedLaunch) {
        appliedLaunch = schedule.launchAtLogin;
        try {
          deps.applyLaunchAtLogin(schedule.launchAtLogin);
        } catch {
          // a failing login-item call must not stop the scheduler
        }
      }
      if (!schedule.hasWord && schedule.dayKey !== lastHandledDayKey) {
        const term = await generate();
        let body: string | null = null;
        if (term !== null) {
          body = `Today's word: ${term}`;
        } else {
          failures = {
            dayKey: schedule.dayKey,
            count: (failures.dayKey === schedule.dayKey ? failures.count : 0) + 1,
          };
          if (failures.count >= MAX_ATTEMPTS) body = FAILURE_TOAST;
        }
        if (body !== null) {
          lastHandledDayKey = schedule.dayKey;
          try {
            deps.notify(body);
          } catch {
            // a failing toast must not stop the scheduler
          }
        }
      }
    } finally {
      arm(nextFireAt === null ? MAX_MS : Date.parse(nextFireAt) - deps.now());
      running = false;
    }
  }

  return {
    start: () => void check(),
    check,
    stop: clear,
  };
}
