import { z } from "zod";
import { PROVIDER_ERRORS, ProviderError } from "@/lib/llm/errors";
import { GradingError, NotFoundError, questionService } from "@/lib/services/questions";
import { CorruptFileError } from "@/lib/store/repo";

const bodySchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  questionId: z.string().min(1),
  answer: z.string().trim().min(1).max(5000),
});

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Body must be JSON");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request");
  }
  try {
    return Response.json(await questionService().answer(parsed.data));
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse(404, "not_found", error.message);
    if (error instanceof GradingError) {
      console.error(error.cause ?? error);
      if (error.cause instanceof ProviderError) {
        const { code, message } = PROVIDER_ERRORS[error.cause.reason];
        return errorResponse(502, code, message);
      }
      return errorResponse(502, error.reason === "provider" ? "grading_failed" : "invalid_grade", error.message);
    }
    if (error instanceof CorruptFileError) return errorResponse(500, "corrupt_file", error.message);
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
