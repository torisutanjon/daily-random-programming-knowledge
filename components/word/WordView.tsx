"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicQuestion, PublicWord } from "@/lib/domain/sanitize";
import { topicStatus, type TopicStatus } from "@/lib/domain/status";
import type { QuestionStatus } from "@/lib/domain/types";
import { areaLabel, formatLongDate, progressSummary, questionStatuses } from "@/lib/ui/word";
import QuestionCard from "@/components/word/QuestionCard";

const SEGMENT: Record<QuestionStatus, string> = {
  learned: "bg-pass",
  revealed: "bg-revealed",
  partial: "bg-partial",
  unanswered: "bg-active",
};

function TopicIcon({ status }: { status: TopicStatus }): React.JSX.Element {
  const box = "flex h-4 w-4 flex-none items-center justify-center rounded-[4px] box-border";
  if (status === "learned") {
    return (
      <span data-status={status} className={`${box} bg-pass text-on-accent`}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <polyline
            points="2,5.2 4.2,7.2 8,2.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span data-status={status} className={`${box} border-[1.5px] border-partial`}>
        <span className="h-1.5 w-1.5 rounded-[1.5px] bg-partial" />
      </span>
    );
  }
  if (status === "revealed") {
    return (
      <span data-status={status} className={`${box} border-[1.5px] border-revealed`}>
        <span className="h-1.5 w-1.5 rounded-full bg-revealed" />
      </span>
    );
  }
  return <span data-status={status} className={`${box} border-[1.5px] border-ink-dim`} />;
}

function Legend(): React.JSX.Element {
  return (
    <div className="flex gap-3.5 text-xs text-ink-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-pass" />
        learned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="box-border flex h-2.5 w-2.5 items-center justify-center rounded-[3px] border-[1.5px] border-revealed">
          <span className="h-1 w-1 rounded-full bg-revealed" />
        </span>
        revealed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="box-border h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-partial" />
        in progress
      </span>
    </div>
  );
}

export default function WordView({
  word: initial,
  from,
  notice,
}: {
  word: PublicWord;
  from: "today" | "backlog";
  notice?: React.ReactNode;
}): React.JSX.Element {
  const [word, setWord] = useState(initial);
  const [open, setOpen] = useState<Set<string>>(() => {
    const first = initial.topics.find((t) => {
      const s = topicStatus(t.questions);
      return s !== "learned" && s !== "revealed";
    });
    return new Set(first ? [first.id] : []);
  });

  function replaceQuestion(topicId: string, question: PublicQuestion): void {
    setWord((w) => ({
      ...w,
      topics: w.topics.map((t) =>
        t.id === topicId ? { ...t, questions: t.questions.map((q) => (q.id === question.id ? question : q)) } : t,
      ),
    }));
  }

  function toggle(id: string): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="relative flex h-10 items-center justify-center gap-1.5 text-[12.5px] text-ink-faint">
        {from === "backlog" && (
          <Link href="/backlog" className="absolute left-5 text-ink-muted hover:text-ink">
            ← Backlog
          </Link>
        )}
        <span>{from === "today" ? "Today" : "Backlog"}</span>
        <span>/</span>
        <span className="text-ink-muted">{word.term}</span>
      </div>

      <div className="mx-auto max-w-[720px] px-10 pb-[120px] pt-9">
        {notice && <div className="mb-7">{notice}</div>}
        <div className="mb-3 font-mono text-xs text-ink-faint">{formatLongDate(word.dayKey)}</div>
        <h1 className="text-[46px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink-bright">{word.term}</h1>
        <div className="mt-2 text-base text-ink-soft">{word.subtitle}</div>

        <div className="mt-7 grid grid-cols-[110px_1fr] items-center gap-y-3 text-[13.5px]">
          <span className="text-ink-faint">area</span>
          <div>
            <span className="rounded-full bg-accent/14 px-2.5 py-[3px] text-accent">{areaLabel(word.area)}</span>
          </div>
          <span className="text-ink-faint">level</span>
          <div>
            <span className="rounded-full bg-active px-2.5 py-[3px] text-ink-body">{word.level}</span>
          </div>
          <span className="text-ink-faint">progress</span>
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="text-ink">{progressSummary(word)}</span>
            <div className="flex gap-[3px]">
              {questionStatuses(word).map((status, i) => (
                <span
                  key={i}
                  data-segment
                  data-status={status}
                  className={`h-[5px] w-3.5 rounded-[2px] ${SEGMENT[status]}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-11 flex items-baseline justify-between gap-4 border-b border-line pb-2.5">
          <h2 className="text-xl font-semibold text-ink-strong">Topics</h2>
          <Legend />
        </div>

        <div className="flex flex-col">
          {word.topics.map((topic) => {
            const status = topicStatus(topic.questions);
            const done = topic.questions.filter((q) => q.status === "learned" || q.status === "revealed").length;
            const isOpen = open.has(topic.id);
            const finished = status === "learned" || status === "revealed";
            return (
              <div key={topic.id} className="border-b border-hover">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(topic.id)}
                  className="flex w-full items-center gap-3 rounded-md px-1.5 py-[13px] text-left hover:bg-card"
                >
                  <TopicIcon status={status} />
                  <span className={`flex-1 text-base leading-snug ${finished ? "text-ink-muted" : "text-ink-strong"}`}>
                    {topic.title}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-faint">{`${done}/${topic.questions.length}`}</span>
                  <span aria-hidden className="w-3.5 text-center text-[11px] text-ink-faint">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-[13px] flex flex-col gap-[34px] border-l border-line-soft pb-5 pl-[26px] pt-1">
                    {topic.questions.map((question, i) => (
                      <QuestionCard
                        key={question.id}
                        dayKey={word.dayKey}
                        question={question}
                        index={i}
                        onChange={(q) => replaceQuestion(topic.id, q)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
