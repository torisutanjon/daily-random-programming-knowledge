import { areaLabel, attemptTime, formatLongDate, progressSummary, questionStatuses } from "./word";

const q = (status: string) => ({ status }) as never;
const word = (...statuses: string[][]) =>
  ({ topics: statuses.map((s) => ({ questions: s.map(q) })) }) as never;

describe("attemptTime", () => {
  it("formats an ISO instant as local HH:mm", () => {
    expect(attemptTime("2026-10-08T13:05:00.000Z")).toBe("09:05");
  });
});

describe("progressSummary", () => {
  it("omits revealed when zero", () => {
    expect(progressSummary(word(["learned", "unanswered"]))).toBe("1/2 learned");
  });
  it("includes revealed when present", () => {
    expect(progressSummary(word(["learned", "revealed", "partial"]))).toBe("1/3 learned · 1 revealed");
  });
});

describe("questionStatuses", () => {
  it("lists statuses in topic/question order", () => {
    expect(questionStatuses(word(["learned"], ["partial", "revealed"]))).toEqual(["learned", "partial", "revealed"]);
  });
});

describe("formatLongDate", () => {
  it("formats a dayKey", () => {
    expect(formatLongDate("2026-10-08")).toBe("Thu 8 Oct 2026");
  });
});

describe("areaLabel", () => {
  it("maps known ids and falls back to the id", () => {
    expect(areaLabel("system-design")).toBe("System design");
    expect(areaLabel("nope")).toBe("nope");
  });
});
