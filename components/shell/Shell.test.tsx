import { render, screen, within } from "@testing-library/react";
import type { ShellData } from "@/lib/ui/shell";
import Shell from "@/components/shell/Shell";

jest.mock("next/navigation", () => ({ usePathname: jest.fn(() => "/") }));

function makeData(overrides: Partial<ShellData> = {}): ShellData {
  return {
    demo: true,
    today: { dayKey: "2026-10-08", term: "MVCC", progress: "3/10" },
    openCount: 2,
    nextWord: "Tomorrow at 09:00",
    unfinished: [
      { dayKey: "2026-10-08", term: "MVCC", when: "Today", progress: "3/10" },
      { dayKey: "2026-10-05", term: "CRDT", when: "Mon 5 Oct", progress: "1/8" },
    ],
    log: [
      { time: "09:34", label: "Partial", verdict: "partial", topic: "What an UPDATE really writes" },
      { time: "09:21", label: "Pass", verdict: "pass", topic: "Snapshots" },
    ],
    ...overrides,
  };
}

function renderShell(overrides: Partial<ShellData> = {}): ReturnType<typeof render> {
  return render(
    <Shell data={makeData(overrides)}>
      <p>child content</p>
    </Shell>,
  );
}

describe("Shell", () => {
  it("shows the drpk mark and the view title", () => {
    renderShell();
    expect(screen.getByText("drpk")).toBeInTheDocument();
    expect(screen.getByText("Today — MVCC")).toBeInTheDocument();
  });

  it("shows the demo badge only in demo mode", () => {
    const { rerender } = renderShell();
    expect(screen.getByText("DEMO MODE")).toBeInTheDocument();
    rerender(
      <Shell data={makeData({ demo: false })}>
        <p>child content</p>
      </Shell>,
    );
    expect(screen.queryByText("DEMO MODE")).toBeNull();
  });

  it("nav links carry counts", () => {
    const { rerender } = renderShell();
    const nav = screen.getByRole("navigation");
    const today = within(nav).getByRole("link", { name: /Today/ });
    expect(today).toHaveAttribute("href", "/");
    expect(today).toHaveTextContent("3/10");
    const backlog = within(nav).getByRole("link", { name: /Backlog/ });
    expect(backlog).toHaveAttribute("href", "/backlog");
    expect(backlog).toHaveTextContent("2 open");
    expect(within(nav).getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");

    rerender(
      <Shell data={makeData({ openCount: 0 })}>
        <p>child content</p>
      </Shell>,
    );
    const emptyBacklog = within(screen.getByRole("navigation")).getByRole("link", { name: /Backlog/ });
    expect(emptyBacklog).not.toHaveTextContent("open");
  });

  it("nav footer shows the next word", () => {
    renderShell();
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByText("Next word")).toBeInTheDocument();
    expect(within(nav).getByText("Tomorrow at 09:00")).toBeInTheDocument();
  });

  it("Unfinished lists words that link to their view", () => {
    renderShell();
    const region = screen.getByRole("region", { name: "Unfinished" });
    const crdt = within(region).getByRole("link", { name: /CRDT/ });
    expect(crdt).toHaveAttribute("href", "/word/2026-10-05");
    expect(crdt).toHaveTextContent("Mon 5 Oct");
    expect(crdt).toHaveTextContent("1/8");
    expect(within(region).getByRole("link", { name: /MVCC/ })).toHaveAttribute("href", "/");
  });

  it("Log lists today's attempts newest first", () => {
    renderShell();
    const region = screen.getByRole("region", { name: "Log" });
    const text = region.textContent ?? "";
    expect(region).toHaveTextContent("09:34");
    expect(region).toHaveTextContent("Partial");
    expect(region).toHaveTextContent("What an UPDATE really writes");
    expect(text.indexOf("09:34")).toBeLessThan(text.indexOf("09:21"));
  });

  it("empty states", () => {
    renderShell({ unfinished: [], log: [] });
    expect(screen.getByRole("region", { name: "Unfinished" })).toHaveTextContent("Nothing waiting.");
    expect(screen.getByRole("region", { name: "Log" })).toHaveTextContent("No answers yet today.");
  });

  it("renders children in the main column", () => {
    renderShell();
    expect(within(screen.getByRole("main")).getByText("child content")).toBeInTheDocument();
  });
});
