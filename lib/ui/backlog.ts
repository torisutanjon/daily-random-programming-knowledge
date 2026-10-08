import { AREAS, type AreaId } from "@/lib/domain/areas";
import { currentDayKey } from "@/lib/domain/day";
import type { Settings } from "@/lib/domain/settings";
import { wordProgress } from "@/lib/domain/status";
import type { Level, QuestionStatus, Word } from "@/lib/domain/types";
import { areaLabel, formatShortDate, questionStatuses } from "@/lib/ui/word";

export type RowStatus = "learned" | "in-progress" | "unanswered"; // done (all learned/revealed) | some answered | none

export interface BacklogRow {
  dayKey: string;
  term: string;
  date: string; // "Wed 7 Oct"
  area: string; // area label
  level: Level;
  status: RowStatus;
  segments: QuestionStatus[];
  progress: string; // "1/2" = (learned + revealed) / total
}

export interface CoverageRow {
  area: AreaId;
  label: string;
  count: number;
  enabled: boolean;
  percent: number; // count / max count × 100, 0 when no words
}

export interface BacklogData {
  rows: BacklogRow[]; // past words only, newest first
  coverage: CoverageRow[]; // all 16 areas, AREAS order
  covered: number; // areas with ≥ 1 word
}

function rowStatus(word: Word): RowStatus {
  if (wordProgress(word).done) return "learned";
  return questionStatuses(word).some((status) => status !== "unanswered") ? "in-progress" : "unanswered";
}

function toRow(word: Word): BacklogRow {
  const { learned, revealed, total } = wordProgress(word);
  return {
    dayKey: word.dayKey,
    term: word.term,
    date: formatShortDate(word.dayKey),
    area: areaLabel(word.area),
    level: word.level,
    status: rowStatus(word),
    segments: questionStatuses(word),
    progress: `${learned + revealed}/${total}`,
  };
}

export function buildBacklog(words: readonly Word[], settings: Settings, now: Date): BacklogData {
  const todayKey = currentDayKey(now, settings.notifyTime);
  const rows = words
    .filter((word) => word.dayKey !== todayKey)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    .map(toRow);

  const counts = new Map<string, number>();
  for (const word of words) counts.set(word.area, (counts.get(word.area) ?? 0) + 1);
  const max = Math.max(0, ...AREAS.map((area) => counts.get(area.id) ?? 0));
  const coverage = AREAS.map((area) => {
    const count = counts.get(area.id) ?? 0;
    return {
      area: area.id,
      label: area.label,
      count,
      enabled: settings.areas.includes(area.id),
      percent: max ? (count / max) * 100 : 0,
    };
  });

  return { rows, coverage, covered: coverage.filter((row) => row.count > 0).length };
}
