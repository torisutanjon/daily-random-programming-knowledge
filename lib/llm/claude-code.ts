import { spawn } from "node:child_process";
import os from "node:os";
import { z } from "zod";
import { ProviderError } from "./errors";
import { generationPrompt, gradingPrompt, type Prompt } from "./prompts";
import { generatedWordSchema, gradeSchema, type GeneratedWord, type Grade, type LlmProvider } from "./types";

export const CLAUDE_TIMEOUT_MS = 180_000;

export interface RunResult {
  code: number | null;
  stdout: string;
}
export type RunClaude = (args: string[], stdin: string) => Promise<RunResult>;

/** Spawns the user's own `claude` CLI. No shell: args go straight to argv, so prompt text can't inject commands. Never reads ~/.claude. */
export function runClaude(args: string[], stdin: string, command = "claude"): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      cwd: os.tmpdir(),
      windowsHide: true,
      timeout: CLAUDE_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", (cause) => {
      const missing = (cause as NodeJS.ErrnoException).code === "ENOENT";
      reject(new ProviderError(missing ? "cli_missing" : "unavailable", { cause }));
    });
    child.stdin.on("error", () => {});
    child.stdin.write(stdin);
    child.stdin.end();
    child.on("close", (code, signal) => {
      if (signal) reject(new ProviderError("unavailable"));
      else resolve({ code, stdout });
    });
  });
}

export function claudeArgs(model: string, system: string, schema: z.ZodType): string[] {
  // The CLI rejects the draft 2020-12 `$schema` URI that zod emits.
  const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete jsonSchema.$schema;
  return [
    "-p",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--tools",
    "",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--model",
    model,
    "--system-prompt",
    system,
    "--json-schema",
    JSON.stringify(jsonSchema),
  ];
}

/** CLI JSON envelope → structured output (null if absent), or a ProviderError. Parse stdout whatever the exit code: the CLI exits 1 with an is_error envelope. */
export function readEnvelope(stdout: string): unknown {
  let envelope: { is_error?: boolean; api_error_status?: number | null; result?: unknown; structured_output?: unknown };
  try {
    envelope = JSON.parse(stdout);
  } catch (cause) {
    throw new ProviderError("unavailable", { cause });
  }
  if (envelope.is_error) {
    const status = envelope.api_error_status;
    if (status === 401 || status === 403 || /\/login|log in|api key/i.test(String(envelope.result ?? ""))) {
      throw new ProviderError("cli_auth");
    }
    throw new ProviderError(status === 400 || status === 404 ? "rejected" : "unavailable");
  }
  return envelope.structured_output ?? null;
}

export function createClaudeCodeProvider({ model, run = runClaude }: { model: string; run?: RunClaude }): LlmProvider {
  async function ask(schema: z.ZodType, prompt: Prompt): Promise<unknown> {
    return readEnvelope((await run(claudeArgs(model, prompt.system, schema), prompt.user)).stdout);
  }
  return {
    generateWord: async (input) => (await ask(generatedWordSchema, generationPrompt(input))) as GeneratedWord,
    gradeAnswer: async (input) => (await ask(gradeSchema, gradingPrompt(input))) as Grade,
  };
}
