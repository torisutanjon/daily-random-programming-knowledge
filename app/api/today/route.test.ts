/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { currentDayKey } from "@/lib/domain/day";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

async function loadGet(): Promise<() => Promise<Response>> {
  return (await import("@/app/api/today/route")).GET;
}

function todayKey(): string {
  return currentDayKey(new Date(), "09:00");
}

interface Body {
  dayKey: string;
  topics: Array<{ id: string; questions: Array<Record<string, unknown>> }>;
}

describe("GET /api/today", () => {
  it("returns today's sanitized word and writes it to disk", async () => {
    const GET = await loadGet();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.dayKey).toBe(todayKey());
    for (const question of body.topics.flatMap((t) => t.questions)) {
      expect(question).not.toHaveProperty("rubric");
      expect(question).not.toHaveProperty("modelAnswer");
    }
    await expect(stat(path.join(dir, "words", `${todayKey()}.json`))).resolves.toBeDefined();
  });

  it("returns the same word on sequential calls", async () => {
    const GET = await loadGet();
    const a = (await (await GET()).json()) as Body;
    const b = (await (await GET()).json()) as Body;
    expect(b.topics.map((t) => t.id)).toEqual(a.topics.map((t) => t.id));
  });

  it("generates once under 10 concurrent calls", async () => {
    const GET = await loadGet();
    const responses = await Promise.all(Array.from({ length: 10 }, () => GET()));
    for (const res of responses) expect(res.status).toBe(200);
    const bodies = (await Promise.all(responses.map((r) => r.json()))) as Body[];
    const ids = bodies[0].topics.map((t) => t.id);
    for (const body of bodies) expect(body.topics.map((t) => t.id)).toEqual(ids);
    const files = (await readdir(path.join(dir, "words"))).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(1);
  });

  it("returns 500 corrupt_file for an unparsable word file", async () => {
    await mkdir(path.join(dir, "words"), { recursive: true });
    const file = path.join(dir, "words", `${todayKey()}.json`);
    await writeFile(file, "{not json");
    const GET = await loadGet();
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: "corrupt_file" } });
    await expect(stat(`${file}.corrupt`)).resolves.toBeDefined();
  });
});
