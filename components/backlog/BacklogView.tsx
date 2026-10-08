"use client";

import { useState } from "react";
import Link from "next/link";
import { SEGMENT_CLASS, StatusIcon } from "@/components/word/StatusIcon";
import type { BacklogData, BacklogRow, CoverageRow } from "@/lib/ui/backlog";

type Filter = "progress" | "learned" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "progress", label: "In progress" },
  { id: "learned", label: "Learned" },
  { id: "all", label: "All" },
];

function matches(row: BacklogRow, filter: Filter): boolean {
  if (filter === "all") return true;
  return filter === "learned" ? row.status === "learned" : row.status !== "learned";
}

function Row({ row }: { row: BacklogRow }): React.JSX.Element {
  return (
    <Link
      href={`/word/${row.dayKey}`}
      className="grid grid-cols-[18px_76px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-md border-b border-hover px-2.5 py-3.5 hover:bg-card"
    >
      <StatusIcon status={row.status} />
      <span className="font-mono text-xs text-ink-faint">{row.date}</span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="truncate text-base text-ink-strong">{row.term}</span>
        <span className="text-[13px] text-ink-soft">
          {row.area} · {row.level}
        </span>
      </span>
      <span className="flex items-center gap-2.5">
        <span className="flex gap-0.5">
          {row.segments.map((status, i) => (
            <span
              key={i}
              data-segment
              data-status={status}
              className={`h-[5px] w-2 rounded-[2px] ${SEGMENT_CLASS[status]}`}
            />
          ))}
        </span>
        <span className="min-w-[34px] text-right font-mono text-xs text-ink-muted">
          {row.progress}
        </span>
      </span>
    </Link>
  );
}

function Empty({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <div className="mt-7 flex flex-col gap-2 rounded-lg border border-dashed border-field-line px-7 py-10">
      <div className="text-base font-medium text-ink">{title}</div>
      <div className="max-w-[52ch] text-[14.5px] text-ink-soft">{body}</div>
    </div>
  );
}

function Coverage({ rows, covered }: { rows: CoverageRow[]; covered: number }): React.JSX.Element {
  return (
    <section
      aria-labelledby="coverage-title"
      className="rounded-lg border border-line bg-panel p-[18px]"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="coverage-title" className="text-sm font-semibold text-ink-strong">
          Coverage
        </h2>
        <span className="font-mono text-[11.5px] text-ink-faint">{covered} of 16 areas</span>
      </div>
      <div className="mt-3.5 flex flex-col gap-[9px]">
        {rows.map((c) => {
          const color = !c.enabled ? "text-ink-dim" : c.count > 0 ? "text-ink-body" : "text-ink-faint";
          return (
            <div
              key={c.area}
              data-area={c.area}
              data-enabled={c.enabled}
              className={`grid grid-cols-[minmax(0,1fr)_56px_18px] items-center gap-2.5 text-[12.5px] ${color}`}
            >
              <span className="truncate">{c.label}</span>
              <div className="h-[5px] overflow-hidden rounded-[3px] bg-active">
                <div
                  data-bar
                  className="h-full rounded-[3px] bg-accent"
                  style={{ width: `${c.percent}%` }}
                />
              </div>
              <span className="text-right font-mono text-[11.5px]">{c.count}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 text-xs text-ink-faint">Faded areas are switched off in Settings.</div>
    </section>
  );
}

export default function BacklogView({ data }: { data: BacklogData }): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>("progress");
  const rows = data.rows.filter((r) => matches(r, filter));

  return (
    <div className="mx-auto max-w-[960px] px-10 pb-[100px] pt-12">
      <h1 className="text-[32px] font-semibold tracking-[-0.01em] text-ink-bright">Backlog</h1>
      <p className="mt-1.5 text-[14.5px] text-ink-soft">
        Every past word. Unfinished ones wait here — nothing is lost.
      </p>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_280px] items-start gap-10">
        <div>
          <div className="flex w-max gap-1 rounded-[7px] border border-line bg-panel p-[3px]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-[5px] px-3 py-[5px] text-[13px] ${
                  filter === f.id ? "bg-control-line text-ink-strong" : "text-ink-soft"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {data.rows.length === 0 ? (
            <Empty
              title="Your first day"
              body="Past words will collect here. If you don't finish today's word, it moves here tomorrow and waits for you."
            />
          ) : rows.length === 0 ? (
            <Empty title="Nothing in this view" body="Try another filter." />
          ) : (
            <div className="mt-4 flex flex-col">
              {rows.map((r) => (
                <Row key={r.dayKey} row={r} />
              ))}
            </div>
          )}
        </div>
        <Coverage rows={data.coverage} covered={data.covered} />
      </div>
    </div>
  );
}
