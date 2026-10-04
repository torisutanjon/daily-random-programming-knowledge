import { z } from "zod";
import type { AreaId } from "../domain/areas";
import type { Level } from "../domain/types";

export const MAX_QUESTIONS = 12;

const text = z.string().trim().min(1);

export const generatedQuestionSchema = z.object({
  prompt: text,
  rubric: z.array(text).min(1),
  modelAnswer: text,
});

export const generatedTopicSchema = z.object({
  title: text,
  questions: z.array(generatedQuestionSchema).min(1).max(2),
});

export const generatedWordSchema = z
  .object({
    term: text,
    subtitle: text,
    topics: z.array(generatedTopicSchema).min(4).max(8),
  })
  .superRefine((word, ctx) => {
    const total = word.topics.reduce((sum, topic) => sum + topic.questions.length, 0);
    if (total > MAX_QUESTIONS) {
      ctx.addIssue({ code: "custom", message: `A word has at most ${MAX_QUESTIONS} questions`, path: ["topics"] });
    }
  });

export const gradeSchema = z.object({
  verdict: z.enum(["pass", "partial", "fail"]),
  feedback: text,
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedTopic = z.infer<typeof generatedTopicSchema>;
export type GeneratedWord = z.infer<typeof generatedWordSchema>;
export type Grade = z.infer<typeof gradeSchema>;

export interface GenerateWordInput {
  area: AreaId;
  level: Level;
  stackProfile: string[];
  pastTerms: string[];
}

export interface GradeAnswerInput {
  prompt: string;
  rubric: string[];
  answer: string;
}

export interface LlmProvider {
  generateWord(input: GenerateWordInput): Promise<GeneratedWord>;
  gradeAnswer(input: GradeAnswerInput): Promise<Grade>;
}
