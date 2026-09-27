import net from "node:net";
import path from "node:path";

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function waitForServer(
  url: string,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number },
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export function standaloneServerPath(
  resourcesPath: string,
  isPackaged: boolean,
  appRoot: string,
): string {
  return isPackaged
    ? path.join(resourcesPath, "standalone", "server.js")
    : path.join(appRoot, ".next", "standalone", "server.js");
}
