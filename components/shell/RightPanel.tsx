import Link from "next/link";
import type { LogVerdict, ShellData } from "@/lib/ui/shell";

const verdictClass: Record<LogVerdict, string> = {
  pass: "text-pass",
  partial: "text-partial",
  fail: "text-fail",
  revealed: "text-revealed",
};

const headingClass = "text-[11px] text-ink-faint uppercase tracking-[.08em] px-2 pb-2.5";

export default function RightPanel({ data }: { data: ShellData }): React.ReactElement {
  return (
    <aside className="w-[272px] flex-none bg-panel border-l border-line flex flex-col min-h-0">
      <section aria-labelledby="unfinished-heading" className="flex-1 min-h-0 overflow-auto px-3.5 py-[18px]">
        <h2 id="unfinished-heading" className={headingClass}>
          Unfinished
        </h2>
        {data.unfinished.length === 0 ? (
          <p className="px-2 text-sm text-ink-faint">Nothing waiting.</p>
        ) : (
          data.unfinished.map((entry) => (
            <Link
              key={entry.dayKey}
              href={entry.dayKey === data.today.dayKey ? "/" : `/word/${entry.dayKey}`}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-hover"
            >
              <span className="min-w-0">
                <span className="block text-sm text-ink truncate">{entry.term}</span>
                <span className="block text-xs text-ink-faint">{entry.when}</span>
              </span>
              <span className="flex-none font-mono text-[11.5px] text-ink-soft">{entry.progress}</span>
            </Link>
          ))
        )}
      </section>
      <section
        aria-labelledby="log-heading"
        className="flex-1 min-h-0 overflow-auto px-3.5 py-[18px] border-t border-line"
      >
        <h2 id="log-heading" className={headingClass}>
          Log
        </h2>
        {data.log.length === 0 ? (
          <p className="px-2 text-sm text-ink-faint">No answers yet today.</p>
        ) : (
          data.log.map((entry, index) => (
            <div key={`${entry.time}-${index}`} className="grid grid-cols-[40px_1fr] gap-2 px-2 py-1.5 text-[12.5px]">
              <span className="font-mono text-ink-faint">{entry.time}</span>
              <span>
                <span className={verdictClass[entry.verdict]}>{entry.label}</span>
                <span className="text-ink-soft"> · {entry.topic}</span>
              </span>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}
