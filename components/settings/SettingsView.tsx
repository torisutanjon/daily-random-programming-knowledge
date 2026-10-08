"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AREAS } from "@/lib/domain/areas";
import type { PublicSettings } from "@/lib/domain/settings";
import type { Level } from "@/lib/domain/types";

type Patch = Partial<Omit<PublicSettings, "hasApiKey">> | { apiKey: string | null };
type KeyTest =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; ms: number }
  | { kind: "error"; message: string };

const LEVELS: Level[] = ["mid", "mid-senior", "senior"];
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY_ERRORS: Record<string, string> = {
  invalid_key: "Key rejected. Check it was copied in full.",
  provider_rejected: "The model was rejected — pick another model.",
  no_key: "Add an API key first.",
};

const INPUT =
  "rounded-md border border-field-line bg-panel text-ink px-2.5 py-[7px] font-mono [color-scheme:dark]";
const BUTTON =
  "border border-control-line bg-active text-ink rounded-md px-3.5 py-2 text-[13px] font-medium";

function Section({ title }: { title: string }): React.JSX.Element {
  return (
    <h2 className="mt-9 border-b border-line pb-2 text-xs tracking-[.08em] text-ink-faint uppercase first:mt-0">
      {title}
    </h2>
  );
}

function Row({
  title,
  help,
  children,
  stacked = false,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
  stacked?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`border-b border-hover py-[18px] ${stacked ? "" : "flex items-center gap-6"}`}
    >
      <div className="flex-1">
        <div className="text-[15px] text-ink-strong">{title}</div>
        <div className="mt-[3px] text-[13px] text-ink-soft">{help}</div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsView({ initial }: { initial: PublicSettings }): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState<PublicSettings>(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [newTag, setNewTag] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keyTest, setKeyTest] = useState<KeyTest>({ kind: "idle" });
  const savedRef = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function save(patch: Patch): void {
    if (!("apiKey" in patch)) setDraft((d) => ({ ...d, ...patch }));
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as PublicSettings;
        savedRef.current = next;
        setDraft(next);
        setStatus("saved");
        router.refresh();
      } catch {
        setDraft(savedRef.current);
        setStatus("error");
      }
    });
  }

  function addTag(): void {
    const tag = newTag.trim();
    setNewTag("");
    if (!tag || tag.length > 40) return;
    if (draft.stackProfile.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    save({ stackProfile: [...draft.stackProfile, tag] });
  }

  function toggleArea(id: (typeof AREAS)[number]["id"]): void {
    const on = draft.areas.includes(id);
    if (on && draft.areas.length === 1) return;
    save({
      areas: AREAS.map((a) => a.id).filter((a) => (a === id ? !on : draft.areas.includes(a))),
    });
  }

  function saveKey(): void {
    const apiKey = keyInput;
    setKeyInput("");
    save({ apiKey });
  }

  async function testKey(): Promise<void> {
    setKeyTest({ kind: "testing" });
    const started = performance.now();
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(keyInput ? { apiKey: keyInput } : {}),
      });
      if (res.ok) {
        setKeyTest({ kind: "ok", ms: performance.now() - started });
        return;
      }
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      const code = body.error?.code ?? "";
      setKeyTest({
        kind: "error",
        message: KEY_ERRORS[code] ?? body.error?.message ?? "Couldn't reach drpk — try again.",
      });
    } catch {
      setKeyTest({ kind: "error", message: "Couldn't reach drpk — try again." });
    }
  }

  const models = MODELS.includes(draft.model) ? MODELS : [...MODELS, draft.model];
  const lastArea = draft.areas.length === 1 ? draft.areas[0] : null;

  return (
    <div className="mx-auto max-w-[760px] px-10 pt-12 pb-[100px]">
      <h1 className="text-[32px] font-semibold tracking-[-0.01em] text-ink-bright">Settings</h1>
      <p aria-live="polite" className={`mt-2 mb-5 min-h-5 text-[13px] ${status === "error" ? "text-fail" : "text-ink-soft"}`}>
        {status === "saved" && "Saved"}
        {status === "error" && "Couldn't save — your change was undone."}
      </p>

      <Section title="Daily word" />
      <Row title="Notify time" help="A Windows notification announces the new word.">
        <input
          type="time"
          aria-label="Notify time"
          value={draft.notifyTime}
          onChange={(e) =>
            TIME.test(e.target.value)
              ? save({ notifyTime: e.target.value })
              : setDraft((d) => ({ ...d, notifyTime: e.target.value }))
          }
          className={INPUT}
        />
      </Row>
      <Row title="Level" help="How deep the terms and questions go.">
        <div role="group" aria-label="Level" className="flex gap-[3px] rounded-[7px] border border-line bg-panel p-[3px]">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={draft.level === l}
              onClick={() => save({ level: l })}
              className={`rounded-[5px] px-3 py-[5px] text-[13px] ${
                draft.level === l ? "bg-control-line text-ink-strong" : "text-ink-soft"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row title="Areas" help="Words are drawn from these." stacked>
        <div className="mt-1 font-mono text-xs text-ink-faint">{draft.areas.length} of {AREAS.length}</div>
        <div className="mt-3.5 grid grid-cols-1 gap-x-5 gap-y-1 @xl:grid-cols-2">
          {AREAS.map((a) => (
            <label key={a.id} className="flex items-center gap-2.5 rounded-[5px] px-1.5 py-1.5 text-sm text-ink hover:bg-hover">
              <input
                type="checkbox"
                className="accent-accent"
                checked={draft.areas.includes(a.id)}
                disabled={lastArea === a.id}
                onChange={() => toggleArea(a.id)}
              />
              {a.label}
            </label>
          ))}
        </div>
        {lastArea && <div className="mt-2 text-[13px] text-ink-soft">At least one area stays on.</div>}
      </Row>
      <Row title="Stack" help="Examples and questions lean on these." stacked>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {draft.stackProfile.map((tag) => (
            <span key={tag} className="flex items-center gap-1.5 rounded-full bg-active py-1 pr-1.5 pl-2.5 text-[13px] text-ink-body">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => save({ stackProfile: draft.stackProfile.filter((t) => t !== tag) })}
                className="size-4 rounded-full text-[10px] text-ink-soft hover:bg-control-line hover:text-ink-bright"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            value={newTag}
            placeholder="Add… ⏎"
            aria-label="Add stack tag"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className="w-[90px] rounded-full border border-dashed border-control-line bg-transparent px-2.5 py-1 text-[13px] text-ink"
          />
        </div>
      </Row>

      <Section title="AI grading" />
      <Row title="API key" help="Stored locally. Without a key the app runs in demo mode." stacked>
        <div className="mt-2 text-[13px] text-ink-soft">
          {draft.hasApiKey ? "A key is saved." : "No key — the app runs in demo mode."}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            aria-label="API key"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className={`${INPUT} min-w-0 flex-1`}
          />
          {keyInput && (
            <button type="button" onClick={saveKey} className={BUTTON}>
              Save key
            </button>
          )}
          <button type="button" onClick={() => void testKey()} className={BUTTON}>
            Test key
          </button>
          {draft.hasApiKey && (
            <button type="button" onClick={() => save({ apiKey: null })} className={BUTTON}>
              Remove key
            </button>
          )}
        </div>
        {keyTest.kind === "testing" && <div className="mt-2.5 text-[13.5px] text-ink-soft">Testing…</div>}
        {keyTest.kind === "ok" && (
          <div className="mt-2.5 text-[13.5px] text-pass">
            ✓ Key works — checked in {(keyTest.ms / 1000).toFixed(1)} s
          </div>
        )}
        {keyTest.kind === "error" && <div className="mt-2.5 text-[13.5px] text-fail">{keyTest.message}</div>}
      </Row>
      <Row title="Model" help="Used for generating words and grading.">
        <select
          aria-label="Model"
          value={draft.model}
          onChange={(e) => save({ model: e.target.value })}
          className={INPUT}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>

      <Section title="App" />
      <Row title="Launch at login" help="Starts quietly in the system tray.">
        <button
          type="button"
          role="switch"
          aria-checked={draft.launchAtLogin}
          aria-label="Launch at login"
          onClick={() => save({ launchAtLogin: !draft.launchAtLogin })}
          className={`relative h-5 w-9 rounded-full ${draft.launchAtLogin ? "bg-accent" : "bg-control-line"}`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-ink-bright ${draft.launchAtLogin ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </Row>
    </div>
  );
}
