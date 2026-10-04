import { AREA_IDS, type AreaId } from "./areas";
import type { Level } from "./types";

export interface Settings {
  notifyTime: string; // "HH:mm"
  level: Level;
  areas: AreaId[]; // enabled areas
  stackProfile: string[];
  apiKey: string | null; // null → demo mode (FakeProvider)
  model: string;
  launchAtLogin: boolean;
}

/** A fresh copy each call, so callers can't mutate shared defaults. */
export function defaultSettings(): Settings {
  return {
    notifyTime: "09:00",
    level: "mid-senior",
    areas: [...AREA_IDS],
    stackProfile: [
      "TypeScript/JavaScript",
      "React",
      "Next.js",
      "Node.js",
      "PostgreSQL",
      "GraphQL",
      "Supabase",
      "MongoDB",
      "Jest",
      "Tailwind",
      "Vercel",
      "Git",
    ],
    apiKey: null,
    model: "claude-opus-5-5",
    launchAtLogin: true,
  };
}
