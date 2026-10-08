import BacklogView from "@/components/backlog/BacklogView";
import { createRepo, getDataDir } from "@/lib/store/repo";
import { buildBacklog } from "@/lib/ui/backlog";

// Reads the data dir on every request.
export const dynamic = "force-dynamic";

export default async function BacklogPage() {
  const repo = createRepo(getDataDir());
  const [words, settings] = await Promise.all([repo.listWords(), repo.getSettings()]);
  return <BacklogView data={buildBacklog(words, settings, new Date())} />;
}
