"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicQuestion } from "@/lib/domain/sanitize";
import type { QuestionStatus, Verdict } from "@/lib/domain/types";
import { attemptTime } from "@/lib/ui/word";

const STATUS: Record<QuestionStatus, { label: string; color: string }> = {
  unanswered: { label: "Unanswered", color: "text-ink-faint" },
  partial: { label: "Partial", color: "text-partial" },
  learned: { label: "Learned", color: "text-pass" },
  revealed: { label: "Revealed", color: "text-revealed" },
};

const VERDICT: Record<Verdict, { label: string; style: string }> = {
  pass: { label: "Pass", style: "bg-pass/13 text-pass" },
  partial: { label: "Partial", style: "bg-partial/13 text-partial" },
  fail: { label: "Not yet", style: "bg-fail/13 text-fail" },
};

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : null;
  } catch {
    return null;
  }
}

export default function QuestionCard({
  dayKey,
  question,
  index,
  onChange,
}: {
  dayKey: string;
  question: PublicQuestion;
  index: number;
  onChange: (question: PublicQuestion) => void;
}): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const { status } = question;
  const composer = status === "unanswered" || status === "partial" || reopened;

  async function submit(): Promise<void> {
    if (grading) return;
    setGrading(true);
    setError(null);
    setCode(null);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayKey, questionId: question.id, answer: draft.trim() }),
      });
      if (res.ok) {
        onChange((await res.json()) as PublicQuestion);
        setDraft("");
        setReopened(false);
        router.refresh();
      } else {
        setCode(await errorCode(res));
        setError("Couldn't grade — try again. Your answer is still here.");
      }
    } catch {
      setError("Couldn't grade — try again. Your answer is still here.");
    } finally {
      setGrading(false);
    }
  }

  async function reveal(): Promise<void> {
    if (revealing) return;
    setRevealing(true);
    setError(null);
    setCode(null);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dayKey, questionId: question.id }),
      });
      if (res.ok) {
        onChange((await res.json()) as PublicQuestion);
        router.refresh();
        setConfirming(false);
      } else {
        setError("Couldn't reveal — try again.");
      }
    } catch {
      setError("Couldn't reveal — try again.");
    } finally {
      setRevealing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5 text-xs">
        <span className="font-mono text-ink-faint">{`Q${index + 1}`}</span>
        <span className={STATUS[status].color}>{STATUS[status].label}</span>
      </div>
      <div className="max-w-[62ch] text-[17px] leading-relaxed text-ink-strong">{question.prompt}</div>

      {question.attempts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {question.attempts.map((a, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-lg bg-card p-4">
              <div className="flex items-center gap-2.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT[a.verdict].style}`}>
                  {VERDICT[a.verdict].label}
                </span>
                <span className="font-mono text-[11.5px] text-ink-faint">{`attempt ${i + 1} · ${attemptTime(a.at)}`}</span>
              </div>
              {a.answer && <div className="whitespace-pre-wrap text-sm text-ink-soft">{a.answer}</div>}
              <div className="text-[15px] text-ink">{a.feedback}</div>
            </div>
          ))}
        </div>
      )}

      {question.modelAnswer && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-revealed/22 bg-revealed/7 p-4">
          <span className="text-xs text-revealed">MODEL ANSWER</span>
          <div className="text-[15.5px] leading-relaxed text-ink">{question.modelAnswer}</div>
          <span className="mt-1 text-xs text-ink-soft">Key points</span>
          <ul className="flex flex-col gap-1">
            {(question.rubric ?? []).map((point, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] text-ink-body">
                <span aria-hidden className="text-revealed">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {composer && (
        <div className="flex flex-col gap-2.5">
          <textarea
            aria-label="Your answer"
            maxLength={5000}
            readOnly={grading}
            placeholder="Explain it in your own words…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[124px] w-full rounded-lg border border-field-line bg-panel p-3 text-ink focus:border-accent/70 focus:outline-none"
          />
          <div className="flex items-center gap-3.5">
            {status !== "revealed" && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-[13px] text-ink-faint hover:text-ink-muted"
              >
                Reveal answer
              </button>
            )}
            <span className="flex-1" />
            <span aria-live="polite" className="text-[13px] text-ink-soft">
              {grading && "Reading your answer…"}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={draft.trim() === "" || grading}
              className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent disabled:opacity-50"
            >
              {grading ? "Checking…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[13.5px] text-fail">
          {error}
          {code === "invalid_key" && (
            <>
              {" "}
              <Link href="/settings" className="underline">
                Check your API key in Settings
              </Link>
            </>
          )}
        </div>
      )}

      {confirming && (
        <div
          role="group"
          aria-label="Confirm reveal"
          className="flex flex-col gap-3 rounded-lg border border-control-line bg-card p-4"
        >
          <div className="text-[14.5px] leading-snug text-ink">
            Reveal the model answer? This question will be marked revealed rather than
            learned. You can still write your own answer afterwards.
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
                setCode(null);
              }}
              className="rounded-md border border-control-line px-3.5 py-1.5 text-[13px] font-medium text-ink-body"
            >
              Keep trying
            </button>
            <button
              type="button"
              onClick={reveal}
              disabled={revealing}
              className="rounded-md bg-revealed/18 px-3.5 py-1.5 text-[13px] font-medium text-revealed"
            >
              Reveal answer
            </button>
          </div>
        </div>
      )}

      {!composer && status === "learned" && (
        <div>
          <button type="button" onClick={() => setReopened(true)} className="text-[13px] text-ink-faint hover:text-ink-muted">
            Answer again
          </button>
        </div>
      )}
      {!composer && status === "revealed" && (
        <div>
          <button type="button" onClick={() => setReopened(true)} className="text-[13px] text-ink-faint hover:text-ink-muted">
            Write it in your own words anyway
          </button>
        </div>
      )}
    </div>
  );
}
