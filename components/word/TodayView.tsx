"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicWord } from "@/lib/domain/sanitize";
import { formatLongDate } from "@/lib/ui/word";
import WordView from "@/components/word/WordView";

type State =
  | { kind: "loading" }
  | { kind: "error"; code: string; message: string }
  | { kind: "ready"; word: PublicWord };

const NETWORK_MESSAGE = "Couldn't reach drpk — try again.";

async function fetchToday(): Promise<State> {
  try {
    const res = await fetch("/api/today");
    if (res.ok) return { kind: "ready", word: (await res.json()) as PublicWord };
    try {
      const body = (await res.json()) as { error?: { code?: unknown; message?: unknown } };
      return {
        kind: "error",
        code: typeof body.error?.code === "string" ? body.error.code : "unknown",
        message: typeof body.error?.message === "string" ? body.error.message : "Something went wrong",
      };
    } catch {
      return { kind: "error", code: "unknown", message: "Something went wrong" };
    }
  } catch {
    return { kind: "error", code: "network", message: NETWORK_MESSAGE };
  }
}

function DemoNote(): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2.5 rounded-md bg-partial/8 px-3.5 py-2.5 text-[13.5px] leading-normal text-ink-body">
      <span className="flex-none font-medium text-partial">Demo mode</span>
      <span>
        Sample content — answers are graded by a stub.{" "}
        <Link href="/settings" className="underline">
          Add an API key
        </Link>{" "}
        to get real words.
      </span>
    </div>
  );
}

function DateLine({ dayKey }: { dayKey: string }): React.JSX.Element {
  return <div className="mb-3.5 font-mono text-xs text-ink-faint">{formatLongDate(dayKey)}</div>;
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mx-auto max-w-[720px] px-10 pb-[120px] pt-9">{children}</div>;
}

function Loading({ dayKey }: { dayKey: string }): React.JSX.Element {
  return (
    <Frame>
      <DateLine dayKey={dayKey} />
      <div className="h-[46px] w-[300px] max-w-full animate-pulse rounded-md bg-active" />
      <div className="mt-[18px] flex gap-2">
        <div className="h-6 w-[150px] animate-pulse rounded-full bg-hover" />
        <div className="h-6 w-[84px] animate-pulse rounded-full bg-hover" />
      </div>
      <div className="mt-10 flex items-center gap-2.5 rounded-lg border border-line-soft px-5 py-[18px] text-sm font-medium text-ink">
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-dim border-t-accent" />
        <span>Creating today&apos;s word</span>
        <span className="ml-auto font-mono text-[11.5px] font-normal text-ink-faint">usually 10–20 s</span>
      </div>
      <div className="mt-9 flex flex-col gap-3.5">
        {["62%", "48%", "70%", "54%"].map((w) => (
          <div key={w} className="h-3.5 animate-pulse rounded bg-hover" style={{ width: w }} />
        ))}
      </div>
    </Frame>
  );
}

function ErrorCard({
  dayKey,
  code,
  message,
  onRetry,
}: {
  dayKey: string;
  code: string;
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  const keyError = code === "invalid_key" || code === "provider_rejected";
  return (
    <Frame>
      <DateLine dayKey={dayKey} />
      <div className="flex flex-col gap-2.5 rounded-lg border border-field-line bg-card p-6">
        <div className="text-[17px] font-semibold text-ink-strong">Couldn&apos;t create today&apos;s word</div>
        <div className="text-[14.5px] leading-relaxed text-ink-muted">{message}</div>
        <div className="font-mono text-xs text-ink-faint">{code}</div>
        <div className="mt-2 flex gap-2">
          {keyError && (
            <Link href="/settings" className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent">
              Open Settings
            </Link>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-control-line bg-active px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-hover"
          >
            Retry
          </button>
        </div>
      </div>
      <div className="mt-3.5 text-[13px] text-ink-faint">
        Your backlog is unaffected — unfinished words are still there.
      </div>
    </Frame>
  );
}

export default function TodayView({ dayKey, demo }: { dayKey: string; demo: boolean }): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void fetchToday().then((next) => {
      if (!live) return;
      setState(next);
      if (next.kind === "ready") router.refresh();
    });
    return () => {
      live = false;
    };
  }, [router]);

  function retry(): void {
    setState({ kind: "loading" });
    void fetchToday().then((next) => {
      setState(next);
      if (next.kind === "ready") router.refresh();
    });
  }

  if (state.kind === "loading") return <Loading dayKey={dayKey} />;
  if (state.kind === "error") return <ErrorCard dayKey={dayKey} code={state.code} message={state.message} onRetry={retry} />;
  return <WordView word={state.word} from="today" notice={demo ? <DemoNote /> : undefined} />;
}
