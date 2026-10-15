import { z } from "zod";
import { AREA_IDS, customAreaError } from "@/lib/domain/areas";
import { type Settings, toPublicSettings } from "@/lib/domain/settings";
import { CorruptFileError, createRepo, getDataDir } from "@/lib/store/repo";

const patchSchema = z.strictObject({
  notifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  level: z.enum(["mid", "mid-senior", "senior"]).optional(),
  // Never empty: pickArea throws on no enabled areas, which would break /api/today.
  areas: z.array(z.string()).min(1).transform((areas) => [...new Set(areas)]).optional(),
  customAreas: z.array(z.string().trim()).optional(),
  stackProfile: z.array(z.string().trim().min(1)).optional(),
  apiKey: z.string().trim().min(1).nullable().optional(), // null clears → demo mode
  model: z.string().trim().min(1).optional(),
  launchAtLogin: z.boolean().optional(),
});

// Partial saves are read-merge-write; one chain per server process so concurrent saves don't drop fields.
let saving: Promise<unknown> = Promise.resolve();
function withSaveLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = saving.then(fn, fn);
  saving = run.catch(() => undefined);  // a failed save never blocks the next
  return run;
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function serverError(error: unknown): Response {
  if (error instanceof CorruptFileError) {
    return errorResponse(500, "corrupt_file", error.message);
  }
  console.error(error);
  return errorResponse(500, "internal", "Something went wrong");
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(toPublicSettings(await createRepo(getDataDir()).getSettings()));
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Body must be JSON");
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    const repo = createRepo(getDataDir());
    const result: Settings | { error: string } = await withSaveLock(async () => {
      const merged = { ...(await repo.getSettings()), ...parsed.data };
      for (const [i, name] of merged.customAreas.entries()) {
        const message = customAreaError(name, merged.customAreas.slice(0, i));
        if (message) return { error: message };
      }
      const unknown = merged.areas.find((area) => !AREA_IDS.includes(area as never) && !merged.customAreas.includes(area));
      if (unknown !== undefined) return { error: `Unknown area: ${unknown}` };
      await repo.saveSettings(merged);
      return merged;
    });
    if ("error" in result) return errorResponse(400, "invalid_request", result.error);
    const next = result;
    return Response.json(toPublicSettings(next));
  } catch (error) {
    return serverError(error);
  }
}
