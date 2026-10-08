import SettingsView from "@/components/settings/SettingsView";
import { toPublicSettings } from "@/lib/domain/settings";
import { createRepo, getDataDir } from "@/lib/store/repo";

// Reads the data dir on every request; only public settings (no API key) reach the client.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await createRepo(getDataDir()).getSettings();
  return <SettingsView initial={toPublicSettings(settings)} />;
}
