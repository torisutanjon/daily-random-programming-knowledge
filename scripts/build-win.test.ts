/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";

const script = readFileSync(path.join(__dirname, "build-win.ps1"), "utf8");

describe("build-win.ps1", () => {
  it("clears dist and dist-electron under $Dest before building", () => {
    const clear = script.search(/foreach \(\$dir in "dist", "dist-electron"\)/);
    const build = script.indexOf("corepack yarn dist");
    expect(clear).toBeGreaterThan(-1);
    expect(clear).toBeLessThan(build);
    expect(script).toMatch(/Join-Path \$Dest \$dir/);
    expect(script).toMatch(/Remove-Item -LiteralPath \$path -Recurse -Force -ErrorAction Stop/);
  });

  it("stops with a clear message when the delete fails", () => {
    expect(script).toMatch(/throw "Could not clear \$path/);
  });
});
