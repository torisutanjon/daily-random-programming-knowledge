import { sanitizeWord } from "@/lib/domain/sanitize";
import { PROVIDER_ERRORS, ProviderError } from "@/lib/llm/errors";
import { getProvider } from "@/lib/llm/provider";
import { createTodayService, GenerationError } from "@/lib/services/today";
import { CorruptFileError, createRepo, getDataDir } from "@/lib/store/repo";

// One service per server process, so its in-flight lock covers every request.
const service = createTodayService({
  repo: createRepo(getDataDir()),
  getProvider,
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
    if (error instanceof ProviderError) {
      const { code, message } = PROVIDER_ERRORS[error.reason];
      return errorResponse(502, code, message);
    }
    if (error instanceof GenerationError) return errorResponse(502, error.reason, error.message);
    if (error instanceof CorruptFileError) return errorResponse(500, "corrupt_file", error.message);
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
