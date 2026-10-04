import { sanitizeWord } from "@/lib/domain/sanitize";
import { createFakeProvider } from "@/lib/llm/fake";
import { createTodayService, GenerationError } from "@/lib/services/today";
import { CorruptFileError, createRepo, getDataDir } from "@/lib/store/repo";

// One service per server process, so its in-flight lock covers every request.
// DRPK-010 adds the Anthropic provider when settings.apiKey is set.
const service = createTodayService({
  repo: createRepo(getDataDir()),
  getProvider: () => ({ llm: createFakeProvider(), name: "fake" }),
  now: () => new Date(),
  rng: Math.random,
});

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(): Promise<Response> {
  try {
    const word = await service.getToday();
    return Response.json(sanitizeWord(word));
  } catch (error) {
    if (error instanceof GenerationError) return errorResponse(502, error.reason, error.message);
    if (error instanceof CorruptFileError) return errorResponse(500, "corrupt_file", error.message);
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
