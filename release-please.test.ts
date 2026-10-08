/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

const read = (...p: string[]): string => fs.readFileSync(path.join(__dirname, ...p), "utf8");

describe("release-please", () => {
  it("workflow runs on main with the v4 action and write permissions", () => {
    const wf = read(".github", "workflows", "release-please.yml");
    expect(wf).toMatch(/branches:\s*\n\s*-\s*main/);
    expect(wf).toContain("uses: googleapis/release-please-action@v4");
    expect(wf).toContain("contents: write");
    expect(wf).toContain("issues: write");
    expect(wf).toContain("pull-requests: write");
  });

  it("release PRs target main, not the default branch", () => {
    expect(read(".github", "workflows", "release-please.yml")).toMatch(/with:\s*\n\s*target-branch:\s*main/);
  });

  it("config uses the node release type", () => {
    const cfg = JSON.parse(read("release-please-config.json"));
    expect(cfg.packages["."]["release-type"]).toBe("node");
  });

  it("tags without the component (vX.Y.Z, not drpk-vX.Y.Z)", () => {
    const cfg = JSON.parse(read("release-please-config.json"));
    expect(cfg.packages["."]["include-component-in-tag"]).toBe(false);
  });

  it("manifest matches package.json version", () => {
    const manifest = JSON.parse(read(".release-please-manifest.json"));
    const pkg = JSON.parse(read("package.json"));
    expect(manifest["."]).toBe(pkg.version);
  });
});
