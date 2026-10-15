/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";

const readme = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");

describe("README", () => {
  it("embeds the three screenshots and each file exists", () => {
    for (const name of ["today", "backlog", "settings"]) {
      const rel = `docs/screenshots/${name}.png`;
      expect(readme).toContain(`(${rel})`);
      expect(fs.existsSync(path.join(__dirname, rel))).toBe(true);
    }
  });

  it("shows the CI and release badges", () => {
    expect(readme).toContain("actions/workflows/ci.yml/badge.svg");
    expect(readme).toContain("img.shields.io/github/v/release/torisutanjon/daily-random-programming-knowledge");
  });

  it("contains no path from the author's machine", () => {
    expect(readme).not.toMatch(/clarisfanhere|C:\\Users\\Acer/);
  });
});
