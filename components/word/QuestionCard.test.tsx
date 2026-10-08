import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicQuestion } from "@/lib/domain/sanitize";
import QuestionCard from "@/components/word/QuestionCard";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const DAY = "2026-10-08";
const base: PublicQuestion = {
  id: "q1",
  prompt: "Describe closed, open and half-open.",
  status: "unanswered",
  revealedAt: null,
  attempts: [],
};
const attempt1 = {
  answer: "short",
  verdict: "fail",
  feedback: "Name the three states.",
  at: "2026-10-08T13:00:00.000Z",
};
const attempt2 = {
  answer: "closed open half-open with thresholds",
  verdict: "partial",
  feedback: "Say what moves it between states.",
  at: "2026-10-08T13:05:00.000Z",
};
const revealed = {
  ...base,
  status: "revealed",
  revealedAt: "2026-10-08T13:10:00.000Z",
  modelAnswer: "Closed passes calls; open fails fast; half-open probes.",
  rubric: ["Three states", "Failure threshold", "Probe on half-open"],
  attempts: [attempt1, attempt2],
} as PublicQuestion;

function Harness({ initial }: { initial: PublicQuestion }) {
  const [question, setQuestion] = useState(initial);
  return (
    <QuestionCard
      dayKey={DAY}
      question={question}
      index={0}
      onChange={setQuestion}
    />
  );
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function lastBody(path: string): unknown {
  const call = (global.fetch as jest.Mock).mock.calls.find(
    ([url]) => url === path,
  );
  expect(call).toBeDefined();
  expect(call![1].method).toBe("POST");
  return JSON.parse(call![1].body as string);
}

beforeEach(() => {
  global.fetch = jest.fn() as jest.Mock;
  refresh.mockClear();
});

describe("QuestionCard", () => {
  it("answer → feedback → retry → reveal", async () => {
    const user = userEvent.setup();
    const afterFirst = { ...base, attempts: [attempt1] };
    const afterSecond = {
      ...base,
      status: "partial",
      attempts: [attempt1, attempt2],
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(200, afterFirst))
      .mockResolvedValueOnce(jsonResponse(200, afterSecond))
      .mockResolvedValueOnce(jsonResponse(200, revealed));

    render(<Harness initial={base} />);
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(
      screen.getByText("Describe closed, open and half-open."),
    ).toBeInTheDocument();
    expect(screen.getByText("Unanswered")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "short");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/answer",
      expect.objectContaining({ method: "POST" }),
    );
    expect(lastBody("/api/answer")).toEqual({
      dayKey: DAY,
      questionId: "q1",
      answer: "short",
    });
    expect(
      await screen.findByText("Name the three states."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not yet")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(refresh).toHaveBeenCalled();

    await user.type(
      screen.getByRole("textbox"),
      "closed open half-open with thresholds",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText("Say what moves it between states."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Partial").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Reveal answer" }));
    const group = screen.getByRole("group", { name: "Confirm reveal" });
    expect(
      within(group).getByText(/marked revealed rather than learned/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reveal answer" })).toHaveLength(
      1,
    );
    expect(
      within(group).getByRole("button", { name: "Reveal answer" }),
    ).toBeInTheDocument();

    await user.click(
      within(group).getByRole("button", { name: "Reveal answer" }),
    );
    expect(lastBody("/api/reveal")).toEqual({ dayKey: DAY, questionId: "q1" });
    expect(
      await screen.findByText(
        "Closed passes calls; open fails fast; half-open probes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Failure threshold")).toBeInTheDocument();
    expect(screen.getAllByText("Revealed").length).toBeGreaterThan(0);
  });

  it("grading failure keeps the answer", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(502, { error: { code: "grading_failed", message: "x" } }),
    );

    render(<Harness initial={base} />);
    await user.type(screen.getByRole("textbox"), "my answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(
        "Couldn't grade — try again. Your answer is still here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("my answer");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Keep trying closes the confirm", async () => {
    const user = userEvent.setup();
    render(<Harness initial={base} />);

    await user.click(screen.getByRole("button", { name: "Reveal answer" }));
    const group = screen.getByRole("group", { name: "Confirm reveal" });
    await user.click(within(group).getByRole("button", { name: "Keep trying" }));

    expect(
      screen.queryByRole("group", { name: "Confirm reveal" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("learned question offers Answer again", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...base,
          status: "learned",
          attempts: [
            {
              answer: "a",
              verdict: "pass",
              feedback: "Good.",
              at: "2026-10-08T13:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Answer again" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("revealed question offers own words anyway", async () => {
    const user = userEvent.setup();
    render(<Harness initial={revealed} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reveal answer" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Write it in your own words anyway" }),
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("submit is disabled while grading", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

    render(<Harness initial={base} />);
    await user.type(screen.getByRole("textbox"), "my answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const busy = screen.getByRole("button", { name: "Checking…" });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("network failure keeps the answer", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("offline"));

    render(<Harness initial={base} />);
    await user.type(screen.getByRole("textbox"), "my answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(
        "Couldn't grade — try again. Your answer is still here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("my answer");
  });

  it("reveal is sent once on double click", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<Harness initial={base} />);
    await user.click(screen.getByRole("button", { name: "Reveal answer" }));
    const confirm = within(
      screen.getByRole("group", { name: "Confirm reveal" }),
    ).getByRole("button", { name: "Reveal answer" });
    await user.dblClick(confirm);

    const calls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/reveal",
    );
    expect(calls).toHaveLength(1);
  });
});
