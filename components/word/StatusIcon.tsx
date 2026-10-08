import type { TopicStatus } from "@/lib/domain/status";
import type { QuestionStatus } from "@/lib/domain/types";

export const SEGMENT_CLASS: Record<QuestionStatus, string> = {
  learned: "bg-pass",
  revealed: "bg-revealed",
  partial: "bg-partial",
  unanswered: "bg-active",
};

export function StatusIcon({ status }: { status: TopicStatus }): React.JSX.Element {
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
