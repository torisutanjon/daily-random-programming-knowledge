/** @jest-environment node */

import { spawnSync } from "node:child_process";

it("rejects hex in string literal", () => {
  const input = 'export const c = "bg-[#1f1f22]";';
  const result = spawnSync("node_modules/.bin/eslint", ["--stdin", "--stdin-filename", "app/sample.tsx"], {
    input,
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("no-restricted-syntax");
}, 30000);

it("rejects hex in template literal", () => {
  const input = "export const c = `#abc`;";
  const result = spawnSync("node_modules/.bin/eslint", ["--stdin", "--stdin-filename", "app/sample.tsx"], {
    input,
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("no-restricted-syntax");
}, 30000);

it("accepts tailwind token", () => {
  const input = 'export const c = "bg-canvas";';
  const result = spawnSync("node_modules/.bin/eslint", ["--stdin", "--stdin-filename", "app/sample.tsx"], {
    input,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
}, 30000);
