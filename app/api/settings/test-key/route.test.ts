/** @jest-environment node */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultSettings } from "@/lib/domain/settings";
import { createRepo } from "@/lib/store/repo";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "drpk-test-key-route-"));
  process.env.DATA_DIR = dir;
  jest.resetModules();
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("POST /api/settings/test-key", () => {
  it("returns 400 no_key when no key in body or settings", async () => {
    jest.doMock("@/lib/llm/anthropic", () => ({
      createAnthropicClient: jest.fn(),
      testKey: jest.fn(),
    }));

    const { POST } = await import("@/app/api/settings/test-key/route");
    const response = await POST(
      new Request("http://localhost/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "no_key" },
    });
  });

  it("uses body apiKey over stored key", async () => {
    const testKeyFn = jest.fn().mockResolvedValue(undefined);
    const createClientFn = jest.fn().mockReturnValue({ mocked: "client" });

    jest.doMock("@/lib/llm/anthropic", () => ({
      createAnthropicClient: createClientFn,
      testKey: testKeyFn,
    }));

    // Seed a stored key
    await createRepo(dir).saveSettings({ ...defaultSettings(), apiKey: "stored" });

    const { POST } = await import("@/app/api/settings/test-key/route");
    const response = await POST(
      new Request("http://localhost/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: "typed" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(createClientFn).toHaveBeenCalledWith("typed");
    expect(testKeyFn).toHaveBeenCalledWith({ mocked: "client" }, defaultSettings().model);
  });

  it("uses stored key when body omits apiKey", async () => {
    const testKeyFn = jest.fn().mockResolvedValue(undefined);
    const createClientFn = jest.fn().mockReturnValue({ mocked: "client" });

    jest.doMock("@/lib/llm/anthropic", () => ({
      createAnthropicClient: createClientFn,
      testKey: testKeyFn,
    }));

    // Seed a stored key
    await createRepo(dir).saveSettings({ ...defaultSettings(), apiKey: "stored" });

    const { POST } = await import("@/app/api/settings/test-key/route");
    const response = await POST(
      new Request("http://localhost/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(createClientFn).toHaveBeenCalledWith("stored");
  });

  it("returns 502 invalid_key when testKey rejects with ProviderError('auth')", async () => {
    const { ProviderError } = await import("@/lib/llm/errors");

    const testKeyFn = jest.fn().mockRejectedValue(new ProviderError("auth"));
    const createClientFn = jest.fn().mockReturnValue({ mocked: "client" });

    jest.doMock("@/lib/llm/anthropic", () => ({
      createAnthropicClient: createClientFn,
      testKey: testKeyFn,
    }));

    // Seed a stored key
    await createRepo(dir).saveSettings({ ...defaultSettings(), apiKey: "stored" });

    const { POST } = await import("@/app/api/settings/test-key/route");
    const response = await POST(
      new Request("http://localhost/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: "typed" }),
      }),
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: "invalid_key" } });
    // Ensure the key is not in the response
    expect(JSON.stringify(body)).not.toContain("typed");
  });

  it.each([
    ["bad JSON", "{not json"],
    ["empty apiKey", { apiKey: "" }],
    ["unknown field", { foo: 1 }],
  ])("returns 400 invalid_request for %s", async (_name, body) => {
    jest.doMock("@/lib/llm/anthropic", () => ({
      createAnthropicClient: jest.fn(),
      testKey: jest.fn(),
    }));

    const { POST } = await import("@/app/api/settings/test-key/route");
    const response = await POST(
      new Request("http://localhost/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
  });
});
