import { z } from "zod";
import { NotFoundError, questionService } from "@/lib/services/questions";
import { CorruptFileError } from "@/lib/store/repo";

const bodySchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  questionId: z.string().min(1),
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
    return Response.json(await questionService().reveal(parsed.data));
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse(404, "not_found", error.message);
    if (error instanceof CorruptFileError) return errorResponse(500, "corrupt_file", error.message);
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
