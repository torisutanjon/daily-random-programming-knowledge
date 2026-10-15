/** @jest-environment node */
import { generationPrompt, gradingPrompt } from "./prompts";

describe("generationPrompt", () => {
  it("includes the area label, level, stack and past terms", () => {
    const { system, user } = generationPrompt({
      area: "nextjs",
      level: "mid-senior",
      stackProfile: ["React", "Postgres"],
      pastTerms: ["Hydration", "Suspense"],
    });
    const all = `${system}\n${user}`;
    for (const part of ["Next.js", "mid-senior", "React", "Postgres", "Hydration", "Suspense"]) {
      expect(all).toContain(part);
    }
  });

  it("uses a custom area's name as its label", () => {
    const { system, user } = generationPrompt({
      area: "My area",
      level: "mid",
      stackProfile: ["React"],
      pastTerms: [],
    });
    expect(system).toContain("My area");
    expect(user).toContain("My area");
  });
});

describe("gradingPrompt", () => {
  it("includes the question, rubric, answer and marks the answer untrusted", () => {
    const { system, user } = gradingPrompt({
      prompt: "Explain X",
      rubric: ["Point A", "Point B"],
      answer: "Because of Y",
    });
    const all = `${system}\n${user}`;
    for (const part of ["Explain X", "Point A", "Point B", "Because of Y", "untrusted"]) {
      expect(all).toContain(part);
    }
  });
});
