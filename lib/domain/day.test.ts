/**
 * @jest-environment node
 */
import { currentDayKey, nextFireAt } from "./day";

// Runs in America/New_York, pinned by jest.global-setup.ts.
it("runs in the pinned DST time zone", () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(300);
  expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(240);
});

function local(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date {
  return new Date(y, mo - 1, d, h, mi, s);
}

describe("currentDayKey", () => {
  it("is the previous day before the notify time", () => {
    expect(currentDayKey(local(2026, 10, 6, 8, 30), "09:00")).toBe("2026-10-05");
  });

  it("is today exactly at the notify time", () => {
    expect(currentDayKey(local(2026, 10, 6, 9, 0), "09:00")).toBe("2026-10-06");
  });

  it("is today later in the minute after the notify time", () => {
    expect(currentDayKey(local(2026, 10, 6, 9, 0, 30), "09:00")).toBe("2026-10-06");
  });

  it("is today after the notify time", () => {
    expect(currentDayKey(local(2026, 10, 6, 23, 59), "09:00")).toBe("2026-10-06");
  });

  it("is still the previous day just after midnight", () => {
    expect(currentDayKey(local(2026, 10, 7, 0, 5), "09:00")).toBe("2026-10-06");
  });

  it("crosses month and year boundaries", () => {
    expect(currentDayKey(local(2026, 3, 1, 8, 0), "09:00")).toBe("2026-02-28");
    expect(currentDayKey(local(2026, 1, 1, 8, 0), "09:00")).toBe("2025-12-31");
  });

  it("is always today when the notify time is midnight", () => {
    expect(currentDayKey(local(2026, 10, 6, 0, 0), "00:00")).toBe("2026-10-06");
  });
});

describe("nextFireAt", () => {
  it("is today's notify time when it hasn't passed", () => {
    expect(nextFireAt(local(2026, 10, 6, 8, 30), "09:00")).toEqual(local(2026, 10, 6, 9, 0));
  });

  it("is tomorrow when now is exactly the notify time", () => {
    expect(nextFireAt(local(2026, 10, 6, 9, 0), "09:00")).toEqual(local(2026, 10, 7, 9, 0));
  });

  it("is tomorrow later in the notify minute", () => {
    expect(nextFireAt(local(2026, 10, 6, 9, 0, 30), "09:00")).toEqual(local(2026, 10, 7, 9, 0));
  });

  it("is tomorrow after the notify time", () => {
    expect(nextFireAt(local(2026, 10, 6, 10, 0), "09:00")).toEqual(local(2026, 10, 7, 9, 0));
  });

  it("rolls over the year", () => {
    expect(nextFireAt(local(2026, 12, 31, 10, 0), "09:00")).toEqual(local(2027, 1, 1, 9, 0));
  });
});

describe("DST spring forward (2026-03-08, New York)", () => {
  it("fires at 09:00 EDT the morning after", () => {
    expect(nextFireAt(local(2026, 3, 7, 10, 0), "09:00").toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("fires a notify time inside the gap at 03:30 EDT", () => {
    expect(nextFireAt(local(2026, 3, 8, 1, 0), "02:30").toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("switches the day key at the first clock time past the gap", () => {
    expect(currentDayKey(new Date("2026-03-08T06:59:00Z"), "02:30")).toBe("2026-03-07");
    expect(currentDayKey(new Date("2026-03-08T07:05:00Z"), "02:30")).toBe("2026-03-08");
  });
});

describe("DST fall back (2026-11-01, New York)", () => {
  it("fires at 09:00 EST the morning after", () => {
    expect(nextFireAt(local(2026, 10, 31, 10, 0), "09:00").toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("fires at the first 01:30 of the repeated hour", () => {
    expect(nextFireAt(local(2026, 11, 1, 0, 0), "01:30").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("does not fire again at the second 01:30", () => {
    expect(nextFireAt(new Date("2026-11-01T05:31:00Z"), "01:30").toISOString()).toBe("2026-11-02T06:30:00.000Z");
  });

  it("keeps the same day key through the repeated hour", () => {
    expect(currentDayKey(new Date("2026-11-01T05:45:00Z"), "01:30")).toBe("2026-11-01");
    expect(currentDayKey(new Date("2026-11-01T06:45:00Z"), "01:30")).toBe("2026-11-01");
  });
});

describe("invalid input", () => {
  it.each(["9:00", "24:00", "09:60", "", " 09:00"])("rejects notifyTime %p", (bad) => {
    expect(() => currentDayKey(local(2026, 10, 6, 9, 0), bad)).toThrow("Invalid notifyTime");
    expect(() => nextFireAt(local(2026, 10, 6, 9, 0), bad)).toThrow("Invalid notifyTime");
  });

  it("rejects an invalid date", () => {
    expect(() => currentDayKey(new Date(Number.NaN), "09:00")).toThrow("Invalid date");
    expect(() => nextFireAt(new Date(Number.NaN), "09:00")).toThrow("Invalid date");
  });
});
