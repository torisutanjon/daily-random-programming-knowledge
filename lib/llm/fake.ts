import { FAKE_WORDS } from "./fake-words";
import type { GeneratedWord, Grade, LlmProvider } from "./types";

const FEEDBACK: Record<Grade["verdict"], string> = {
  fail: "This names the idea but doesn't explain the mechanism yet. Say how it works, not just what it does.",
  partial: "You're on the right track. Go one level deeper: what exactly makes it behave that way?",
  pass: "That holds up — you explained the mechanism, not just the outcome.",
};

function normalize(term: string): string {
  return term.trim().toLowerCase();
}

function demoWord(n: number): GeneratedWord {
  return {
    term: `Demo word ${n}`,
    subtitle: "Sample content for demo mode",
    topics: [1, 2, 3, 4].map((t) => ({
      title: `Demo topic ${t}`,
      questions: [
        {
          prompt: `Explain demo concept ${t} in your own words.`,
          rubric: [`Explains demo concept ${t}`],
          modelAnswer: `A model answer for demo concept ${t}.`,
        },
      ],
    })),
  };
}

/** Deterministic provider for demo mode (no API key) and tests. */
export function createFakeProvider(): LlmProvider {
  return {
    async generateWord({ area, pastTerms }) {
      const used = new Set(pastTerms.map(normalize));
      const unused = FAKE_WORDS.filter((fake) => !used.has(normalize(fake.word.term)));
      const pick = unused.find((fake) => fake.area === area) ?? unused[0];
      if (pick) return JSON.parse(JSON.stringify(pick.word)) as GeneratedWord;
      let n = 1;
      while (used.has(`demo word ${n}`)) n++;
      return demoWord(n);
    },

    async gradeAnswer({ answer }) {
      const length = answer.trim().length;
      const verdict = length < 70 ? "fail" : length < 200 ? "partial" : "pass";
      return { verdict, feedback: FEEDBACK[verdict] };
    },
  };
}
