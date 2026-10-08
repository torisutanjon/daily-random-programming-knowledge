import { notFound } from "next/navigation";
import WordView from "@/components/word/WordView";
import { sanitizeWord } from "@/lib/domain/sanitize";
import { createRepo, getDataDir } from "@/lib/store/repo";

// Reads the data dir on every request.
export const dynamic = "force-dynamic";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function WordPage({ params }: PageProps<"/word/[dayKey]">) {
  const { dayKey } = await params;
  if (!DAY_KEY.test(dayKey)) notFound();
  const word = await createRepo(getDataDir()).getWord(dayKey);
  if (!word) notFound();
  return <WordView key={dayKey} word={sanitizeWord(word)} from="backlog" />;
}
