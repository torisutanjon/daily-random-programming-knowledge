/** @jest-environment node */
import nextConfig from "./next.config";

const byKey = (headers: { key: string; value: string }[]) =>
  [...headers].sort((a, b) => a.key.localeCompare(b.key));

describe("next.config", () => {
  it("disables X-Powered-By and keeps standalone output", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.output).toBe("standalone");
  });

  it("sets the static hardening headers on every path", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/:path*");
    expect(rule).toBeDefined();
    expect(byKey(rule!.headers)).toEqual(
      byKey([
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ]),
    );
  });

  it("sets only the API CSP on /api/:path*", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/api/:path*");
    expect(rule).toBeDefined();
    expect(rule!.headers).toEqual([
      { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
    ]);
  });

  it("sets no CSP on any path other than /api/:path*", async () => {
    const rules = await nextConfig.headers!();
    for (const rule of rules.filter((r) => r.source !== "/api/:path*")) {
      expect(rule.headers.map((h) => h.key)).not.toContain("Content-Security-Policy");
    }
  });
});
