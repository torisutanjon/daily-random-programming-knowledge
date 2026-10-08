import { attemptTime } from "./word";

describe("attemptTime", () => {
  it("formats an ISO instant as local HH:mm", () => {
    expect(attemptTime("2026-10-08T13:05:00.000Z")).toBe("09:05");
  });
});
