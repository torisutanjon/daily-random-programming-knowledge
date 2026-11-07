/** @jest-environment node */
import { ProviderError } from "./errors";
import { claudeArgs, createClaudeCodeProvider, readEnvelope, runClaude, type RunClaude } from "./claude-code";
import { generationPrompt, gradingPrompt } from "./prompts";
import { generatedWordSchema, gradeSchema, type GenerateWordInput, type GradeAnswerInput } from "./types";

const genInput: GenerateWordInput = { area: "databases", level: "mid-senior", stackProfile: ["React"], pastTerms: [] };
const gradeInput: GradeAnswerInput = { prompt: "Why?", rubric: ["a"], answer: "b" };
const word = { term: "t", subtitle: "s", topics: [] };
const grade = { verdict: "pass", feedback: "ok" };

const envelope = (extra: object): string => JSON.stringify({ is_error: false, ...extra });

function fake(stdout: string): { run: RunClaude; calls: { args: string[]; stdin: string }[] } {
  const calls: { args: string[]; stdin: string }[] = [];
  const run: RunClaude = async (args, stdin) => {
    calls.push({ args, stdin });
    return { code: 0, stdout };
  };
  return { run, calls };
}

function pairs(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function expectBaseArgs(args: string[], system: string): void {
  expect(args[0]).toBe("-p");
  expect(pairs(args, "--output-format")).toBe("json");
  expect(args).toContain("--no-session-persistence");
  expect(pairs(args, "--tools")).toBe("");
  expect(args).toContain("--strict-mcp-config");
  expect(pairs(args, "--setting-sources")).toBe("");
  expect(pairs(args, "--model")).toBe("m1");
  expect(pairs(args, "--system-prompt")).toBe(system);
  const schema = JSON.parse(pairs(args, "--json-schema") as string);
  expect(typeof schema).toBe("object");
}

describe("createClaudeCodeProvider", () => {
  it("generateWord passes args and stdin, returns structured_output", async () => {
    const { run, calls } = fake(envelope({ structured_output: word }));
    const result = await createClaudeCodeProvider({ model: "m1", run }).generateWord(genInput);
    const prompt = generationPrompt(genInput);
    expectBaseArgs(calls[0].args, prompt.system);
    expect(calls[0].stdin).toBe(prompt.user);
    expect(result).toEqual(word);
  });

  it("gradeAnswer passes args and stdin, returns structured_output", async () => {
    const { run, calls } = fake(envelope({ structured_output: grade }));
    const result = await createClaudeCodeProvider({ model: "m1", run }).gradeAnswer(gradeInput);
    const prompt = gradingPrompt(gradeInput);
    expectBaseArgs(calls[0].args, prompt.system);
    expect(calls[0].stdin).toBe(prompt.user);
    expect(result).toEqual(grade);
  });

  it("returns null when structured_output is missing", async () => {
    const { run } = fake(envelope({ result: "hi" }));
    expect(await createClaudeCodeProvider({ model: "m1", run }).gradeAnswer(gradeInput)).toBeNull();
  });
});

describe("claudeArgs", () => {
  it("emits an object JSON schema for the generated word (refinements included)", () => {
    const schema = JSON.parse(pairs(claudeArgs("m", "s", generatedWordSchema), "--json-schema") as string);
    expect(schema.type).toBe("object");
    expect(schema.properties.topics).toBeDefined();
  });
});

it.each([
  ["generatedWordSchema", generatedWordSchema],
  ["gradeSchema", gradeSchema],
])("the --json-schema arg has no $schema key (the CLI rejects draft 2020-12): %s", (_name, schema) => {
  const parsed = JSON.parse(pairs(claudeArgs("m", "s", schema), "--json-schema") as string);
  expect(parsed).not.toHaveProperty("$schema");
});

describe("readEnvelope", () => {
  const failure = (fields: object): ProviderError | undefined => {
    try {
      readEnvelope(JSON.stringify({ is_error: true, ...fields }));
    } catch (error) {
      return error as ProviderError;
    }
    return undefined;
  };

  it("maps unparseable stdout to unavailable", () => {
    expect(() => readEnvelope("not json")).toThrow(expect.objectContaining({ reason: "unavailable" }));
  });

  it.each([
    [{ api_error_status: 401 }, "cli_auth"],
    [{ api_error_status: 403 }, "cli_auth"],
    [{ api_error_status: null, result: "Invalid API key · Please run /login" }, "cli_auth"],
    [{ api_error_status: 400 }, "rejected"],
    [{ api_error_status: 404 }, "rejected"],
    [{ api_error_status: 529 }, "unavailable"],
    [{ api_error_status: 500, result: "boom" }, "unavailable"],
  ])("maps %j to %s", (fields, reason) => {
    const error = failure(fields);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error?.reason).toBe(reason);
  });
});

describe("runClaude", () => {
  it("rejects cli_missing when the command does not exist", async () => {
    await expect(runClaude([], "", "drpk-no-such-command-xyz")).rejects.toMatchObject({
      name: "ProviderError",
      reason: "cli_missing",
    });
  });

  it("pipes stdin to stdout", async () => {
    await expect(runClaude(["-e", "process.stdin.pipe(process.stdout)"], "hi", process.execPath)).resolves.toEqual({
      code: 0,
      stdout: "hi",
    });
  });
});
