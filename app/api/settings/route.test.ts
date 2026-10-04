/** @jest-environment node */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultSettings } from "@/lib/domain/settings";
import { createRepo } from "@/lib/store/repo";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-settings-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

function request(body: unknown | string): Request {
  return new Request("http://localhost/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function get(): Promise<Response> {
  const { GET } = await import("@/app/api/settings/route");
  return GET();
}

async function put(body: unknown | string): Promise<Response> {
  const { PUT } = await import("@/app/api/settings/route");
  return PUT(request(body));
}

describe("GET /api/settings", () => {
  it("returns defaults with hasApiKey false and no apiKey when no file exists", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json();
    const expected: Record<string, unknown> = { ...defaultSettings(), hasApiKey: false };
    delete expected.apiKey;
    expect(body).toEqual(expected);
    expect("apiKey" in body).toBe(false);
  });

  it("reports hasApiKey true without the key after a key is saved", async () => {
    await put({ apiKey: "sk-test" });
    const body = await (await get()).json();
    expect(body.hasApiKey).toBe(true);
    expect("apiKey" in body).toBe(false);
  });
});

describe("PUT /api/settings", () => {
  it("sets the api key without echoing it", async () => {
    const response = await put({ apiKey: "sk-test" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.hasApiKey).toBe(true);
    expect("apiKey" in body).toBe(false);
    expect((await createRepo(dir).getSettings()).apiKey).toBe("sk-test");
  });

  it("merges a partial body onto the stored settings", async () => {
    await put({ apiKey: "sk-test" });
    const response = await put({ notifyTime: "07:30" });
    expect(response.status).toBe(200);
    const stored = await createRepo(dir).getSettings();
    const defaults = defaultSettings();
    expect(stored.apiKey).toBe("sk-test");
    expect(stored.notifyTime).toBe("07:30");
    expect(stored.level).toEqual(defaults.level);
    expect(stored.areas).toEqual(defaults.areas);
    expect(stored.model).toEqual(defaults.model);
    expect(stored.launchAtLogin).toEqual(defaults.launchAtLogin);
    expect(stored.stackProfile).toEqual(defaults.stackProfile);
  });

  it("clears the api key when given null", async () => {
    await put({ apiKey: "sk-test" });
    const response = await put({ apiKey: null });
    expect(response.status).toBe(200);
    expect((await response.json()).hasApiKey).toBe(false);
    expect((await createRepo(dir).getSettings()).apiKey).toBeNull();
  });

  it("de-duplicates areas keeping the first occurrence", async () => {
    const response = await put({ areas: ["nextjs", "nextjs", "security"] });
    expect(response.status).toBe(200);
    expect((await createRepo(dir).getSettings()).areas).toEqual(["nextjs", "security"]);
  });

  it("returns 200 with empty body leaving settings unchanged", async () => {
    const response = await put({});
    expect(response.status).toBe(200);
    expect(await createRepo(dir).getSettings()).toEqual(defaultSettings());
  });

  it("trims whitespace from apiKey", async () => {
    const response = await put({ apiKey: "  sk-x  " });
    expect(response.status).toBe(200);
    expect((await createRepo(dir).getSettings()).apiKey).toBe("sk-x");
  });

  it.each([
    ["bad JSON", "{not json"],
    ["notifyTime 24:00", { notifyTime: "24:00" }],
    ["notifyTime 9:00", { notifyTime: "9:00" }],
    ["level junior", { level: "junior" }],
    ["empty areas", { areas: [] }],
    ["unknown area", { areas: ["nope"] }],
    ["blank stackProfile entry", { stackProfile: ["  "] }],
    ["empty model", { model: "" }],
    ["non-boolean launchAtLogin", { launchAtLogin: "yes" }],
    ["unknown key", { foo: 1 }],
  ])("returns 400 invalid_request for %s", async (_name, body) => {
    await put({ apiKey: "sk-test", level: "senior" });
    const seeded = await createRepo(dir).getSettings();
    const response = await put(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    expect(await createRepo(dir).getSettings()).toEqual(seeded);
  });

  it("persists both fields of two concurrent PUTs", async () => {
    const { PUT } = await import("@/app/api/settings/route");
    await Promise.all([
      PUT(request({ notifyTime: "06:15" })),
      PUT(request({ level: "senior" })),
    ]);
    const stored = await createRepo(dir).getSettings();
    expect(stored.notifyTime).toBe("06:15");
    expect(stored.level).toBe("senior");
  });
});
