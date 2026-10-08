import { AREAS } from "@/lib/domain/areas";
import { wordProgress } from "@/lib/domain/status";
import type { QuestionStatus } from "@/lib/domain/types";

type StatusWord = { topics: readonly { questions: readonly { status: QuestionStatus }[] }[] };

export function attemptTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function progressSummary(word: StatusWord): string {
  const { learned, revealed, total } = wordProgress(word);
  return `${learned}/${total} learned${revealed > 0 ? ` · ${revealed} revealed` : ""}`;
}

export function questionStatuses(word: StatusWord): QuestionStatus[] {
  return word.topics.flatMap((topic) => topic.questions.map((question) => question.status));
}

export function formatLongDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).replace(",", "");
}

export function formatShortDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, 12)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
}

export function areaLabel(id: string): string {
  return AREAS.find((area) => area.id === id)?.label ?? id;
}
