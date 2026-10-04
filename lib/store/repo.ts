import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultSettings, type Settings } from "../domain/settings";
import type { Word } from "../domain/types";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export class CorruptFileError extends Error {
  readonly file: string;

  constructor(file: string, options?: { cause?: unknown }) {
    super(`Corrupt data file moved aside: ${file}.corrupt`, options);
    this.name = "CorruptFileError";
    this.file = file;
  }
}

export interface Repo {
  getWord(dayKey: string): Promise<Word | null>;
  saveWord(word: Word): Promise<void>;
  listWords(): Promise<Word[]>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}

export function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve(".data");
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  // A unique temp name per write, so concurrent saves never share one.
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

/** Parsed JSON, or null if the file doesn't exist. Unparsable files are moved aside and throw. */
async function readJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    await rename(file, `${file}.corrupt`);
    throw new CorruptFileError(file, { cause });
  }
}

export function createRepo(dataDir: string): Repo {
  const wordsDir = path.join(dataDir, "words");
  const settingsFile = path.join(dataDir, "settings.json");

  // Validated before any path is built: dayKey comes from the URL.
  function wordFile(dayKey: string): string {
    if (!DAY_KEY.test(dayKey)) throw new Error(`Invalid dayKey: ${dayKey}`);
    return path.join(wordsDir, `${dayKey}.json`);
  }

  return {
    async getWord(dayKey) {
      return (await readJson(wordFile(dayKey))) as Word | null;
    },

    async saveWord(word) {
      await writeJsonAtomic(wordFile(word.dayKey), word);
    },

    async listWords() {
      let names: string[];
      try {
        names = await readdir(wordsDir);
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      const dayKeys = names
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.slice(0, -".json".length))
        .filter((dayKey) => DAY_KEY.test(dayKey))
        .sort()
        .reverse();

      const words: Word[] = [];
      for (const dayKey of dayKeys) {
        try {
          const word = await readJson(wordFile(dayKey));
          if (word) words.push(word as Word);
        } catch (error) {
          if (!(error instanceof CorruptFileError)) throw error;
          console.warn(error.message);
        }
      }
      return words;
    },

    async getSettings() {
      let stored: unknown;
      try {
        stored = await readJson(settingsFile);
      } catch (error) {
        if (!(error instanceof CorruptFileError)) throw error;
        console.warn(error.message);
        return defaultSettings();
      }
      if (stored === null) return defaultSettings();
      if (typeof stored !== "object" || Array.isArray(stored)) {
        await rename(settingsFile, `${settingsFile}.corrupt`);
        console.warn(`Corrupt data file moved aside: ${settingsFile}.corrupt`);
        return defaultSettings();
      }
      return { ...defaultSettings(), ...(stored as Partial<Settings>) };
    },

    async saveSettings(settings) {
      await writeJsonAtomic(settingsFile, settings);
    },
  };
}
