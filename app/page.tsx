import { currentDayKey } from "@/lib/domain/day";
import { defaultSettings } from "@/lib/domain/settings";
import { createRepo, getDataDir } from "@/lib/store/repo";
import TodayView from "@/components/word/TodayView";

export const dynamic = "force-dynamic";

export default async function Home(): Promise<React.JSX.Element> {
  let settings = defaultSettings();
  try {
    settings = await createRepo(getDataDir()).getSettings();
  } catch (error) {
    console.error(error);
  }
  const dayKey = currentDayKey(new Date(), settings.notifyTime);
  return <TodayView key={dayKey} dayKey={dayKey} demo={settings.apiKey === null} />;
}
