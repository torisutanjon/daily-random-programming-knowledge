import { currentDayKey, nextFireAt } from "@/lib/domain/day";
import { CorruptFileError, createRepo, getDataDir } from "@/lib/store/repo";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(): Promise<Response> {
  try {
    const repo = createRepo(getDataDir());
    const settings = await repo.getSettings();
    const now = new Date();
    const dayKey = currentDayKey(now, settings.notifyTime);
    const word = await repo.getWord(dayKey);
    return Response.json({
      dayKey,
      hasWord: word !== null,
      nextFireAt: nextFireAt(now, settings.notifyTime).toISOString(),
      launchAtLogin: settings.launchAtLogin,
    });
  } catch (error) {
    if (error instanceof CorruptFileError) {
      return errorResponse(500, "corrupt_file", error.message);
    }
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
