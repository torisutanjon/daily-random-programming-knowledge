import { currentDayKey, formatDayKey, nextFireAt } from "@/lib/domain/day";
import type { Settings } from "@/lib/domain/settings";
import { wordProgress } from "@/lib/domain/status";
import type { Verdict, Word } from "@/lib/domain/types";

export type LogVerdict = "pass" | "partial" | "fail" | "revealed";

export interface LogEntry {
  time: string;
  label: "Pass" | "Partial" | "Not yet" | "Revealed";
  verdict: LogVerdict;
  topic: string;
}

export interface UnfinishedEntry {
  dayKey: string;
  term: string;
  when: string;
  progress: string;
}

export interface ShellData {
  demo: boolean;
  today: { dayKey: string; term: string | null; progress: string };
  openCount: number;
  nextWord: string;
  unfinished: UnfinishedEntry[];
  log: LogEntry[];
}

const VERDICT_LABEL: Record<Verdict, LogEntry["label"]> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Not yet",
};
const MAX_LOG = 8;

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shortDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function progressText(word: Word): string {
  const { learned, revealed, total } = wordProgress(word);
  return `${learned + revealed}/${total}`;
}

/** The shell's view of stored data. Carries no apiKey, rubric, modelAnswer or answer text: it is sent to client components. */
export function buildShell(words: readonly Word[], settings: Settings, now: Date): ShellData {
  const todayKey = currentDayKey(now, settings.notifyTime);
  const todayWord = words.find((word) => word.dayKey === todayKey);
  const fire = nextFireAt(now, settings.notifyTime);
  const nextWord = `${formatDayKey(fire) === formatDayKey(now) ? "Today" : "Tomorrow"} at ${settings.notifyTime}`;

  const unfinished: UnfinishedEntry[] = words
    .filter((word) => !wordProgress(word).done)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    .map((word) => ({
      dayKey: word.dayKey,
      term: word.term,
      when: word.dayKey === todayKey ? "Today" : shortDate(word.dayKey),
      progress: progressText(word),
    }));

  const today = formatDayKey(now);
  const isToday = (at: string): boolean => formatDayKey(new Date(at)) === today;
  const entries: { at: string; entry: LogEntry }[] = [];
  for (const word of words) {
    for (const topic of word.topics) {
      for (const question of topic.questions) {
        for (const { at, verdict } of question.attempts) {
          if (!isToday(at)) continue;
          entries.push({
            at,
            entry: { time: hhmm(new Date(at)), label: VERDICT_LABEL[verdict], verdict, topic: topic.title },
          });
        }
        const { revealedAt } = question;
        if (revealedAt && isToday(revealedAt)) {
          entries.push({
            at: revealedAt,
            entry: { time: hhmm(new Date(revealedAt)), label: "Revealed", verdict: "revealed", topic: topic.title },
          });
        }
      }
    }
  }
  const log = entries
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_LOG)
    .map(({ entry }) => entry);

  return {
    demo: settings.apiKey === null,
    today: { dayKey: todayKey, term: todayWord?.term ?? null, progress: todayWord ? progressText(todayWord) : "" },
    openCount: unfinished.filter((entry) => entry.dayKey !== todayKey).length,
    nextWord,
    unfinished,
    log,
  };
}
