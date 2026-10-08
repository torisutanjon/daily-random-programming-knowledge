import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import Shell from "@/components/shell/Shell";
import { defaultSettings } from "@/lib/domain/settings";
import { createRepo, getDataDir } from "@/lib/store/repo";
import { buildShell, type ShellData } from "@/lib/ui/shell";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "drpk",
  description: "A daily programming word to research, with questions to prove you learned it.",
};

export const dynamic = "force-dynamic";

async function loadShell(): Promise<ShellData> {
  try {
    const repo = createRepo(getDataDir());
    const [words, settings] = await Promise.all([repo.listWords(), repo.getSettings()]);
    return buildShell(words, settings, new Date());
  } catch (error) {
    console.error(error);
    return buildShell([], defaultSettings(), new Date());
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const data = await loadShell();

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Shell data={data}>{children}</Shell>
      </body>
    </html>
  );
}
