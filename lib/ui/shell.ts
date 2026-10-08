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
