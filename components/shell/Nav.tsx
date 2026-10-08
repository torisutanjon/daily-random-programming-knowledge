"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ShellData } from "@/lib/ui/shell";

interface NavItem {
  href: string;
  label: string;
  count: string;
  active: boolean;
}

export default function Nav({ data }: { data: ShellData }): React.ReactElement {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/", label: "Today", count: data.today.progress, active: pathname === "/" },
    {
      href: "/backlog",
      label: "Backlog",
      count: data.openCount > 0 ? `${data.openCount} open` : "",
      active: pathname.startsWith("/backlog") || pathname.startsWith("/word/"),
    },
    { href: "/settings", label: "Settings", count: "", active: pathname.startsWith("/settings") },
  ];

  return (
    <nav className="w-[232px] flex-none bg-panel border-r border-line flex flex-col px-2.5 py-3.5 gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center justify-between px-2.5 py-[7px] rounded-md text-sm hover:bg-hover hover:text-ink ${
            item.active ? "bg-active text-ink-strong" : "text-ink-muted"
          }`}
        >
          <span>{item.label}</span>
          <span className="font-mono text-[11px] text-ink-faint">{item.count}</span>
        </Link>
      ))}
      <div className="mt-auto pt-3 px-2.5 pb-1 border-t border-line flex flex-col gap-1">
        <span className="text-[11px] text-ink-faint uppercase tracking-[.08em]">Next word</span>
        <span className="text-[13px] text-ink-muted">{data.nextWord}</span>
      </div>
    </nav>
  );
}
