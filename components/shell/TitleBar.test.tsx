import type { ShellData } from "@/lib/ui/shell";
import { viewTitle } from "@/components/shell/TitleBar";

jest.mock("next/navigation", () => ({ usePathname: jest.fn(() => "/") }));

function makeData(term: string | null = "MVCC"): ShellData {
  return {
    demo: false,
    today: { dayKey: "2026-10-08", term, progress: "" },
    openCount: 1,
    nextWord: "",
    unfinished: [{ dayKey: "2026-10-05", term: "CRDT", when: "Mon 5 Oct", progress: "1/8" }],
    log: [],
  };
}

describe("viewTitle", () => {
  it("titles Today with the term", () => {
    expect(viewTitle("/", makeData("MVCC"))).toBe("Today — MVCC");
  });

  it("titles Today without a term", () => {
    expect(viewTitle("/", makeData(null))).toBe("Today");
  });

  it("titles static views", () => {
    expect(viewTitle("/backlog", makeData())).toBe("Backlog");
    expect(viewTitle("/settings", makeData())).toBe("Settings");
  });

  it("titles a word by its term, falling back to Word", () => {
    expect(viewTitle("/word/2026-10-05", makeData())).toBe("CRDT");
    expect(viewTitle("/word/2026-01-01", makeData())).toBe("Word");
  });
});
