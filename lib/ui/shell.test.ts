import { defaultSettings } from "@/lib/domain/settings";
import type { Attempt, Verdict, Word } from "@/lib/domain/types";
import { makeWord } from "@/lib/test-utils/word";
import { buildShell } from "./shell";

const NOW = new Date(2026, 9, 8, 10, 0);

function attempt(at: Date, verdict: Verdict = "pass", answer = "a"): Attempt {
  return { answer, verdict, feedback: "f", at: at.toISOString() };
}

function learn(word: Word, topicCount: number): Word {
  for (const topic of word.topics.slice(0, topicCount)) topic.questions[0].status = "learned";
  return word;
}

describe("buildShell", () => {
  it("sets demo from the api key", () => {
    expect(buildShell([], defaultSettings(), NOW).demo).toBe(true);
    expect(buildShell([], { ...defaultSettings(), apiKey: "sk-test" }, NOW).demo).toBe(false);
  });

  it("describes today's word and progress", () => {
    const word = learn(makeWord("2026-10-08"), 1);
    expect(buildShell([word], defaultSettings(), NOW).today).toEqual({
      dayKey: "2026-10-08",
      term: "Fixture",
      progress: "1/2",
    });
    expect(buildShell([], defaultSettings(), NOW).today).toEqual({
      dayKey: "2026-10-08",
      term: null,
      progress: "",
    });
  });

  it("counts open past words only", () => {
    const words = [
      makeWord("2026-10-08"),
      makeWord("2026-10-07"),
      learn(makeWord("2026-10-06"), 2),
    ];
    expect(buildShell(words, defaultSettings(), NOW).openCount).toBe(1);
  });

  it("formats the next word time", () => {
    expect(buildShell([], defaultSettings(), new Date(2026, 9, 8, 8, 0)).nextWord).toBe("Today at 09:00");
    expect(buildShell([], defaultSettings(), NOW).nextWord).toBe("Tomorrow at 09:00");
  });

  it("lists unfinished words newest first", () => {
    const revealed = makeWord("2026-10-04");
    revealed.topics[0].questions[0].status = "revealed";
    const words = [
      makeWord("2026-10-05"),
      makeWord("2026-10-08"),
      learn(makeWord("2026-10-03"), 2),
      revealed,
    ];
    expect(buildShell(words, defaultSettings(), NOW).unfinished).toEqual([
      { dayKey: "2026-10-08", term: "Fixture", when: "Today", progress: "0/2" },
      { dayKey: "2026-10-05", term: "Fixture", when: "Mon 5 Oct", progress: "0/2" },
      { dayKey: "2026-10-04", term: "Fixture", when: "Sun 4 Oct", progress: "1/2" },
    ]);
  });

  it("logs today's attempts and reveals, newest first, capped at 8", () => {
    const word = makeWord("2026-10-08");
    const [q1, q2] = [word.topics[0].questions[0], word.topics[1].questions[0]];
    q1.attempts = [
      attempt(new Date(2026, 9, 7, 23, 0)),
      attempt(new Date(2026, 9, 8, 8, 30), "partial"),
      attempt(new Date(2026, 9, 8, 9, 15), "fail"),
    ];
    q2.attempts = [attempt(new Date(2026, 9, 8, 9, 45))];
    q2.revealedAt = new Date(2026, 9, 8, 9, 50).toISOString();
    expect(buildShell([word], defaultSettings(), NOW).log).toEqual([
      { time: "09:50", label: "Revealed", verdict: "revealed", topic: "Topic 2" },
      { time: "09:45", label: "Pass", verdict: "pass", topic: "Topic 2" },
      { time: "09:15", label: "Not yet", verdict: "fail", topic: "Topic 1" },
      { time: "08:30", label: "Partial", verdict: "partial", topic: "Topic 1" },
    ]);

    const busy = makeWord("2026-10-08");
    busy.topics[0].questions[0].attempts = Array.from({ length: 10 }, (_, i) =>
      attempt(new Date(2026, 9, 8, 1, i)),
    );
    expect(buildShell([busy], defaultSettings(), NOW).log).toHaveLength(8);
  });

  it("never leaks secrets", () => {
    const word = makeWord("2026-10-08");
    word.topics[0].questions[0].attempts = [attempt(NOW, "pass", "secret answer")];
    const json = JSON.stringify(buildShell([word], { ...defaultSettings(), apiKey: "sk-test" }, NOW));
    for (const secret of ["sk-test", "secret answer", "Point 1", "Answer 1"]) {
      expect(json).not.toContain(secret);
    }
  });
});
