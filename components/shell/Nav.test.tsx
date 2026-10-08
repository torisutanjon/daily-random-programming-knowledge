import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/ui/shell";
import Nav from "@/components/shell/Nav";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));

const data: ShellData = {
  demo: false,
  today: { dayKey: "2026-10-08", term: "MVCC", progress: "3/10" },
  openCount: 2,
  nextWord: "Tomorrow at 09:00",
  unfinished: [],
  log: [],
};

function activeLinks(pathname: string): string[] {
  jest.mocked(usePathname).mockReturnValue(pathname);
  render(<Nav data={data} />);
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.getAttribute("href") ?? "");
}

describe("Nav active row", () => {
  it.each([
    ["/", "/"],
    ["/backlog", "/backlog"],
    ["/word/2026-10-05", "/backlog"],
    ["/settings", "/settings"],
  ])("%s marks %s", (pathname, href) => {
    expect(activeLinks(pathname)).toEqual([href]);
  });
});
