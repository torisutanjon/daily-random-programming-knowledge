import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SettingsView from "@/components/settings/SettingsView";
import { AREA_IDS, AREAS } from "@/lib/domain/areas";
import type { PublicSettings } from "@/lib/domain/settings";

const refresh = jest.fn();
const router = { refresh };
jest.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const initial: PublicSettings = {
  notifyTime: "09:00",
  level: "mid-senior",
  areas: [...AREA_IDS],
  stackProfile: ["React", "Jest"],
  model: "claude-opus-5-5",
  launchAtLogin: true,
  hasApiKey: false,
};

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: async () => body,
});

const fetchMock = (): jest.Mock => global.fetch as unknown as jest.Mock;

function puts(): unknown[] {
  return fetchMock().mock.calls.filter(
    ([url, init]) => url === "/api/settings" && init?.method === "PUT",
  );
}
function lastPut(): unknown {
  const calls = puts() as [string, { body: string }][];
  return JSON.parse(calls[calls.length - 1][1].body);
}

beforeEach(() => {
  refresh.mockClear();
  global.fetch = jest.fn();
});

describe("SettingsView", () => {
  it("notify time saves on change", async () => {
    fetchMock().mockResolvedValue(ok({ ...initial, notifyTime: "07:30" }));
    render(<SettingsView initial={initial} />);
    fireEvent.change(screen.getByLabelText("Notify time"), {
      target: { value: "07:30" },
    });
    fireEvent.blur(screen.getByLabelText("Notify time"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(lastPut()).toEqual({ notifyTime: "07:30" });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("level saves", async () => {
    fetchMock().mockResolvedValue(ok({ ...initial, level: "senior" }));
    render(<SettingsView initial={initial} />);
    await userEvent.click(screen.getByRole("button", { name: "senior" }));
    expect(lastPut()).toEqual({ level: "senior" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "senior" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("toggling an area saves the new list", async () => {
    const areas = AREA_IDS.filter((id) => id !== "security");
    fetchMock().mockResolvedValue(ok({ ...initial, areas }));
    render(<SettingsView initial={initial} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Security" }));
    expect(lastPut()).toEqual({ areas });
    expect(await screen.findByText(/15 of 16/)).toBeInTheDocument();
    expect(AREAS).toHaveLength(16);
  });

  it("the last area can't be unchecked", () => {
    render(<SettingsView initial={{ ...initial, areas: ["security"] }} />);
    const box = screen.getByRole("checkbox", { name: "Security" });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByText("At least one area stays on.")).toBeInTheDocument();
  });

  it("stack tags add and remove", async () => {
    const added = { ...initial, stackProfile: ["React", "Jest", "Node.js"] };
    fetchMock().mockResolvedValueOnce(ok(added));
    render(<SettingsView initial={initial} />);
    const input = screen.getByPlaceholderText("Add… ⏎");

    await userEvent.type(input, "  Node.js  {Enter}");
    expect(lastPut()).toEqual({ stackProfile: ["React", "Jest", "Node.js"] });
    await screen.findByRole("button", { name: "Remove Node.js" });
    expect(puts()).toHaveLength(1);

    await userEvent.type(input, "react{Enter}");
    expect(puts()).toHaveLength(1);

    fetchMock().mockResolvedValueOnce(
      ok({ ...added, stackProfile: ["React", "Node.js"] }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove Jest" }));
    expect(lastPut()).toEqual({ stackProfile: ["React", "Node.js"] });
  });

  it("save key sends it once and clears the input", async () => {
    fetchMock().mockResolvedValue(ok({ ...initial, hasApiKey: true }));
    render(<SettingsView initial={initial} />);
    const input = screen.getByLabelText("API key");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.type(input, "sk-ant-test-123");
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(lastPut()).toEqual({ apiKey: "sk-ant-test-123" });
    await waitFor(() => expect(input).toHaveValue(""));
    expect(screen.getByText("A key is saved.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("sk-ant-test-123");
  });

  it("remove key", async () => {
    fetchMock().mockResolvedValue(ok({ ...initial, hasApiKey: false }));
    render(<SettingsView initial={{ ...initial, hasApiKey: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove key" }));
    expect(lastPut()).toEqual({ apiKey: null });
    expect(
      await screen.findByText("No key — the app runs in demo mode."),
    ).toBeInTheDocument();
  });

  it("test key ok", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock().mockReturnValue(new Promise((r) => (resolve = r)));
    render(<SettingsView initial={initial} />);
    await userEvent.type(screen.getByLabelText("API key"), "sk-ant-abc");
    await userEvent.click(screen.getByRole("button", { name: "Test key" }));
    expect(fetchMock()).toHaveBeenCalledWith(
      "/api/settings/test-key",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock().mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ apiKey: "sk-ant-abc" });
    expect(screen.getByText(/Testing…/)).toBeInTheDocument();
    resolve(ok({ ok: true }));
    expect(await screen.findByText(/Key works/)).toBeInTheDocument();
  });

  it("test key invalid_key", async () => {
    fetchMock().mockResolvedValue(
      fail(502, { error: { code: "invalid_key", message: "x" } }),
    );
    render(<SettingsView initial={initial} />);
    await userEvent.type(screen.getByLabelText("API key"), "sk-ant-bad");
    await userEvent.click(screen.getByRole("button", { name: "Test key" }));
    expect(
      await screen.findByText("Key rejected. Check it was copied in full."),
    ).toBeInTheDocument();
  });

  it("test key with no typed key tests the saved one", async () => {
    fetchMock().mockResolvedValue(ok({ ok: true }));
    render(<SettingsView initial={{ ...initial, hasApiKey: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Test key" }));
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe("/api/settings/test-key");
    expect(init.method).toBe("POST");
    const body = init.body ? JSON.parse(init.body) : {};
    expect(body.apiKey).toBeUndefined();
  });

  it("model saves", async () => {
    fetchMock().mockResolvedValue(
      ok({ ...initial, model: "claude-sonnet-5-5" }),
    );
    render(<SettingsView initial={initial} />);
    const select = screen.getByLabelText("Model");
    const values = Array.from(
      select.querySelectorAll("option"),
      (o) => o.value,
    );
    expect(values).toEqual([
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-fable-5-1",
    ]);
    expect(values.some((v) => v.includes("haiku"))).toBe(false);
    await userEvent.selectOptions(select, "claude-sonnet-5-5");
    expect(lastPut()).toEqual({ model: "claude-sonnet-5-5" });
  });

  it("launch at login switch", async () => {
    fetchMock().mockResolvedValue(ok({ ...initial, launchAtLogin: false }));
    render(<SettingsView initial={initial} />);
    const sw = screen.getByRole("switch", { name: "Launch at login" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(lastPut()).toEqual({ launchAtLogin: false });
  });

  it("a failed save reverts and says so", async () => {
    fetchMock().mockResolvedValue(
      fail(500, { error: { code: "internal", message: "x" } }),
    );
    render(<SettingsView initial={initial} />);
    await userEvent.click(screen.getByRole("button", { name: "senior" }));
    expect(
      await screen.findByText("Couldn't save — your change was undone."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mid-senior" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("two quick toggles both persist in order", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    fetchMock().mockImplementation(
      () => new Promise((r) => resolvers.push(r)),
    );
    render(<SettingsView initial={initial} />);
    const afterFirst = AREA_IDS.filter((id) => id !== "security");
    const afterSecond = afterFirst.filter((id) => id !== "nextjs");
    await userEvent.click(screen.getByRole("checkbox", { name: "Security" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Next.js" }));
    expect(puts()).toHaveLength(1); // second PUT waits for the first
    resolvers[0](ok({ ...initial, areas: afterFirst }));
    await waitFor(() => expect(puts()).toHaveLength(2));
    resolvers[1](ok({ ...initial, areas: afterSecond }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    const bodies = (puts() as [string, { body: string }][]).map(([, i]) =>
      JSON.parse(i.body),
    );
    expect(bodies).toEqual([{ areas: afterFirst }, { areas: afterSecond }]);
  });

  it("a saved model outside the list is shown", () => {
    render(<SettingsView initial={{ ...initial, model: "claude-opus-4-8" }} />);
    const select = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(select.value).toBe("claude-opus-4-8");
    expect(
      Array.from(select.options, (o) => o.value),
    ).toContain("claude-opus-4-8");
  });

  it("a failed key save keeps the typed key", async () => {
    fetchMock().mockResolvedValue(
      fail(500, { error: { code: "internal", message: "x" } }),
    );
    render(<SettingsView initial={initial} />);
    const input = screen.getByLabelText("API key");
    await userEvent.type(input, "sk-ant-test-123");
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(
      await screen.findByText("Couldn't save — your change was undone."),
    ).toBeInTheDocument();
    expect(input).toHaveValue("sk-ant-test-123");
  });

  it("removing the key clears a stale test result", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        fail(502, { error: { code: "invalid_key", message: "x" } }),
      )
      .mockResolvedValueOnce(ok({ ...initial, hasApiKey: false }));
    render(<SettingsView initial={{ ...initial, hasApiKey: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Test key" }));
    await screen.findByText("Key rejected. Check it was copied in full.");
    await userEvent.click(screen.getByRole("button", { name: "Remove key" }));
    await screen.findByText("No key — the app runs in demo mode.");
    expect(
      screen.queryByText("Key rejected. Check it was copied in full."),
    ).not.toBeInTheDocument();
  });

  it("a response doesn't overwrite edits still queued", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    fetchMock().mockImplementation(
      () => new Promise((r) => resolvers.push(r)),
    );
    render(<SettingsView initial={initial} />);
    const a1 = AREA_IDS.filter((id) => id !== "security");
    const a2 = a1.filter((id) => id !== "nextjs");
    await userEvent.click(screen.getByRole("checkbox", { name: "Security" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Next.js" }));
    resolvers[0](ok({ ...initial, areas: a1 }));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(screen.getByRole("checkbox", { name: "Next.js" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Observability" }));
    resolvers[1](ok({ ...initial, areas: a2 }));
    await waitFor(() => expect(puts()).toHaveLength(3));
    expect(lastPut()).toEqual({
      areas: a2.filter((id) => id !== "observability"),
    });
  });

  it("a failed save drops the saves queued behind it", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    fetchMock().mockImplementation(
      () => new Promise((r) => resolvers.push(r)),
    );
    render(<SettingsView initial={initial} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Security" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Next.js" }));
    resolvers[0](fail(500, { error: { code: "internal", message: "x" } }));
    expect(
      await screen.findByText("Couldn't save — your change was undone."),
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(puts()).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Security" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Next.js" })).toBeChecked();
  });

  it("notify time doesn't save until blur", async () => {
    render(<SettingsView initial={initial} />);
    fireEvent.change(screen.getByLabelText("Notify time"), {
      target: { value: "07:30" },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(puts()).toHaveLength(0);
  });

  it("changing the key input clears a stale test result", async () => {
    fetchMock().mockResolvedValue(
      fail(502, { error: { code: "invalid_key", message: "x" } }),
    );
    render(<SettingsView initial={initial} />);
    const input = screen.getByLabelText("API key");
    await userEvent.type(input, "sk-ant-bad");
    await userEvent.click(screen.getByRole("button", { name: "Test key" }));
    await screen.findByText("Key rejected. Check it was copied in full.");
    await userEvent.type(input, "x");
    expect(
      screen.queryByText("Key rejected. Check it was copied in full."),
    ).not.toBeInTheDocument();
  });
});
