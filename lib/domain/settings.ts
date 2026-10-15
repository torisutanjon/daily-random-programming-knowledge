import { AREA_IDS } from "./areas";
import type { Level } from "./types";

export interface Settings {
  notifyTime: string; // "HH:mm"
  level: Level;
  areas: string[]; // enabled: built-in ids + custom names
  customAreas: string[];
  stackProfile: string[];
  apiKey: string | null; // null → demo mode (FakeProvider)
  model: string;
  launchAtLogin: boolean;
}

export type PublicSettings = Omit<Settings, "apiKey"> & { hasApiKey: boolean };

/** A fresh copy each call, so callers can't mutate shared defaults. */
export function defaultSettings(): Settings {
  return {
    notifyTime: "09:00",
    level: "mid-senior",
    areas: [...AREA_IDS],
    customAreas: [],
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

/** Allowlist copy: the API key never leaves the server. */
export function toPublicSettings(settings: Settings): PublicSettings {
  const { notifyTime, level, areas, customAreas, stackProfile, model, launchAtLogin, apiKey } = settings;
  return {
    notifyTime,
    level,
    areas: [...areas],
    customAreas: [...customAreas],
    stackProfile: [...stackProfile],
    model,
    launchAtLogin,
    hasApiKey: apiKey !== null,
  };
}
