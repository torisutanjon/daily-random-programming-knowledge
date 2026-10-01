/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultSettings } from "../domain/settings";
import type { Word } from "../domain/types";
import { CorruptFileError, createRepo, getDataDir } from "./repo";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-repo-"));
});

afterEach(async () => {
  jest.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

function word(dayKey: string, term = "MVCC"): Word {
  return {
    dayKey,
    term,
    subtitle: "Multi-version concurrency control",
    area: "postgres-databases",
    level: "mid-senior",
    topics: [
      {
        id: "t1",
        title: "Snapshots",
        questions: [
          { id: "q1", prompt: "p", rubric: ["r"], modelAnswer: "a", status: "unanswered", revealedAt: null, attempts: [] },
        ],
      },
    ],
    createdAt: "2026-10-01T01:00:00.000Z",
    provider: "fake",
  };
}

const wordsDir = () => path.join(dir, "words");

describe("words", () => {
  it("round-trips a saved word", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(word("2026-10-01"));
    expect(await repo.getWord("2026-10-01")).toEqual(word("2026-10-01"));
  });

  it("returns null for a word that was never saved", async () => {
    expect(await createRepo(dir).getWord("2026-10-01")).toBeNull();
  });

  it("overwrites a word on save", async () => {
    const repo = createRepo(dir);
    await repo.saveWord(word("2026-10-01", "First"));
    await repo.saveWord(word("2026-10-01", "Second"));
    expect((await repo.getWord("2026-10-01"))?.term).toBe("Second");
  });

  it("lists words newest first", async () => {
    const repo = createRepo(dir);
    for (const key of ["2026-09-30", "2026-10-01", "2026-09-29"]) await repo.saveWord(word(key));
    expect((await repo.listWords()).map((w) => w.dayKey)).toEqual(["2026-10-01", "2026-09-30", "2026-09-29"]);
  });

  it("lists nothing before anything is saved", async () => {
    expect(await createRepo(dir).listWords()).toEqual([]);
  });

  it.each(["../settings", "2026-10-1", "2026-10-01.json", ""])("rejects dayKey %p", async (dayKey) => {
    const repo = createRepo(dir);
    await expect(repo.getWord(dayKey)).rejects.toThrow("Invalid dayKey");
    await expect(repo.saveWord(word(dayKey))).rejects.toThrow("Invalid dayKey");
  });

  it("leaves no temp files after saving", async () => {
    await createRepo(dir).saveWord(word("2026-10-01"));
    expect(await readdir(wordsDir())).toEqual(["2026-10-01.json"]);
  });

  it("keeps one valid file under concurrent saves", async () => {
    const repo = createRepo(dir);
    await Promise.all(Array.from({ length: 20 }, (_, i) => repo.saveWord(word("2026-10-01", `T${i}`))));
    expect(await readdir(wordsDir())).toEqual(["2026-10-01.json"]);
    const saved = JSON.parse(await readFile(path.join(wordsDir(), "2026-10-01.json"), "utf8"));
    expect(saved.term).toMatch(/^T\d+$/);
  });
});

describe("corrupt word files", () => {
  async function writeCorrupt(dayKey: string): Promise<void> {
    await mkdir(wordsDir(), { recursive: true });
    await writeFile(path.join(wordsDir(), `${dayKey}.json`), "{not json");
  }

  it("moves a corrupt word aside and throws CorruptFileError", async () => {
    await writeCorrupt("2026-10-01");
    await expect(createRepo(dir).getWord("2026-10-01")).rejects.toBeInstanceOf(CorruptFileError);
    expect(await readdir(wordsDir())).toEqual(["2026-10-01.json.corrupt"]);
  });

  it("skips corrupt words when listing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const repo = createRepo(dir);
    await repo.saveWord(word("2026-09-30"));
    await writeCorrupt("2026-10-01");
    expect((await repo.listWords()).map((w) => w.dayKey)).toEqual(["2026-09-30"]);
    expect((await readdir(wordsDir())).sort()).toEqual(["2026-09-30.json", "2026-10-01.json.corrupt"]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("settings", () => {
  const settingsFile = () => path.join(dir, "settings.json");

  it("returns defaults when nothing is saved", async () => {
    expect(await createRepo(dir).getSettings()).toEqual(defaultSettings());
  });

  it("round-trips saved settings", async () => {
    const repo = createRepo(dir);
    const settings = { ...defaultSettings(), notifyTime: "07:30", apiKey: "sk-test" };
    await repo.saveSettings(settings);
    expect(await repo.getSettings()).toEqual(settings);
  });

  it("fills fields missing from an older file with defaults", async () => {
    await writeFile(settingsFile(), JSON.stringify({ notifyTime: "07:30" }));
    expect(await createRepo(dir).getSettings()).toEqual({ ...defaultSettings(), notifyTime: "07:30" });
  });

  it.each(["{not json", "[1,2]", "42"])("moves corrupt settings %p aside and uses defaults", async (content) => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await writeFile(settingsFile(), content);
    expect(await createRepo(dir).getSettings()).toEqual(defaultSettings());
    expect(await readdir(dir)).toEqual(["settings.json.corrupt"]);
  });

  it("returns a fresh copy of the defaults", async () => {
    const repo = createRepo(dir);
    (await repo.getSettings()).areas.pop();
    expect((await repo.getSettings()).areas).toHaveLength(16);
  });
});

describe("getDataDir", () => {
  const original = process.env.DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = original;
  });

  it("uses DATA_DIR when set", () => {
    process.env.DATA_DIR = "/x/data";
    expect(getDataDir()).toBe("/x/data");
  });

  it("defaults to ./.data", () => {
    delete process.env.DATA_DIR;
    expect(getDataDir()).toBe(path.resolve(".data"));
  });
});
