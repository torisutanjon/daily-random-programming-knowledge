"use client";

import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/ui/shell";

export function viewTitle(pathname: string, data: ShellData): string {
  if (pathname === "/") {
    return data.today.term ? `Today — ${data.today.term}` : "Today";
  }
  if (pathname.startsWith("/backlog")) return "Backlog";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/word/")) {
    const dayKey = pathname.slice("/word/".length);
    return data.unfinished.find((entry) => entry.dayKey === dayKey)?.term ?? "Word";
  }
  return "";
}

export default function TitleBar({ data }: { data: ShellData }): React.ReactElement {
  const pathname = usePathname();
  return (
    <header className="h-[38px] flex-none flex items-stretch bg-chrome border-b border-line text-xs text-ink-muted [-webkit-app-region:drag]">
      <div className="w-[232px] flex-none flex items-center gap-2 px-4">
        <span className="size-2.5 rounded-[3px] bg-accent" />
        <span className="font-mono font-medium text-ink">drpk</span>
      </div>
      <div className="flex items-end pl-2 min-w-0">
        <div className="h-[30px] self-end px-3.5 flex items-center bg-canvas border border-line border-b-0 rounded-t-[7px] text-ink -mb-px min-w-0">
          <span className="truncate">{viewTitle(pathname, data)}</span>
        </div>
      </div>
      <div className="flex-1" />
      {data.demo && (
        <div className="flex items-center pr-3.5">
          <span className="font-mono text-[10.5px] tracking-[.08em] px-2 py-[3px] rounded-sm bg-partial/14 text-partial">
            DEMO MODE
          </span>
        </div>
      )}
      <div className="w-[138px] flex-none" />
    </header>
  );
}
