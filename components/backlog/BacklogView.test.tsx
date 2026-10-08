import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BacklogView from "@/components/backlog/BacklogView";
import { AREAS } from "@/lib/domain/areas";
import type { BacklogData, BacklogRow } from "@/lib/ui/backlog";

const A: BacklogRow = {
  dayKey: "2026-10-07",
  term: "Backpressure",
  date: "Wed 7 Oct",
  area: "Node runtime",
  level: "mid-senior",
  status: "in-progress",
  segments: ["learned", "unanswered"],
  progress: "1/2",
};
const B: BacklogRow = {
  dayKey: "2026-10-06",
  term: "React reconciliation",
  date: "Tue 6 Oct",
  area: "React internals",
  level: "mid",
  status: "learned",
  segments: ["learned", "revealed"],
  progress: "2/2",
};
const C: BacklogRow = {
  dayKey: "2026-10-05",
  term: "Idempotency keys",
  date: "Mon 5 Oct",
  area: "GraphQL & API design",
  level: "mid-senior",
  status: "unanswered",
  segments: ["unanswered", "unanswered"],
  progress: "0/2",
};

function makeData(overrides: Partial<BacklogData> = {}): BacklogData {
  return {
    rows: [A, B, C],
    coverage: AREAS.map((a) => ({
      area: a.id,
      label: a.label,
      count: a.id === "node-runtime" ? 2 : a.id === "react-internals" ? 1 : 0,
      enabled: a.id !== "cicd-devops",
      percent: a.id === "node-runtime" ? 100 : a.id === "react-internals" ? 50 : 0,
    })),
    covered: 2,
    ...overrides,
  };
}

describe("BacklogView", () => {
  it("shows the heading and subtitle", () => {
    render(<BacklogView data={makeData()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Backlog" })).toBeInTheDocument();
    expect(
      screen.getByText("Every past word. Unfinished ones wait here — nothing is lost."),
    ).toBeInTheDocument();
  });

  it("defaults to In progress", () => {
    render(<BacklogView data={makeData()} />);
    expect(screen.getByRole("button", { name: "In progress" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("link", { name: /Backpressure/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Idempotency keys/ })).toBeInTheDocument();
    expect(screen.queryByText("React reconciliation")).not.toBeInTheDocument();
  });

  it("filters Learned and All", async () => {
    const user = userEvent.setup();
    render(<BacklogView data={makeData()} />);

    await user.click(screen.getByRole("button", { name: "Learned" }));
    expect(screen.getByRole("button", { name: "Learned" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("React reconciliation")).toBeInTheDocument();
    expect(screen.queryByText("Backpressure")).not.toBeInTheDocument();
    expect(screen.queryByText("Idempotency keys")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Backpressure")).toBeInTheDocument();
    expect(screen.getByText("React reconciliation")).toBeInTheDocument();
    expect(screen.getByText("Idempotency keys")).toBeInTheDocument();
  });

  it("rows open the word view and show progress", () => {
    render(<BacklogView data={makeData()} />);
    const link = screen.getByRole("link", { name: /Backpressure/ });
    expect(link).toHaveAttribute("href", "/word/2026-10-07");
    expect(link).toHaveTextContent("Wed 7 Oct");
    expect(link).toHaveTextContent("Node runtime · mid-senior");
    expect(link).toHaveTextContent("1/2");

    const segments = link.querySelectorAll("[data-segment]");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveAttribute("data-status", "learned");
    expect(segments[1]).toHaveAttribute("data-status", "unanswered");
    expect(link.querySelector('[data-status="in-progress"]')).not.toBeNull();
  });

  it("coverage lists 16 areas and dims disabled ones", () => {
    const { container } = render(<BacklogView data={makeData()} />);
    const region = screen.getByRole("region", { name: "Coverage" });
    expect(within(region).getByText(/2 of 16 areas/)).toBeInTheDocument();
    expect(
      within(region).getByText("Faded areas are switched off in Settings."),
    ).toBeInTheDocument();

    expect(container.querySelectorAll("[data-area]")).toHaveLength(16);
    expect(container.querySelector('[data-area="cicd-devops"]')).toHaveAttribute(
      "data-enabled",
      "false",
    );

    const node = container.querySelector('[data-area="node-runtime"]');
    expect(node).toHaveTextContent("2");
    expect(node?.querySelector("[data-bar]")).toHaveStyle({ width: "100%" });
    expect(
      container.querySelector('[data-area="react-internals"] [data-bar]'),
    ).toHaveStyle({ width: "50%" });
  });

  it("first day empty state", () => {
    render(<BacklogView data={makeData({ rows: [] })} />);
    expect(screen.getByText("Your first day")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Past words will collect here. If you don't finish today's word, it moves here tomorrow and waits for you.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("empty filter state", async () => {
    const user = userEvent.setup();
    render(<BacklogView data={makeData({ rows: [B] })} />);
    expect(screen.getByText("Nothing in this view")).toBeInTheDocument();
    expect(screen.getByText("Try another filter.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("React reconciliation")).toBeInTheDocument();
  });

  it("labels the row status for screen readers", () => {
    render(<BacklogView data={makeData()} />);
    expect(screen.getByRole("link", { name: /Backpressure/ })).toHaveAccessibleName(/In progress/);
  });

  it("groups the filter buttons under a label", () => {
    render(<BacklogView data={makeData()} />);
    const group = screen.getByRole("group", { name: "Filter" });
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });
});
