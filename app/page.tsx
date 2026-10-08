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
  return <TodayView demo={settings.apiKey === null} />;
}
