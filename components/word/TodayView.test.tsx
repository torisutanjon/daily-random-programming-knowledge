import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicWord } from "@/lib/domain/sanitize";
import TodayView from "@/components/word/TodayView";

const refresh = jest.fn();
const router = { refresh }; // stable identity, like the real Next router
jest.mock("next/navigation", () => ({ useRouter: () => router }));

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
      questions: [{ id: "q1", prompt: "P1", status: "unanswered", revealedAt: null, attempts: [] }],
    },
  ],
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

beforeEach(() => {
  refresh.mockClear();
  global.fetch = jest.fn() as jest.Mock;
});

describe("TodayView", () => {
  it("shows the generating state while pending", () => {
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    render(<TodayView dayKey="2026-10-08" demo={false} />);
    expect(screen.getByText("Creating today's word")).toBeInTheDocument();
    expect(screen.getByText("Thu 8 Oct 2026")).toBeInTheDocument();
  });

  it("shows the word on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, word));
    render(<TodayView dayKey="2026-10-08" demo={false} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Circuit breaker" })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/today");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the error card and Retry refetches", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse(502, errorBody("provider_unavailable", "Claude is unavailable right now — try again.")),
      )
      .mockResolvedValueOnce(jsonResponse(200, word));
    render(<TodayView dayKey="2026-10-08" demo={false} />);

    expect(await screen.findByText("Couldn't create today's word")).toBeInTheDocument();
    expect(screen.getByText("Claude is unavailable right now — try again.")).toBeInTheDocument();
    expect(screen.getByText("provider_unavailable")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Open Settings" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Circuit breaker" })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("offers Open Settings for invalid_key", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(502, errorBody("invalid_key", "Bad key.")));
    render(<TodayView dayKey="2026-10-08" demo={false} />);
    expect(await screen.findByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings");
  });

  it("reports a network failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("offline"));
    render(<TodayView dayKey="2026-10-08" demo={false} />);
    expect(await screen.findByText("Couldn't reach drpk — try again.")).toBeInTheDocument();
    expect(screen.getByText("network")).toBeInTheDocument();
  });

  it("shows the demo note only in demo mode", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, word));
    const { unmount } = render(<TodayView dayKey="2026-10-08" demo />);
    expect(await screen.findByText("Demo mode")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add an API key" })).toHaveAttribute("href", "/settings");
    unmount();

    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, word));
    render(<TodayView dayKey="2026-10-08" demo={false} />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Demo mode")).not.toBeInTheDocument();
  });
});
