import type { ShellData } from "@/lib/ui/shell";
import TitleBar from "@/components/shell/TitleBar";
import Nav from "@/components/shell/Nav";
import RightPanel from "@/components/shell/RightPanel";

export default function Shell({
  data,
  children,
}: {
  data: ShellData;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="h-screen min-h-[640px] flex flex-col bg-canvas overflow-hidden">
      <TitleBar data={data} />
      <div className="flex-1 flex min-h-0">
        <Nav data={data} />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
        <RightPanel data={data} />
      </div>
    </div>
  );
}
