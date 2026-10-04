import { z } from "zod";
import { createAnthropicClient, testKey } from "@/lib/llm/anthropic";
import { PROVIDER_ERRORS, ProviderError } from "@/lib/llm/errors";
import { createRepo, getDataDir } from "@/lib/store/repo";

const bodySchema = z.strictObject({
  apiKey: z.string().trim().min(1).optional(),
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
    const settings = await createRepo(getDataDir()).getSettings();
    const key = parsed.data.apiKey ?? settings.apiKey;

    if (!key) {
      return errorResponse(400, "no_key", "Add an API key first.");
    }

    const client = createAnthropicClient(key);
    await testKey(client, settings.model);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error(error.cause ?? error);
      const { code, message } = PROVIDER_ERRORS[error.reason];
      return errorResponse(502, code, message);
    }
    console.error(error);
    return errorResponse(500, "internal", "Something went wrong");
  }
}
