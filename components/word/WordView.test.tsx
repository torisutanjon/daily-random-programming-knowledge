import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicWord } from "@/lib/domain/sanitize";
import WordView from "@/components/word/WordView";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const pass = {
  answer: "a",
  verdict: "pass" as const,
  feedback: "Good.",
  at: "2026-10-08T13:00:00.000Z",
};
const word: PublicWord = {
  dayKey: "2026-10-08",
  term: "Circuit breaker",
  subtitle: "Fail fast",
  area: "system-design",
  level: "mid-senior",
  provider: "fake",
  createdAt: "2026-10-08T12:00:00.000Z",
  topics: [
    {
      id: "t1",
      title: "Three states",
      questions: [{ id: "q1", prompt: "P1", status: "learned", revealedAt: null, attempts: [pass] }],
    },
    {
      id: "t2",
      title: "Breakers vs retries",
      questions: [{ id: "q2", prompt: "P2", status: "unanswered", revealedAt: null, attempts: [] }],
    },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn() as jest.Mock;
  refresh.mockClear();
});

function topicButton(title: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(title) });
}

describe("WordView", () => {
  it("shows the header", () => {
    render(<WordView word={word} from="today" />);
    expect(screen.getByText("Thu 8 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Circuit breaker");
    expect(screen.getByText("Fail fast")).toBeInTheDocument();
    expect(screen.getByText("System design")).toBeInTheDocument();
    expect(screen.getByText("mid-senior")).toBeInTheDocument();
    expect(screen.getByText("1/2 learned")).toBeInTheDocument();
  });

  it("renders one progress segment per question", () => {
    const { container } = render(<WordView word={word} from="today" />);
    const segs = container.querySelectorAll("[data-segment]");
    expect([...segs].map((s) => s.getAttribute("data-status"))).toEqual(["learned", "unanswered"]);
  });

  it("topic rows expand and collapse, first not-done starts open", async () => {
    const user = userEvent.setup();
    render(<WordView word={word} from="today" />);
    expect(topicButton("Three states")).toHaveAttribute("aria-expanded", "false");
    expect(topicButton("Breakers vs retries")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("P1")).not.toBeVisible();

    await user.click(topicButton("Three states"));
    expect(topicButton("Three states")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("P1")).toBeInTheDocument();
  });

  it("keeps a typed draft across collapse and expand", async () => {
    const user = userEvent.setup();
    render(<WordView word={word} from="today" />);
    await user.type(screen.getByRole("textbox"), "half written");
    await user.click(topicButton("Breakers vs retries"));
    await user.click(topicButton("Breakers vs retries"));
    expect(screen.getByRole("textbox")).toHaveValue("half written");
  });

  it("topic icons reflect topic status", () => {
    render(<WordView word={word} from="today" />);
    expect(topicButton("Three states").querySelector("[data-status]")).toHaveAttribute("data-status", "learned");
    expect(topicButton("Breakers vs retries").querySelector("[data-status]")).toHaveAttribute(
      "data-status",
      "unanswered",
    );
  });

  it("crumb differs by origin", () => {
    const { rerender } = render(<WordView word={word} from="today" />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "← Backlog" })).not.toBeInTheDocument();
    rerender(<WordView word={word} from="backlog" />);
    expect(screen.getByRole("link", { name: "← Backlog" })).toHaveAttribute("href", "/backlog");
  });

  it("auto-ticks a topic when its question is learned", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "q2",
        prompt: "P2",
        status: "learned",
        revealedAt: null,
        attempts: [pass],
      }),
    });
    render(<WordView word={word} from="today" />);
    await user.type(screen.getByRole("textbox"), "answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("2/2 learned")).toBeInTheDocument();
    expect(topicButton("Breakers vs retries").querySelector("[data-status]")).toHaveAttribute(
      "data-status",
      "learned",
    );
  });

  it("renders notice before the heading", () => {
    render(<WordView word={word} from="today" notice={<p>hello</p>} />);
    const notice = screen.getByText("hello");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(notice.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
