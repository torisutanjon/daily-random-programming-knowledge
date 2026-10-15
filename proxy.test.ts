/** @jest-environment node */
import { NextRequest } from "next/server";
import { buildCsp, config, proxy } from "./proxy";

const NONCE_RE = /'nonce-([A-Za-z0-9+/=]+)'/;
const csp = (): string =>
  proxy(new NextRequest("http://127.0.0.1:3000/")).headers.get("Content-Security-Policy") ?? "";

describe("buildCsp", () => {
  it("builds the strict production policy", () => {
    const p = buildCsp("abc", false);
    for (const d of [
      "default-src 'self'",
      "script-src 'self' 'nonce-abc' 'strict-dynamic'",
      "style-src 'self' 'nonce-abc'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(p).toContain(d);
    }
    expect(p).not.toContain("unsafe-inline");
    expect(p).not.toContain("unsafe-eval");
    expect(p).not.toContain("upgrade-insecure-requests");
    expect(p).not.toMatch(/\n|  /);
  });

  it("relaxes script and style in dev only", () => {
    const p = buildCsp("abc", true);
    expect(p).toMatch(/script-src [^;]*'unsafe-eval'/);
    expect(p).toContain("style-src 'self' 'unsafe-inline'");
    expect(p).not.toContain("upgrade-insecure-requests");
  });
});

describe("proxy", () => {
  it("sets a nonce CSP without unsafe-inline", () => {
    const p = csp();
    expect(p).toMatch(NONCE_RE);
    expect(p).not.toContain("unsafe-inline");
  });

  it("uses a fresh nonce per request", () => {
    expect(csp().match(NONCE_RE)?.[1]).not.toBe(csp().match(NONCE_RE)?.[1]);
  });

  it("matches pages and skips prefetches", () => {
    const m = config.matcher[0];
    expect(m.source).toBe("/((?!api|_next/static|_next/image|favicon.ico).*)");
    expect(m.missing).toContainEqual({ type: "header", key: "next-router-prefetch" });
    expect(m.missing).toContainEqual({ type: "header", key: "purpose", value: "prefetch" });
  });
});
