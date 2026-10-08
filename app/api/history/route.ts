import { areaCounts } from "@/lib/domain/coverage";
import { sanitizeWord } from "@/lib/domain/sanitize";
import { CorruptFileError, createRepo, getDataDir } from "@/lib/store/repo";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(): Promise<Response> {
  try {
    const words = (await createRepo(getDataDir()).listWords()).map(sanitizeWord);
    return Response.json({ words, coverage: areaCounts(words) });
  } catch (error) {
    if (error instanceof CorruptFileError) {
      return errorResponse(500, "corrupt_file", error.message);
    }
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
