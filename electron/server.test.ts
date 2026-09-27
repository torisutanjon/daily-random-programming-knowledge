/**
 * @jest-environment node
 */
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { getFreePort, standaloneServerPath, waitForServer } from "./server";

describe("getFreePort", () => {
  it("returns a port that can be bound", async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThan(0);
    await new Promise<void>((resolve, reject) => {
      const srv = net.createServer();
      srv.once("error", reject);
      srv.listen(port, "127.0.0.1", () => srv.close(() => resolve()));
    });
  });
});

describe("waitForServer", () => {
  it("resolves once the server answers", async () => {
    const port = await getFreePort();
    const srv = http.createServer((_req, res) => res.end("ok"));
    setTimeout(() => srv.listen(port, "127.0.0.1"), 150);
    try {
      await expect(
        waitForServer(`http://127.0.0.1:${port}`, { timeoutMs: 3000, intervalMs: 50 }),
      ).resolves.toBeUndefined();
    } finally {
      srv.close();
    }
  });

  it("rejects after the timeout when nothing listens", async () => {
    const port = await getFreePort();
    await expect(
      waitForServer(`http://127.0.0.1:${port}`, { timeoutMs: 300, intervalMs: 50 }),
    ).rejects.toThrow(/timed out/i);
  });
});

describe("standaloneServerPath", () => {
  it("uses resources/standalone when packaged", () => {
    expect(standaloneServerPath("/res", true, "/app")).toBe(
      path.join("/res", "standalone", "server.js"),
    );
  });

  it("uses .next/standalone in the app root when not packaged", () => {
    expect(standaloneServerPath("/res", false, "/app")).toBe(
      path.join("/app", ".next", "standalone", "server.js"),
    );
  });
});
